import type { Metadata } from "next";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { JoinOnlineLudo } from "./join-online-ludo";

export const metadata: Metadata = {
  title: "Rejoindre une partie de Ludo | Game Arena",
  description: "Rejoins une partie de Ludo en cours de recrutement.",
};

interface JoinPageProps {
  params: Promise<{ roomId: string }>;
}

/**
 * Invitation landing page: /games/ludo/join/{roomId}
 * The route shape is generic (game + room) even though this instance
 * belongs to Ludo; other games can reuse the same pattern.
 */
export default async function JoinLudoPage({ params }: JoinPageProps) {
  const { roomId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerUserId = session?.user?.id ?? "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6">
      <JoinOnlineLudo roomId={roomId} viewerUserId={viewerUserId} />
    </main>
  );
}
