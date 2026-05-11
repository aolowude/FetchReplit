import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, fridgeItemsTable, userProfilesTable, type FridgeItemRow } from "@workspace/db";
import {
  CreateFridgeItemBody,
  UpdateFridgeItemBody,
  AddFridgeItemsFromImageBody,
  GenerateFridgeRecipesBody,
} from "@workspace/api-zod";
import { chatJson, AiError } from "../lib/ai";
import { logMemoryEvent } from "../lib/memoryEvents";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized", message: "Sign in required." });
    return;
  }
  next();
}

function toResponse(row: FridgeItemRow) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    quantity: row.quantity,
    category: row.category,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    notes: row.notes,
    addedAt: row.addedAt.toISOString(),
  };
}

router.get("/fridge", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const rows = await db
    .select()
    .from(fridgeItemsTable)
    .where(eq(fridgeItemsTable.userId, user.id))
    .orderBy(desc(fridgeItemsTable.addedAt));
  res.json(rows.map(toResponse));
});

router.post("/fridge", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const parsed = CreateFridgeItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }
  const { expiresAt, ...rest } = parsed.data;
  const [row] = await db
    .insert(fridgeItemsTable)
    .values({
      userId: user.id,
      ...rest,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning();
  void logMemoryEvent(user.id, "fridge.added", { id: row.id, name: row.name, category: row.category });
  res.status(201).json(toResponse(row));
});

router.patch("/fridge/:id", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const parsed = UpdateFridgeItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }
  const updates: Record<string, unknown> = { ...parsed.data };
  if ("expiresAt" in parsed.data) {
    updates.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }
  const [row] = await db
    .update(fridgeItemsTable)
    .set(updates)
    .where(and(eq(fridgeItemsTable.userId, user.id), eq(fridgeItemsTable.id, String(req.params.id))))
    .returning();
  if (!row) {
    res.status(404).json({ error: "not_found", message: "Fridge item not found." });
    return;
  }
  res.json(toResponse(row));
});

router.delete("/fridge/:id", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const deleted = await db
    .delete(fridgeItemsTable)
    .where(and(eq(fridgeItemsTable.userId, user.id), eq(fridgeItemsTable.id, String(req.params.id))))
    .returning({ id: fridgeItemsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "not_found", message: "Fridge item not found." });
    return;
  }
  void logMemoryEvent(user.id, "fridge.removed", { id: deleted[0].id });
  res.status(204).send();
});

interface DetectedIngredient {
  name: string;
  quantity: string;
  category: string;
}

router.post("/fridge/from-image", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const parsed = AddFridgeItemsFromImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }
  const { imageDataUrl } = parsed.data;
  if (!imageDataUrl.startsWith("data:image/")) {
    res.status(400).json({ error: "bad_request", message: "imageDataUrl must be a data URL." });
    return;
  }

  let detected: { items: DetectedIngredient[] };
  try {
    detected = await chatJson<{ items: DetectedIngredient[] }>({
      system:
        "You identify groceries and ingredients in a photo (could be inside a fridge, on a counter, or a receipt). Return JSON: { items: [{ name, quantity, category }] }. category must be one of: produce, dairy, meat, seafood, grains, pantry, frozen, beverages, condiments. Use a sensible quantity string like '1', '500g', '2 bottles'. Return ONLY JSON.",
      user: "List every distinct food item visible.",
      imageDataUrl,
    });
  } catch (err) {
    res.status(502).json({
      error: "ai_error",
      message: err instanceof AiError ? err.message : "Vision detection failed.",
    });
    return;
  }

  const items = Array.isArray(detected.items) ? detected.items : [];
  if (items.length === 0) {
    res.json([]);
    return;
  }

  const inserted = await db
    .insert(fridgeItemsTable)
    .values(
      items.slice(0, 30).map((item) => ({
        userId: user.id,
        name: String(item.name ?? "Item"),
        quantity: String(item.quantity ?? "1"),
        category: String(item.category ?? "pantry"),
      })),
    )
    .returning();
  void logMemoryEvent(user.id, "fridge.scanned", { count: inserted.length });
  res.json(inserted.map(toResponse));
});

interface RecipeJson {
  title: string;
  description: string;
  estimatedMinutes: number;
  servings: number;
  calories: number;
  usedIngredients: string[];
  missingIngredients: string[];
  steps: string[];
  tags: string[];
}

router.post("/fridge/recipes", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const parsed = GenerateFridgeRecipesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }
  const { cuisine, maxMinutes } = parsed.data;
  const items = await db
    .select()
    .from(fridgeItemsTable)
    .where(eq(fridgeItemsTable.userId, user.id));
  if (items.length === 0) {
    res.json([]);
    return;
  }
  const profile = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, user.id))
    .limit(1);
  const dietaryStyle = profile[0]?.dietaryStyle ?? "omnivore";
  const allergies = profile[0]?.allergies ?? [];
  const dislikes = profile[0]?.dislikes ?? [];

  let result: { recipes: RecipeJson[] };
  try {
    result = await chatJson<{ recipes: RecipeJson[] }>({
      system:
        "You are a creative home chef. Suggest 3 distinct recipes a person could make right now from their available ingredients. Return JSON: { recipes: [{ title, description, estimatedMinutes (integer), servings (integer), calories (integer per serving), usedIngredients (array of strings, must be from the available list), missingIngredients (array of strings, ideally short), steps (array of clear instruction strings), tags (array of short lowercase strings) }] }. Respect the dietary style and avoid all allergens and dislikes. Prefer recipes that use ingredients near expiry. Return ONLY JSON.",
      user: `Available ingredients: ${items
        .map((i) => `${i.name} (${i.quantity}${i.expiresAt ? `, expires ${i.expiresAt.toISOString().slice(0, 10)}` : ""})`)
        .join(", ")}.\nDiet: ${dietaryStyle}.${
        allergies.length ? ` Allergies: ${allergies.join(", ")}.` : ""
      }${dislikes.length ? ` Dislikes: ${dislikes.join(", ")}.` : ""}${
        cuisine ? ` Preferred cuisine: ${cuisine}.` : ""
      } Maximum ${maxMinutes ?? 45} minutes total time.`,
    });
  } catch (err) {
    res.status(502).json({
      error: "ai_error",
      message: err instanceof AiError ? err.message : "Recipe generation failed.",
    });
    return;
  }

  const recipes = (Array.isArray(result.recipes) ? result.recipes : []).map((r, idx) => ({
    id: `recipe-${Date.now()}-${idx}`,
    title: String(r.title ?? "Recipe"),
    description: String(r.description ?? ""),
    estimatedMinutes: Math.max(5, Math.round(Number(r.estimatedMinutes) || 30)),
    servings: Math.max(1, Math.round(Number(r.servings) || 2)),
    calories: Math.max(0, Math.round(Number(r.calories) || 0)),
    usedIngredients: Array.isArray(r.usedIngredients) ? r.usedIngredients.map(String) : [],
    missingIngredients: Array.isArray(r.missingIngredients) ? r.missingIngredients.map(String) : [],
    steps: Array.isArray(r.steps) ? r.steps.map(String) : [],
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
  }));
  void logMemoryEvent(user.id, "recipe.generated", {
    cuisine: cuisine ?? null,
    maxMinutes: maxMinutes ?? null,
    count: recipes.length,
  });
  res.json(recipes);
});

export default router;
