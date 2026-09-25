"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@colyseus/sdk";

import { RallyRoomView } from "@/games/rally/online/rally-room-view";
import { fetchRealtimeToken, getRealtimeClient } from "@/lib/realtime";

export interface JoinOnlineRallyProps {
  roomId: string;
  viewerUserId: string;
}

/** Invitation flow: join the table by id, then play. */
export function JoinOnlineRally({ roomId, viewerUserId }: JoinOnlineRallyProps) {
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  const handleLeave = useCallback(() => {
    void room?.leave(true);
    router.push("/games/rally");
  }, [room, router]);

  useEffect(() => {
    let disposed = false;

    const join = async () => {
      try {
        const token = await fetchRealtimeToken();
        const joined = await getRealtimeClient().joinById(roomId, { token });
        if (disposed) {
          void joined.leave();
          return;
        }
        setRoom(joined);
      } catch (joinError) {
        if (disposed) return;
        setError(
          joinError instanceof Error
            ? joinError.message
            : "Impossible de rejoindre cette partie.",
        );
      } finally {
        if (!disposed) setConnecting(false);
      }
    };

    void join();
    return () => {
      disposed = true;
    };
  }, [roomId]);

  if (error) {
    return (
      <section className="flex w-full max-w-md flex-col gap-4 text-center">
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
        <a href="/games/rally" className="text-sm text-neutral-400 underline hover:text-neutral-200">
          Retour à Rally
        </a>
      </section>
    );
  }

  if (connecting || !room) {
    return (
      <p className="text-sm text-neutral-400" role="status">
        Connexion à la partie…
      </p>
    );
  }

  return (
    <div className="w-full">
      <RallyRoomView room={room} viewerUserId={viewerUserId} onLeave={handleLeave} />
    </div>
  );
}
