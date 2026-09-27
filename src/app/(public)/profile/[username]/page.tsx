import type { Metadata } from "next";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getProfileByUsername } from "@/lib/profile/queries";
import { readPublicGamerProfile } from "@/lib/profile/read-model";
import { GamerProfileHeader } from "@/components/profile/gamer-profile-header";
import { ProfileStatsStrip } from "@/components/profile/profile-stats-strip";
import { ProfileGamesPanel } from "@/components/profile/profile-games-panel";
import { ProfileAchievementsPanel } from "@/components/profile/profile-achievements-panel";
import { ProfileActivityPanel } from "@/components/profile/profile-activity-panel";
import { PrivateProfileNotice } from "@/components/profile/private-profile-notice";

interface PublicProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({
  params,
}: PublicProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username} | Game Arena`,
    description: `Profil de @${username} sur Game Arena — parties, statistiques et achievements.`,
  };
}

/**
 * Public gamer profile — /profile/<gamerTag>.
 *
 * The route resolves case-insensitively; the canonical casing lives on
 * the profile row. Only what `readPublicGamerProfile` shapes is ever
 * exposed: no email, no internal ids beyond the tag itself, no auth
 * data, nothing private.
 */
export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { username } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerUserId = session?.user.id ?? null;

  const profile = await getProfileByUsername(username);
  if (!profile) {
    return <PrivateProfileNotice variant="not-found" gamerTag={username} />;
  }

  const isOwner = viewerUserId !== null && viewerUserId === profile.userId;

  if (!profile.isPublic && !isOwner) {
    return (
      <PrivateProfileNotice
        variant="private"
        gamerTag={profile.username}
        targetUserId={profile.userId}
      />
    );
  }

  const data = await readPublicGamerProfile(profile.userId, {
    viewerUserId,
    isOwner,
  });

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 dark:bg-[#05070b] dark:text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <GamerProfileHeader data={data} isOwner={isOwner} />
        <ProfileStatsStrip data={data} />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="space-y-6">
            <ProfileAchievementsPanel achievements={data.achievements} />
            <ProfileActivityPanel activity={data.activity} />
          </div>
          <div className="space-y-6">
            <ProfileGamesPanel games={data.games} />
          </div>
        </div>
      </div>
    </main>
  );
}
