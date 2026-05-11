import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const userProfilesTable = pgTable("user_profiles", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  dietaryStyle: text("dietary_style").notNull().default("omnivore"),
  allergies: jsonb("allergies").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  dislikes: jsonb("dislikes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  cuisinePreferences: jsonb("cuisine_preferences").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  healthGoals: text("health_goals"),
  dailyCalorieTarget: integer("daily_calorie_target"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserProfileRow = typeof userProfilesTable.$inferSelect;
export type InsertUserProfile = typeof userProfilesTable.$inferInsert;
