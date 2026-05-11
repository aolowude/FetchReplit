import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const fridgeItemsTable = pgTable(
  "fridge_items",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: text("quantity").notNull().default("1"),
    category: text("category").notNull().default("pantry"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    notes: text("notes"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_fridge_user_added").on(table.userId, table.addedAt)],
);

export type FridgeItemRow = typeof fridgeItemsTable.$inferSelect;
export type InsertFridgeItem = typeof fridgeItemsTable.$inferInsert;
