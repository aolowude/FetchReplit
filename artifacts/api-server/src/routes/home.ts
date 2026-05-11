import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import {
  db,
  scansTable,
  fridgeItemsTable,
  userProfilesTable,
} from "@workspace/db";
import { chatJson, AiError } from "../lib/ai";
import { loadMemory } from "./memory";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized", message: "Sign in required." });
    return;
  }
  next();
}

router.get("/home/summary", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const inSevenDays = new Date();
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const [todayTotalsRow] = await db
    .select({
      calories: sql<number>`coalesce(sum(${scansTable.calories}), 0)`,
      protein: sql<number>`coalesce(sum(${scansTable.protein}), 0)`,
      carbs: sql<number>`coalesce(sum(${scansTable.carbs}), 0)`,
      fat: sql<number>`coalesce(sum(${scansTable.fat}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(scansTable)
    .where(and(eq(scansTable.userId, user.id), gte(scansTable.createdAt, startOfDay)));

  const recentScans = await db
    .select()
    .from(scansTable)
    .where(eq(scansTable.userId, user.id))
    .orderBy(desc(scansTable.createdAt))
    .limit(6);

  const [scanCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(scansTable)
    .where(eq(scansTable.userId, user.id));

  const expiringItems = await db
    .select()
    .from(fridgeItemsTable)
    .where(
      and(
        eq(fridgeItemsTable.userId, user.id),
        isNotNull(fridgeItemsTable.expiresAt),
        lte(fridgeItemsTable.expiresAt, inSevenDays),
      ),
    )
    .orderBy(fridgeItemsTable.expiresAt)
    .limit(8);

  const [fridgeCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(fridgeItemsTable)
    .where(eq(fridgeItemsTable.userId, user.id));

  const profile = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, user.id))
    .limit(1);

  res.json({
    todayCalories: Math.round(Number(todayTotalsRow.calories) || 0),
    todayProtein: Math.round(Number(todayTotalsRow.protein) || 0),
    todayCarbs: Math.round(Number(todayTotalsRow.carbs) || 0),
    todayFat: Math.round(Number(todayTotalsRow.fat) || 0),
    calorieTarget: profile[0]?.dailyCalorieTarget ?? null,
    recentScans: recentScans.map((s) => ({
      id: s.id,
      foodName: s.foodName,
      calories: s.calories,
      healthScore: s.healthScore,
      imageObjectPath: s.imageObjectPath,
      createdAt: s.createdAt.toISOString(),
    })),
    expiringItems: expiringItems.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      category: i.category,
      expiresAt: i.expiresAt ? i.expiresAt.toISOString() : null,
      notes: i.notes,
      addedAt: i.addedAt.toISOString(),
    })),
    fridgeItemCount: Number(fridgeCountRow.count) || 0,
    scanCount: Number(scanCountRow.count) || 0,
  });
});

interface SuggestionJson {
  title: string;
  reason: string;
  kind: string;
  estimatedCalories: number;
  tags: string[];
}

router.get("/home/suggestions", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const profile = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, user.id))
    .limit(1);
  const memoryDoc = await loadMemory(user.id);
  const facts = [
    ...memoryDoc.stableProfile,
    ...memoryDoc.inferredPreferences,
    ...memoryDoc.contextualState,
  ].slice(0, 20);
  const recentScans = await db
    .select({ foodName: scansTable.foodName, healthScore: scansTable.healthScore })
    .from(scansTable)
    .where(eq(scansTable.userId, user.id))
    .orderBy(desc(scansTable.createdAt))
    .limit(10);
  const fridge = await db
    .select({ name: fridgeItemsTable.name, quantity: fridgeItemsTable.quantity })
    .from(fridgeItemsTable)
    .where(eq(fridgeItemsTable.userId, user.id))
    .limit(20);

  const p = profile[0];
  const dietaryStyle = p?.dietaryStyle ?? "omnivore";
  const allergies = p?.allergies ?? [];
  const dislikes = p?.dislikes ?? [];
  const cuisinePreferences = p?.cuisinePreferences ?? [];
  const healthGoals = p?.healthGoals ?? "";

  let result: { suggestions: SuggestionJson[] };
  try {
    result = await chatJson<{ suggestions: SuggestionJson[] }>({
      system:
        "You are a personal nutritionist suggesting 4 quick, varied meal or snack ideas tailored to the user's profile, memory facts, fridge, and recent eating. Return JSON: { suggestions: [{ title, reason (1 short sentence why this fits this person right now), kind (one of: meal, snack, drink, recipe), estimatedCalories (integer), tags (array of short lowercase strings) }] }. Respect dietary style and avoid allergens/dislikes. Prefer using available fridge items when possible. Return ONLY JSON.",
      user: `Diet: ${dietaryStyle}. Allergies: ${allergies.join(", ") || "none"}. Dislikes: ${
        dislikes.join(", ") || "none"
      }. Preferred cuisines: ${cuisinePreferences.join(", ") || "any"}. Goals: ${
        healthGoals || "general healthy eating"
      }. Memory facts: ${facts.map((f) => `[${f.category}] ${f.content}`).join("; ") || "none"}. Fridge: ${
        fridge.map((i) => `${i.name} (${i.quantity})`).join(", ") || "empty"
      }. Recent meals: ${
        recentScans.map((s) => `${s.foodName} (health ${s.healthScore})`).join(", ") || "none"
      }.`,
    });
  } catch (err) {
    res.status(502).json({
      error: "ai_error",
      message: err instanceof AiError ? err.message : "Suggestion generation failed.",
    });
    return;
  }

  const suggestions = (Array.isArray(result.suggestions) ? result.suggestions : []).map((s, idx) => ({
    id: `suggestion-${Date.now()}-${idx}`,
    title: String(s.title ?? "Suggestion"),
    reason: String(s.reason ?? ""),
    kind: String(s.kind ?? "meal"),
    estimatedCalories: Math.max(0, Math.round(Number(s.estimatedCalories) || 0)),
    tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
  }));
  res.json(suggestions);
});

interface RecipeJson {
  title: string;
  reason: string;
  usedIngredients: string[];
  missingIngredients: string[];
  minutes: number;
}

router.get("/home/recipes", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const profile = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, user.id))
    .limit(1);
  const fridge = await db
    .select({
      name: fridgeItemsTable.name,
      quantity: fridgeItemsTable.quantity,
      expiresAt: fridgeItemsTable.expiresAt,
    })
    .from(fridgeItemsTable)
    .where(eq(fridgeItemsTable.userId, user.id))
    .limit(40);

  if (fridge.length === 0) {
    res.json([]);
    return;
  }

  const memoryDoc = await loadMemory(user.id);
  const facts = [...memoryDoc.stableProfile, ...memoryDoc.inferredPreferences].slice(0, 15);
  const p = profile[0];
  const dietaryStyle = p?.dietaryStyle ?? "omnivore";
  const allergies = p?.allergies ?? [];
  const dislikes = p?.dislikes ?? [];
  const skill = p?.cookingSkill ?? "beginner";
  const household = p?.householdSize ?? 1;

  let result: { recipes: RecipeJson[] };
  try {
    result = await chatJson<{ recipes: RecipeJson[] }>({
      system:
        "You suggest 3 quick recipe ideas the user can make tonight using mostly what's already in their fridge. Prioritise ingredients close to expiring. Return JSON: { recipes: [{ title, reason (1 short sentence), usedIngredients (array of fridge names you'd use), missingIngredients (array of cheap things they'd need to buy, can be empty), minutes (integer cooking time) }] }. Respect dietary style and avoid allergens/dislikes. Match cooking skill. Return ONLY JSON.",
      user: `Diet: ${dietaryStyle}. Skill: ${skill}. Household size: ${household}. Allergies: ${
        allergies.join(", ") || "none"
      }. Dislikes: ${dislikes.join(", ") || "none"}. Fridge (with expiry if known): ${fridge
        .map((i) => `${i.name} (${i.quantity}${i.expiresAt ? `, expires ${i.expiresAt.toISOString().slice(0, 10)}` : ""})`)
        .join(", ")}. Memory: ${facts.map((f) => f.content).join("; ") || "none"}.`,
    });
  } catch (err) {
    res.status(502).json({
      error: "ai_error",
      message: err instanceof AiError ? err.message : "Recipe generation failed.",
    });
    return;
  }

  const recipes = (Array.isArray(result.recipes) ? result.recipes : []).slice(0, 3).map((r, idx) => ({
    id: `recipe-${Date.now()}-${idx}`,
    title: String(r.title ?? "Recipe"),
    reason: String(r.reason ?? ""),
    usedIngredients: Array.isArray(r.usedIngredients) ? r.usedIngredients.map(String) : [],
    missingIngredients: Array.isArray(r.missingIngredients) ? r.missingIngredients.map(String) : [],
    minutes: Math.max(0, Math.round(Number(r.minutes) || 0)),
  }));
  res.json(recipes);
});

export default router;
