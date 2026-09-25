import type { Metadata } from "next";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { JoinOnlineCheckers } from "./join-online-checkers";

export const metadata: Metadata = {
  title: "Rejoindre une partie de dames | Game Arena",
  description: "Rejoins une partie de dames en attente d'un adversaire.",
};

interface JoinPageProps {
  params: Promise<{ roomId: string }>;
}

/** Invitation landing page: /games/checkers/join/{roomId} */
export default async function JoinCheckersPage({ params }: JoinPageProps) {
  const { roomId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerUserId = session?.user?.id ?? "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6">
      <JoinOnlineCheckers roomId={roomId} viewerUserId={viewerUserId} />
    </main>
  );
}
