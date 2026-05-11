import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const MEMORY_TIERS = ["stable_profile", "inferred_preferences", "contextual_state"] as const;
export type MemoryTier = (typeof MEMORY_TIERS)[number];

export const MEMORY_SOURCES = ["user", "inferred"] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export interface MemoryItem {
  id: string;
  tier: MemoryTier;
  source: MemorySource;
  category: string;
  content: string;
  createdAt: string;
}

export interface UserMemoryDoc {
  stableProfile: MemoryItem[];
  inferredPreferences: MemoryItem[];
  contextualState: MemoryItem[];
}

export const EMPTY_USER_MEMORY: UserMemoryDoc = {
  stableProfile: [],
  inferredPreferences: [],
  contextualState: [],
};

export const userMemoryTable = pgTable("user_memory", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<UserMemoryDoc>().notNull().default(sql`'{"stableProfile":[],"inferredPreferences":[],"contextualState":[]}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserMemoryRow = typeof userMemoryTable.$inferSelect;

export const memoryEventsTable = pgTable(
  "memory_events",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_memory_events_user").on(table.userId, table.createdAt)],
);

export type MemoryEventRow = typeof memoryEventsTable.$inferSelect;
export type InsertMemoryEvent = typeof memoryEventsTable.$inferInsert;
