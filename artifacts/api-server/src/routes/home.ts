import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import {
  db,
  scansTable,
  fridgeItemsTable,
  memoryFactsTable,
  userProfilesTable,
} from "@workspace/db";
import { chatJson, AiError } from "../lib/ai";

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
      imageDataUrl: s.imageDataUrl,
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
  const facts = await db
    .select()
    .from(memoryFactsTable)
    .where(eq(memoryFactsTable.userId, user.id))
    .orderBy(desc(memoryFactsTable.createdAt))
    .limit(20);
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

export default router;
