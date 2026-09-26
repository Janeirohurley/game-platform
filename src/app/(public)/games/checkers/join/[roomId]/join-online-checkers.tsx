"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@colyseus/sdk";

import {
  fetchRealtimeToken,
  getRealtimeClient,
  watchRoom,
} from "@/lib/realtime";
import { MatchScreen } from "@/components/realtime/match";
import { CheckersRoomView } from "@/games/checkers/online/checkers-room-view";

export interface JoinOnlineCheckersProps {
  roomId: string;
  viewerUserId: string;
}

type JoinChoice = null | "play" | "watch";

/**
 * Client part of the invitation flow (spec sections 4 and 7): join as a
 * player (admin approval required, read-only pending view meanwhile) or
 * watch as a spectator immediately. Both land in the match screen.
 */
export function JoinOnlineCheckers({
  roomId,
  viewerUserId,
}: JoinOnlineCheckersProps) {
  const router = useRouter();
  const [choice, setChoice] = useState<JoinChoice>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!choice) {
    return (
      <section className="flex w-full max-w-md flex-col gap-4 text-center">
        <h1 className="text-lg font-semibold text-white">
          Rejoindre la partie de dames
        </h1>
        <p className="text-sm text-white/50">
          Choisis comment participer. Les joueurs doivent être acceptés par le
          créateur ; regarder est libre et sans compte.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setChoice("play")}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Rejoindre comme joueur
          </button>
          <button
            type="button"
            onClick={() => setChoice("watch")}
            className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            Regarder (sans compte)
          </button>
        </div>
      </section>
    );
  }

  if (!room && !error) {
    void (async () => {
      try {
        // Watching needs no account — guest token, straight in. Playing
        // needs one: the platform must know who would sit at the table.
        const joined =
          choice === "watch"
            ? await watchRoom(roomId)
            : await getRealtimeClient().joinById(roomId, {
                token: await fetchRealtimeToken(),
                mode: "play",
              });
        setRoom(joined);
      } catch (joinError) {
        setError(
          joinError instanceof Error
            ? joinError.message
            : "Impossible de rejoindre cette partie.",
        );
      }
    })();

    return (
      <p className="text-sm text-neutral-400" role="status">
        Connexion à la partie…
      </p>
    );
  }

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

  if (!room) return null;

  return (
    <MatchScreen
      room={room}
      gameId="checkers"
      viewerUserId={viewerUserId}
      backHref="/games/checkers/play"
      backLabel="Retour aux dames"
      onLeft={() => {
        router.push("/games/checkers");
      }}
    >
      <CheckersRoomView
        room={room}
        viewerUserId={viewerUserId}
        onLeave={() => {
          router.push("/games/checkers");
        }}
      />
    </MatchScreen>
  );
}
