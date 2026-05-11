import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, memoryFactsTable, MEMORY_TIERS, type MemoryFactRow, type MemoryTier } from "@workspace/db";
import { CreateMemoryFactBody } from "@workspace/api-zod";
import { logMemoryEvent } from "../lib/memoryEvents";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized", message: "Sign in required." });
    return;
  }
  next();
}

function toResponse(row: MemoryFactRow) {
  return {
    id: row.id,
    tier: row.tier as MemoryTier,
    source: row.source as "user" | "inferred",
    category: row.category,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/memory", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const rows = await db
    .select()
    .from(memoryFactsTable)
    .where(eq(memoryFactsTable.userId, user.id))
    .orderBy(desc(memoryFactsTable.createdAt));
  res.json(rows.map(toResponse));
});

router.post("/memory", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const parsed = CreateMemoryFactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }
  const tier: MemoryTier = MEMORY_TIERS.includes(parsed.data.tier as MemoryTier)
    ? (parsed.data.tier as MemoryTier)
    : "stable_profile";
  const [row] = await db
    .insert(memoryFactsTable)
    .values({
      userId: user.id,
      tier,
      source: "user",
      category: parsed.data.category,
      content: parsed.data.content,
    })
    .returning();
  void logMemoryEvent(user.id, "memory.fact_added", { id: row.id, content: row.content });
  res.status(201).json(toResponse(row));
});

router.delete("/memory", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  await db.delete(memoryFactsTable).where(eq(memoryFactsTable.userId, user.id));
  void logMemoryEvent(user.id, "memory.cleared", {});
  res.status(204).send();
});

router.delete("/memory/:id", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const id = String(req.params.id);
  const deleted = await db
    .delete(memoryFactsTable)
    .where(and(eq(memoryFactsTable.userId, user.id), eq(memoryFactsTable.id, id)))
    .returning({ id: memoryFactsTable.id });
  if (deleted.length === 0) {
    res.status(404).json({ error: "not_found", message: "Memory fact not found." });
    return;
  }
  res.status(204).send();
});

export default router;
