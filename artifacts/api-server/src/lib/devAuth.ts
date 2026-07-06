// Local (off-Replit) dev auth: when DEV_AUTH=1 is set, every request is
// authenticated as a single hard-coded user. This is gated by an env flag
// and is intended only for running the app on a laptop without Replit's
// OIDC infrastructure. Do NOT enable in production.

import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { logger } from "./logger";
import type { AuthUser } from "@workspace/api-zod";

export const DEV_AUTH_ENABLED = process.env.DEV_AUTH === "1";
export const DEV_USER_ID = "dev-user-local";
export const DEV_USER_EMAIL = "dev@fetch.local";
export const DEV_USER_FIRST_NAME = "Dev";
export const DEV_USER_LAST_NAME = "User";

let devUserEnsured: Promise<AuthUser> | null = null;

export async function getDevUser(): Promise<AuthUser> {
  if (!devUserEnsured) {
    devUserEnsured = (async () => {
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, DEV_USER_ID))
        .limit(1);

      if (existing) {
        return {
          id: existing.id,
          email: existing.email,
          firstName: existing.firstName,
          lastName: existing.lastName,
          profileImageUrl: existing.profileImageUrl,
        };
      }

      logger.info(
        { userId: DEV_USER_ID },
        "DEV_AUTH: bootstrapping local dev user in users table",
      );

      const [created] = await db
        .insert(usersTable)
        .values({
          id: DEV_USER_ID,
          email: DEV_USER_EMAIL,
          firstName: DEV_USER_FIRST_NAME,
          lastName: DEV_USER_LAST_NAME,
          profileImageUrl: null,
        })
        .onConflictDoNothing()
        .returning();

      const row = created ?? existing;
      return {
        id: row.id,
        email: row.email,
        firstName: row.firstName,
        lastName: row.lastName,
        profileImageUrl: row.profileImageUrl,
      };
    })();
  }
  return devUserEnsured;
}
