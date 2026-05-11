import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const memoryFactsTable = pgTable(
  "memory_facts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_memory_facts_user").on(table.userId, table.createdAt)],
);

export type MemoryFactRow = typeof memoryFactsTable.$inferSelect;
export type InsertMemoryFact = typeof memoryFactsTable.$inferInsert;
