import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, memoryFactsTable, type MemoryFactRow } from "@workspace/db";
import { CreateMemoryFactBody } from "@workspace/api-zod";

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
  const [row] = await db
    .insert(memoryFactsTable)
    .values({ userId: user.id, category: parsed.data.category, content: parsed.data.content })
    .returning();
  res.status(201).json(toResponse(row));
});

router.delete("/memory", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  await db.delete(memoryFactsTable).where(eq(memoryFactsTable.userId, user.id));
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
