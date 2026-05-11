import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  userMemoryTable,
  EMPTY_USER_MEMORY,
  MEMORY_TIERS,
  type UserMemoryDoc,
  type MemoryItem,
  type MemoryTier,
} from "@workspace/db";
import { CreateMemoryFactBody } from "@workspace/api-zod";
import { logMemoryEvent } from "../lib/memoryEvents";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized", message: "Sign in required." });
    return;
  }
  next();
}

const TIER_KEY: Record<MemoryTier, keyof UserMemoryDoc> = {
  stable_profile: "stableProfile",
  inferred_preferences: "inferredPreferences",
  contextual_state: "contextualState",
};

export async function loadMemory(userId: string): Promise<UserMemoryDoc> {
  const rows = await db
    .select()
    .from(userMemoryTable)
    .where(eq(userMemoryTable.userId, userId))
    .limit(1);
  if (!rows[0]) {
    await db.insert(userMemoryTable).values({ userId }).onConflictDoNothing();
    return { ...EMPTY_USER_MEMORY };
  }
  const data = rows[0].data ?? EMPTY_USER_MEMORY;
  return {
    stableProfile: Array.isArray(data.stableProfile) ? data.stableProfile : [],
    inferredPreferences: Array.isArray(data.inferredPreferences) ? data.inferredPreferences : [],
    contextualState: Array.isArray(data.contextualState) ? data.contextualState : [],
  };
}

async function saveMemory(userId: string, data: UserMemoryDoc): Promise<void> {
  await db
    .insert(userMemoryTable)
    .values({ userId, data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userMemoryTable.userId,
      set: { data, updatedAt: new Date() },
    });
}

export async function appendMemoryItem(
  userId: string,
  tier: MemoryTier,
  item: { category: string; content: string; source: "user" | "inferred" },
): Promise<MemoryItem> {
  const doc = await loadMemory(userId);
  const newItem: MemoryItem = {
    id: randomUUID(),
    tier,
    source: item.source,
    category: item.category,
    content: item.content,
    createdAt: new Date().toISOString(),
  };
  doc[TIER_KEY[tier]] = [newItem, ...doc[TIER_KEY[tier]]].slice(0, 200);
  await saveMemory(userId, doc);
  return newItem;
}

router.get("/memory", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const doc = await loadMemory(user.id);
  res.json(doc);
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
  const item = await appendMemoryItem(user.id, tier, {
    category: parsed.data.category,
    content: parsed.data.content,
    source: "user",
  });
  void logMemoryEvent(user.id, "memory.fact_added", { id: item.id, content: item.content, tier });
  res.status(201).json(item);
});

router.delete("/memory", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  await saveMemory(user.id, { ...EMPTY_USER_MEMORY });
  void logMemoryEvent(user.id, "memory.cleared", {});
  res.status(204).send();
});

router.delete("/memory/:id", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const id = String(req.params.id);
  const doc = await loadMemory(user.id);
  let removed = false;
  for (const key of Object.keys(doc) as (keyof UserMemoryDoc)[]) {
    const before = doc[key].length;
    doc[key] = doc[key].filter((it) => it.id !== id);
    if (doc[key].length !== before) removed = true;
  }
  if (!removed) {
    res.status(404).json({ error: "not_found", message: "Memory fact not found." });
    return;
  }
  await saveMemory(user.id, doc);
  res.status(204).send();
});

export default router;
