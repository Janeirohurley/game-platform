import type { Metadata } from "next";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { isGamePlayableOnline } from "@/lib/games/registry";
import { GameUnavailableNotice } from "@/components/game-unavailable-notice";
import { JoinOnlineRally } from "./join-online-rally";

export const metadata: Metadata = {
  title: "Rejoindre une partie de Rally | Game Arena",
  description: "Rejoins une table de tennis de table en attente d'un adversaire.",
};

interface JoinPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function JoinRallyPage({ params }: JoinPageProps) {
  const { roomId } = await params;

  // Same gate as /play: an invite to a game in development goes nowhere.
  if (!isGamePlayableOnline("rally")) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6">
        <GameUnavailableNotice
          gameTitle="Rally"
          backHref="/games"
          backLabel="Retour au catalogue"
        />
      </main>
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const viewerUserId = session?.user?.id ?? "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6">
      <JoinOnlineRally roomId={roomId} viewerUserId={viewerUserId} />
    </main>
  );
}
