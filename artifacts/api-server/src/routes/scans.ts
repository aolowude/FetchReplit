import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  scansTable,
  userProfilesTable,
  memoryFactsTable,
  type ScanRow,
  type ScanIngredient,
  type DietaryCompliance,
  type AllergenWarning,
} from "@workspace/db";
import { AnalyzeScanBody } from "@workspace/api-zod";
import { chatJson, AiError } from "../lib/ai";
import { logMemoryEvent } from "../lib/memoryEvents";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized", message: "Sign in required." });
    return;
  }
  next();
}

const EMPTY_COMPLIANCE: DietaryCompliance = {
  vegetarian: false,
  vegan: false,
  glutenFree: false,
  dairyFree: false,
  pescatarian: false,
  keto: false,
};

function toResponse(row: ScanRow) {
  return {
    id: row.id,
    userId: row.userId,
    imageDataUrl: row.imageDataUrl,
    foodName: row.foodName,
    description: row.description,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    sugar: row.sugar,
    healthScore: row.healthScore,
    environmentalScore: row.environmentalScore,
    dietaryCompliance: row.dietaryCompliance,
    allergens: row.allergens,
    ingredients: row.ingredients,
    tags: row.tags,
    createdAt: row.createdAt.toISOString(),
  };
}

interface ScanAnalysis {
  foodName: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  healthScore: number;
  environmentalScore: number;
  dietaryCompliance: Partial<DietaryCompliance>;
  allergens: AllergenWarning[];
  ingredients: ScanIngredient[];
  tags: string[];
}

function normaliseCompliance(input: Partial<DietaryCompliance> | undefined): DietaryCompliance {
  return {
    vegetarian: Boolean(input?.vegetarian),
    vegan: Boolean(input?.vegan),
    glutenFree: Boolean(input?.glutenFree),
    dairyFree: Boolean(input?.dairyFree),
    pescatarian: Boolean(input?.pescatarian),
    keto: Boolean(input?.keto),
  };
}

function normaliseAllergens(input: AllergenWarning[] | undefined): AllergenWarning[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((a) => a && typeof a.allergen === "string" && a.allergen.trim() !== "")
    .map<AllergenWarning>((a) => ({
      allergen: String(a.allergen),
      severity:
        a.severity === "contains" || a.severity === "trace" ? a.severity : "may_contain",
      reason: String(a.reason ?? ""),
    }))
    .slice(0, 10);
}

interface InferredFact {
  category: string;
  content: string;
}

async function inferAndStoreMemory(
  userId: string,
  scan: ScanRow,
  context: { dietaryStyle: string; recentMemory: string[] },
): Promise<void> {
  try {
    const result = await chatJson<{ facts: InferredFact[] }>({
      system:
        "You silently learn about a diner from a single meal scan. Look for stable preferences worth remembering long-term: cuisines they favour, ingredients they enjoy, eating patterns, portion habits. Be conservative — return AT MOST 1 fact, or an empty array if nothing meaningful. Never repeat anything already known. Return JSON: { facts: [{ category, content }] }.",
      user: `Diet: ${context.dietaryStyle}.
Already known: ${context.recentMemory.join(" | ") || "(nothing)"}.
This meal: ${scan.foodName} — ${scan.description}. Tags: ${scan.tags.join(", ") || "none"}.`,
    });
    const facts = Array.isArray(result.facts) ? result.facts.slice(0, 1) : [];
    for (const f of facts) {
      const content = String(f.content ?? "").trim();
      if (!content) continue;
      await db.insert(memoryFactsTable).values({
        userId,
        tier: "inferred_preferences",
        source: "inferred",
        category: String(f.category ?? "preference"),
        content,
      });
      await logMemoryEvent(userId, "memory.fact_inferred", { content, scanId: scan.id });
    }
  } catch (err) {
    logger.warn({ err, userId, scanId: scan.id }, "post-scan memory inference failed");
  }
}

