import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/profiles";
import ProfilePageClient from "./profile-page-client";



export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  const profileResult = await db
    .select({
      username: profiles.username,
      displayName: profiles.displayName,
      bio: profiles.bio,
      avatarUrl: profiles.avatarUrl,
      countryCode: profiles.countryCode,
      isPublic: profiles.isPublic,
      createdAt: profiles.createdAt,
      updatedAt: profiles.updatedAt,
    })
    .from(profiles)
    .where(eq(profiles.userId, session.user.id))
    .limit(1);

  const profile = profileResult[0] ?? null;

  return (
    <ProfilePageClient
      initialSession={session}
      initialProfile={profile}
    />
  );
}