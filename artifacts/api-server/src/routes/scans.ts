import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, scansTable, userProfilesTable, type ScanRow, type ScanIngredient } from "@workspace/db";
import { AnalyzeScanBody } from "@workspace/api-zod";
import { chatJson, AiError } from "../lib/ai";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized", message: "Sign in required." });
    return;
  }
  next();
}

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
  ingredients: ScanIngredient[];
  tags: string[];
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
        "You are a precise nutritionist and food vision expert. Analyze the food shown in the image and return a single JSON object with these exact fields: foodName (string), description (1-2 sentence summary string), calories (integer kcal), protein (grams number), carbs (grams number), fat (grams number), fiber (grams number), sugar (grams number), healthScore (integer 0-100, higher is healthier), ingredients (array of {name, amount}), tags (array of short lowercase string tags like 'high-protein', 'vegetarian', 'spicy'). Be conservative with estimates. Return ONLY JSON, no prose.",
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
      ingredients: Array.isArray(analysis.ingredients) ? analysis.ingredients : [],
      tags: Array.isArray(analysis.tags) ? analysis.tags : [],
    })
    .returning();

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
