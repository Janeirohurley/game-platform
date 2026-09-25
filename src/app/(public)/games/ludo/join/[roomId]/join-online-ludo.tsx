"use client";

import { useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";

import { LudoRoomView } from "@/games/ludo/online/ludo-room-view";
import { getRealtimeClient, fetchRealtimeToken } from "@/lib/realtime";

export interface JoinOnlineLudoProps {
  roomId: string;
  viewerUserId: string;
}

/**
 * Client part of the invitation flow: joins the room by id and hands
 * the connection to the Ludo room view (lobby → board).
 */
export function JoinOnlineLudo({ roomId, viewerUserId }: JoinOnlineLudoProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);

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
            : "Impossible de rejoindre cette room.",
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
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
        <a
          href="/games/ludo"
          className="text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Retour au Ludo
        </a>
      </section>
    );
  }

  if (connecting || !room) {
    return (
      <p className="text-sm text-neutral-400" role="status">
        Connexion à la room…
      </p>
    );
  }

  return (
    <div className="w-full">
      <LudoRoomView
        room={room}
        viewerUserId={viewerUserId}
        onLeave={() => {
          void room.leave(true);
          window.location.href = "/games/ludo";
        }}
      />
    </div>
  );
}
