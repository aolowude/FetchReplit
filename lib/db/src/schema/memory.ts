import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const MEMORY_TIERS = ["stable_profile", "inferred_preferences", "contextual_state"] as const;
export type MemoryTier = (typeof MEMORY_TIERS)[number];

export const MEMORY_SOURCES = ["user", "inferred"] as const;
export type MemorySource = (typeof MEMORY_SOURCES)[number];

export const memoryFactsTable = pgTable(
  "memory_facts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tier: text("tier").notNull().default("stable_profile"),
    source: text("source").notNull().default("user"),
    category: text("category").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_memory_facts_user").on(table.userId, table.createdAt)],
);

export type MemoryFactRow = typeof memoryFactsTable.$inferSelect;
export type InsertMemoryFact = typeof memoryFactsTable.$inferInsert;

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