router.post("/scans/analyze", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const parsed = AnalyzeScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }
  const { imageDataUrl, note } = parsed.data;
  if (!imageDataUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "bad_request", message: "imageDataUrl must be a data URL." });
    return;
  }
  const profile = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, user.id))
    .limit(1);
  const dietaryStyle = profile[0]?.dietaryStyle ?? "omnivore";
  const allergies = profile[0]?.allergies ?? [];
  const noteLine = note ? `\nUser note: ${note}` : "";

  let analysis: ScanAnalysis;
  try {
    analysis = await chatJson<ScanAnalysis>({
      system:
        "You are a precise nutritionist and food vision expert. Analyze the food shown in the image and return a single JSON object with exact fields: foodName (string), description (1-2 sentence summary string), calories (integer kcal), protein (g number), carbs (g number), fat (g number), fiber (g number), sugar (g number), healthScore (integer 0-100, higher is healthier), environmentalScore (integer 0-100, higher means lower environmental impact: plant-forward and local scores higher than red meat / heavily processed), dietaryCompliance (object with booleans: vegetarian, vegan, glutenFree, dairyFree, pescatarian, keto), allergens (array of { allergen (string, e.g. peanuts, dairy, gluten, shellfish, soy, eggs, tree_nuts), severity ('contains'|'trace'|'may_contain'), reason (short string) } — only include allergens you actually see; ALWAYS include any of the diner's known allergies if present), ingredients (array of {name, amount}), tags (array of short lowercase strings like 'high-protein', 'spicy', 'comfort'). Be conservative. Return ONLY JSON.",
      user: `Analyze this meal photo. The diner follows a ${dietaryStyle} diet${
        allergies.length ? ` and is allergic to: ${allergies.join(", ")}` : ""
      }.${noteLine}`,
      imageDataUrl,
    });
  } catch (err) {
    res.status(502).json({
      error: "ai_error",
      message: err instanceof AiError ? err.message : "Vision analysis failed.",
    });
    return;
  }

  const compliance = normaliseCompliance(analysis.dietaryCompliance);
  const allergens = normaliseAllergens(analysis.allergens);

  const [row] = await db
    .insert(scansTable)
    .values({
      userId: user.id,
      imageDataUrl,
      foodName: String(analysis.foodName ?? "Unknown dish"),
      description: String(analysis.description ?? ""),
      calories: Math.max(0, Math.round(Number(analysis.calories) || 0)),
      protein: Math.max(0, Number(analysis.protein) || 0),
      carbs: Math.max(0, Number(analysis.carbs) || 0),
      fat: Math.max(0, Number(analysis.fat) || 0),
      fiber: Math.max(0, Number(analysis.fiber) || 0),
      sugar: Math.max(0, Number(analysis.sugar) || 0),
      healthScore: Math.min(100, Math.max(0, Math.round(Number(analysis.healthScore) || 50))),
      environmentalScore: Math.min(100, Math.max(0, Math.round(Number(analysis.environmentalScore) || 50))),
      dietaryCompliance: compliance,
      allergens,
      ingredients: Array.isArray(analysis.ingredients) ? analysis.ingredients : [],
      tags: Array.isArray(analysis.tags) ? analysis.tags : [],
      rawAnalysis: analysis as unknown as Record<string, unknown>,
    })
    .returning();

  void logMemoryEvent(user.id, "scan.completed", {
    scanId: row.id,
    foodName: row.foodName,
    healthScore: row.healthScore,
  });

  // Fire-and-forget memory inference; don't block the user.
  const recentFacts = await db
    .select()
    .from(memoryFactsTable)
    .where(eq(memoryFactsTable.userId, user.id))
    .orderBy(desc(memoryFactsTable.createdAt))
    .limit(15);
  void inferAndStoreMemory(user.id, row, {
    dietaryStyle,
    recentMemory: recentFacts.map((f) => f.content),
  });

  res.json(toResponse(row));
});

router.get("/scans", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const rows = await db
    .select()
    .from(scansTable)
    .where(eq(scansTable.userId, user.id))
    .orderBy(desc(scansTable.createdAt));
  res.json(rows.map(toResponse));
});

router.get("/scans/:id", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const rows = await db
    .select()
    .from(scansTable)
    .where(and(eq(scansTable.userId, user.id), eq(scansTable.id, String(req.params.id))))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "not_found", message: "Scan not found." });
    return;
  }
  res.json(toResponse(rows[0]));
});

router.delete("/scans/:id", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const deleted = await db
    .delete(scansTable)
    .where(and(eq(scansTable.userId, user.id), eq(scansTable.id, String(req.params.id))))
    .returning({ id: scansTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "not_found", message: "Scan not found." });
    return;
  }
  res.status(204).send();
});

export default router;
