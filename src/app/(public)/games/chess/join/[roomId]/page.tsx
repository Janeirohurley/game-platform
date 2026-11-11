import type { Metadata } from "next";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { isGamePlayableOnline } from "@/lib/games/registry";
import { GameUnavailableNotice } from "@/components/game-unavailable-notice";
import { JoinOnlineChess } from "./join-online-chess";

export const metadata: Metadata = {
  title: "Rejoindre une partie d'échecs | Game Arena",
  description: "Rejoins une partie d'échecs en attente d'un adversaire.",
};

interface JoinPageProps {
  params: Promise<{ roomId: string }>;
}

/** Invitation landing page: /games/chess/join/{roomId} */
export default async function JoinChessPage({ params }: JoinPageProps) {
  const { roomId } = await params;

  // Same gate as /play: an invite to a game in development goes nowhere.
  if (!isGamePlayableOnline("chess")) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6">
        <GameUnavailableNotice
          gameTitle="Chess"
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
      <JoinOnlineChess roomId={roomId} viewerUserId={viewerUserId} />
    </main>
  );
}
