"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@colyseus/sdk";

import { CheckersRoomView } from "@/games/checkers/online/checkers-room-view";
import { fetchRealtimeToken, getRealtimeClient } from "@/lib/realtime";

export interface JoinOnlineCheckersProps {
  roomId: string;
  viewerUserId: string;
}

/**
 * Client part of the invitation flow: joins the room by id and hands the
 * connection to the Checkers board. Same shape as the Ludo equivalent —
 * the route pattern is the platform's, not the game's.
 */
export function JoinOnlineCheckers({
  roomId,
  viewerUserId,
}: JoinOnlineCheckersProps) {
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

  const handleLeave = useCallback(() => {
    void room?.leave(true);
    router.push("/games/checkers");
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
        <a
          href="/games/checkers"
          className="text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Retour aux dames
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
      <CheckersRoomView
        room={room}
        viewerUserId={viewerUserId}
        onLeave={handleLeave}
      />
    </div>
  );
}
