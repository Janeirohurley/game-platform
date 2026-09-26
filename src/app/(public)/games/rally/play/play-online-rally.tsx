"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import type { Room } from "@colyseus/sdk";

import { createRoom } from "@/lib/realtime/client";
import { MatchScreen } from "@/components/realtime/match";
import { RallyRoomView } from "@/games/rally/online/rally-room-view";

interface PlayOnlineRallyProps {
  gameId: string;
  viewerUserId: string;
}

/** Online flow for Rally: a two-seat table, straight into the match screen. */
export function PlayOnlineRally({
  gameId,
  viewerUserId,
}: PlayOnlineRallyProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  if (!room && !error && !gone) {
    void createRoom(gameId, 2)
      .then(setRoom)
      .catch((createError: unknown) =>
        setError(
          createError instanceof Error
            ? createError.message
            : "Création de la table impossible.",
        ),
      );
  }

  if (gone || error) {
    return (
      <div className="flex flex-col gap-3">
        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {gone && (
          <p className="text-sm text-slate-500 dark:text-white/50">
            Tu as quitté la room.
          </p>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="self-start text-sm underline underline-offset-4 text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white"
        >
          Rejouer
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <p
        className="flex items-center gap-2 text-sm text-slate-400 dark:text-white/40"
        role="status"
      >
        <HugeiconsIcon
          icon={Loading03Icon}
          size={16}
          strokeWidth={1.8}
          className="animate-spin"
        />
        Création de la table…
      </p>
    );
  }

  return (
    <MatchScreen
      room={room}
      gameId={gameId}
      viewerUserId={viewerUserId}
      backHref="/games/rally/play"
      backLabel="Retour à Rally"
      onLeft={() => setGone(true)}
    >
      <RallyRoomView
        room={room}
        viewerUserId={viewerUserId}
        onLeave={() => setGone(true)}
      />
    </MatchScreen>
  );
}
