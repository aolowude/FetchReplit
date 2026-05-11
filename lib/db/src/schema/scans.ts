import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export interface ScanIngredient {
  name: string;
  amount: string;
}

export const scansTable = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    imageDataUrl: text("image_data_url").notNull(),
    foodName: text("food_name").notNull(),
    description: text("description").notNull().default(""),
    calories: integer("calories").notNull().default(0),
    protein: doublePrecision("protein").notNull().default(0),
    carbs: doublePrecision("carbs").notNull().default(0),
    fat: doublePrecision("fat").notNull().default(0),
    fiber: doublePrecision("fiber").notNull().default(0),
    sugar: doublePrecision("sugar").notNull().default(0),
    healthScore: integer("health_score").notNull().default(50),
    ingredients: jsonb("ingredients").$type<ScanIngredient[]>().notNull().default(sql`'[]'::jsonb`),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_scans_user_created").on(table.userId, table.createdAt)],
);

export type ScanRow = typeof scansTable.$inferSelect;
export type InsertScan = typeof scansTable.$inferInsert;
