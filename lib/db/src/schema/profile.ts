import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const ALLERGEN_SEVERITIES = ["mild", "moderate", "severe"] as const;
export type AllergenSeverity = (typeof ALLERGEN_SEVERITIES)[number];

export interface AllergyEntry {
  name: string;
  severity: AllergenSeverity;
}

export const COOKING_SKILLS = ["beginner", "intermediate", "advanced"] as const;
export type CookingSkill = (typeof COOKING_SKILLS)[number];

export const HEALTH_GOALS = [
  "lose_weight",
  "gain_muscle",
  "more_protein",
  "less_sugar",
  "more_plants",
  "more_fiber",
  "balanced_macros",
  "manage_blood_sugar",
  "heart_health",
] as const;
export type HealthGoal = (typeof HEALTH_GOALS)[number];

export const userProfilesTable = pgTable("user_profiles", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  dietaryStyle: text("dietary_style").notNull().default("omnivore"),
  allergies: jsonb("allergies").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  allergiesDetailed: jsonb("allergies_detailed")
    .$type<AllergyEntry[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  dislikes: jsonb("dislikes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  cuisinePreferences: jsonb("cuisine_preferences").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  healthGoals: text("health_goals"),
  healthGoalsList: jsonb("health_goals_list").$type<HealthGoal[]>().notNull().default(sql`'[]'::jsonb`),
  cookingSkill: text("cooking_skill").notNull().default("beginner"),
  householdSize: integer("household_size").notNull().default(1),
  dailyCalorieTarget: integer("daily_calorie_target"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserProfileRow = typeof userProfilesTable.$inferSelect;
export type InsertUserProfile = typeof userProfilesTable.$inferInsert;
