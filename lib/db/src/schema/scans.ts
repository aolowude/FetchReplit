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

export interface DietaryCompliance {
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  pescatarian: boolean;
  keto: boolean;
}

export interface AllergenWarning {
  allergen: string;
  severity: "trace" | "contains" | "may_contain";
  reason: string;
}

export const scansTable = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    imageObjectPath: text("image_object_path").notNull().default(""),
    foodName: text("food_name").notNull(),
    description: text("description").notNull().default(""),
    calories: integer("calories").notNull().default(0),
    protein: doublePrecision("protein").notNull().default(0),
    carbs: doublePrecision("carbs").notNull().default(0),
    fat: doublePrecision("fat").notNull().default(0),
    fiber: doublePrecision("fiber").notNull().default(0),
    sugar: doublePrecision("sugar").notNull().default(0),
    healthScore: integer("health_score").notNull().default(50),
    environmentalScore: integer("environmental_score").notNull().default(50),
    dietaryCompliance: jsonb("dietary_compliance")
      .$type<DietaryCompliance>()
      .notNull()
      .default(sql`'{"vegetarian":false,"vegan":false,"glutenFree":false,"dairyFree":false,"pescatarian":false,"keto":false}'::jsonb`),
    allergens: jsonb("allergens").$type<AllergenWarning[]>().notNull().default(sql`'[]'::jsonb`),
    ingredients: jsonb("ingredients").$type<ScanIngredient[]>().notNull().default(sql`'[]'::jsonb`),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    rawAnalysis: jsonb("raw_analysis").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_scans_user_created").on(table.userId, table.createdAt)],
);

export type ScanRow = typeof scansTable.$inferSelect;
export type InsertScan = typeof scansTable.$inferInsert;
