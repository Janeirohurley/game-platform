import type { Metadata } from "next";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
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
  const session = await auth.api.getSession({ headers: await headers() });
  const viewerUserId = session?.user?.id ?? "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-950 p-6">
      <JoinOnlineRally roomId={roomId} viewerUserId={viewerUserId} />
    </main>
  );
}
