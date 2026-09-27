import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ensureProfileForUser } from "@/lib/profile/queries";
import { readPublicGamerProfile } from "@/lib/profile/read-model";
import ProfilePageClient from "./profile-page-client";

/**
 * Owner profile page — the gamer profile with edit + security tabs.
 * The owner sees everything; the public sees /profile/[username].
 */
export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  // Old accounts get their gamer profile on first visit — honest
  // defaults, no fake stats (see ensureProfileForUser).
  await ensureProfileForUser(session.user.id, session.user.name);

  const data = await readPublicGamerProfile(session.user.id, {
    viewerUserId: session.user.id,
    isOwner: true,
  });

  return <ProfilePageClient data={data} />;
}
