import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable, type UserProfileRow } from "@workspace/db";
import { UpdateProfileBody } from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "unauthorized", message: "Sign in required." });
    return;
  }
  next();
}

function toResponse(row: UserProfileRow) {
  return {
    userId: row.userId,
    displayName: row.displayName,
    dietaryStyle: row.dietaryStyle,
    allergies: row.allergies,
    dislikes: row.dislikes,
    cuisinePreferences: row.cuisinePreferences,
    healthGoals: row.healthGoals,
    dailyCalorieTarget: row.dailyCalorieTarget,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOrCreateProfile(userId: string): Promise<UserProfileRow> {
  const existing = await db
    .select()
    .from(userProfilesTable)
    .where(eq(userProfilesTable.userId, userId))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(userProfilesTable)
    .values({ userId })
    .returning();
  return created;
}

router.get("/profile", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const profile = await getOrCreateProfile(user.id);
  res.json(toResponse(profile));
});

router.patch("/profile", requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }
  await getOrCreateProfile(user.id);
  const [updated] = await db
    .update(userProfilesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(userProfilesTable.userId, user.id))
    .returning();
  res.json(toResponse(updated));
});

export default router;
