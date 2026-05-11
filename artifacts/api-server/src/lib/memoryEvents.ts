import { db, memoryEventsTable } from "@workspace/db";
import { logger } from "./logger";

export type MemoryEventType =
  | "scan.completed"
  | "fridge.added"
  | "fridge.removed"
  | "fridge.scanned"
  | "recipe.generated"
  | "memory.fact_added"
  | "memory.fact_inferred"
  | "memory.cleared"
  | "profile.updated";

export async function logMemoryEvent(
  userId: string,
  type: MemoryEventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.insert(memoryEventsTable).values({ userId, type, payload });
  } catch (err) {
    logger.warn({ err, type, userId }, "memory event log failed");
  }
}
