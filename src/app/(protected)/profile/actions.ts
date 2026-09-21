"use server";

import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/profiles";
import {
  profileSchema,
  type ProfileInput,
} from "@/lib/validation/profile";

type SaveProfileResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

export async function saveProfile(
  input: ProfileInput,
): Promise<SaveProfileResult> {
  const parsed = profileSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: "Invalid profile data.",
    };
  }

  const data = parsed.data;
  const requestHeaders = await headers();

  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session) {
    return {
      success: false,
      message: "Your session has expired. Please sign in again.",
    };
  }

  const username = data.username;
  const displayName =
    data.displayName || data.username;
  const countryCode =
    data.countryCode
      ? data.countryCode.toUpperCase()
      : null;
  const avatarUrl = data.avatarUrl || null;

  const existingUsername = await db
    .select({
      userId: profiles.userId,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.username, username),
        ne(profiles.userId, session.user.id),
      ),
    )
    .limit(1);

  if (existingUsername.length > 0) {
    return {
      success: false,
      message: "That username is already taken.",
    };
  }

  try {
    await auth.api.updateUser({
      body: {
        name: displayName,
        image: avatarUrl,
      },
      headers: requestHeaders,
    });

    const existingProfile = await db
      .select({
        userId: profiles.userId,
      })
      .from(profiles)
      .where(eq(profiles.userId, session.user.id))
      .limit(1);

    if (existingProfile.length > 0) {
      await db
        .update(profiles)
        .set({
          username,
          displayName,
          bio: data.bio || null,
          avatarUrl,
          countryCode,
          isPublic: data.isPublic,
        })
        .where(eq(profiles.userId, session.user.id));
    } else {
      await db.insert(profiles).values({
        userId: session.user.id,
        username,
        displayName,
        bio: data.bio || null,
        avatarUrl,
        countryCode,
        isPublic: data.isPublic,
      });
    }

    revalidatePath("/profile");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Failed to save profile:", error);

    return {
      success: false,
      message: "Unable to save your profile. Please try again.",
    };
  }
}