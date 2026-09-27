"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/profiles";
import { isGameId } from "@/lib/games/registry";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";
import {
  isGamerTagAvailable,
  ensureProfileForUser,
  getProfileByUserId,
} from "./queries";

/**
 * Profile server actions — the ONLY mutations a signed-in user can make
 * to their gamer profile. Every path re-checks the session server-side;
 * nothing here accepts user ids from the client, and progression
 * numbers (level/xp/rating/stats) are structurally absent from the
 * input schema, so a forged payload cannot touch them.
 */

type SaveProfileResult =
  | { success: true }
  | { success: false; message: string };

/** How long a released gamerTag stays reserved for its previous owner. */
const GAMERTAG_QUARANTINE_DAYS = 14;

async function requireUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function saveProfile(
  input: ProfileInput,
): Promise<SaveProfileResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Invalid profile data." };
  }

  const userId = await requireUserId();
  if (!userId) {
    return {
      success: false,
      message: "Your session has expired. Please sign in again.",
    };
  }

  const data = parsed.data;
  const username = data.username;
  const displayName = data.displayName || data.username;
  const countryCode = data.countryCode ? data.countryCode.toUpperCase() : null;
  const avatarUrl = data.avatarUrl || null;

  await ensureProfileForUser(userId, displayName);

  // Ownership (case-insensitive): someone else's LIVE tag is refused.
  // The DB expression index on lower(username) remains the last line.
  const available = await isGamerTagAvailable(username, userId);
  if (!available) {
    return { success: false, message: "That gamer tag is already taken." };
  }

  // Quarantine: a tag someone gave up less than 14 days ago stays
  // reserved for them (squatter protection on released names).
  const recentlyReleased = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .where(
      sql`lower(${profiles.previousUsername}) = lower(${username})
        and ${profiles.usernameChangedAt} is not null
        and ${profiles.usernameChangedAt} > now() - interval '${sql.raw(
          String(GAMERTAG_QUARANTINE_DAYS),
        )} days'`,
    )
    .limit(1);

  if (recentlyReleased.length > 0) {
    return {
      success: false,
      message:
        "That gamer tag was recently released — it stays reserved for a few days.",
    };
  }

  try {
    await auth.api.updateUser({
      body: { name: displayName, image: avatarUrl },
      headers: await headers(),
    });

    const current = await getProfileByUserId(userId);

    // Quarantine bookkeeping: when the tag changes, the old one is
    // remembered with its release date.
    const tagChanged = Boolean(current && current.username !== username);
    const payload = {
      username,
      previousUsername: tagChanged
        ? current!.username
        : current?.previousUsername ?? null,
      usernameChangedAt: tagChanged
        ? new Date()
        : current?.usernameChangedAt ?? null,
      displayName,
      bio: data.bio || null,
      avatarUrl,
      countryCode,
      coverUrl: data.coverUrl || null,
      languages: data.languages?.length ? data.languages : null,
      favoriteGames: (data.favoriteGames ?? []).filter(isGameId),
      isPublic: data.isPublic,
    };

    if (current) {
      await db.update(profiles).set(payload).where(eq(profiles.userId, userId));
    } else {
      await db.insert(profiles).values({ userId, ...payload });
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("Failed to save profile:", error);
    return {
      success: false,
      message: "Unable to save your profile. Please try again.",
    };
  }
}

/**
 * Count a private-profile visit for the owner's "visites privées"
 * indicator. Only the session holder's action on someone else's
 * profile — the target is never taken from untrusted input elsewhere.
 */
export async function visitPrivateProfile(
  targetUserId: string,
): Promise<{ success: boolean }> {
  const userId = await requireUserId();
  if (!userId || userId === targetUserId) return { success: false };

  await db
    .update(profiles)
    .set({ privateVisits: sql`${profiles.privateVisits} + 1` })
    .where(eq(profiles.userId, targetUserId));
  return { success: true };
}

export async function saveFavoriteGames(
  gameIds: string[],
): Promise<SaveProfileResult> {
  const userId = await requireUserId();
  if (!userId) {
    return {
      success: false,
      message: "Your session has expired. Please sign in again.",
    };
  }

  const favorites = [...new Set(gameIds)].filter(isGameId);
  await ensureProfileForUser(userId, "Player");
  await db
    .update(profiles)
    .set({ favoriteGames: favorites.length ? favorites : null })
    .where(eq(profiles.userId, userId));

  revalidatePath("/profile");
  return { success: true };
}
