"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@colyseus/sdk";

import {
  fetchRealtimeToken,
  getRealtimeClient,
  reconnectRoom,
  watchRoom,
} from "@/lib/realtime";
import {
  clearRoomSession,
  persistRoomSession,
  readRoomSession,
} from "@/lib/realtime/session-url";
import { LudoRoomView } from "@/games/ludo/online/ludo-room-view";

export interface JoinOnlineLudoProps {
  roomId: string;
  viewerUserId: string;
}

type JoinChoice = null | "play" | "watch";

/**
 * Client part of the invitation flow (spec sections 4 and 7): the
 * invitee picks — join as a player (goes through admin approval, they
 * watch read-only with a pending banner meanwhile) or watch (spectator
 * right away). Either way they land directly in the match screen.
 */
export function JoinOnlineLudo({ roomId, viewerUserId }: JoinOnlineLudoProps) {
  const router = useRouter();
  const [choice, setChoice] = useState<JoinChoice>(null);
  const [room, setRoom] = useState<Room | null>(null);
  // Lazily derived from storage: a session was persisted for THIS room
  // and this tab, so the component boots straight into restore mode.
  const [restoring, setRestoring] = useState(
    () => readRoomSession(roomId) !== null,
  );
  const [error, setError] = useState<string | null>(null);

  // A refresh on an invite link must not bounce the invitee back to the
  // choice screen: the reconnection token (sessionStorage) restores the
  // exact seat/role the server kept for them.
  useEffect(() => {
    const session = readRoomSession(roomId);
    if (!session) return;
    let cancelled = false;
    void (async () => {
      try {
        const joined = await reconnectRoom(session.reconnectionToken);
        if (!cancelled) setRoom(joined);
      } catch {
        clearRoomSession(roomId); // gone or expired — back to the choice
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (restoring) {
    return (
      <p className="text-sm text-neutral-400" role="status">
        Reconnexion à la partie…
      </p>
    );
  }

  if (!choice) {
    return (
      <section className="flex w-full max-w-md flex-col gap-4 text-center">
        <h1 className="text-lg font-semibold text-white">
          Rejoindre la partie de Ludo
        </h1>
        <p className="text-sm text-white/50">
          Choisis comment tu veux participer. Les joueurs doivent être
          acceptés par le créateur ; regarder est libre et sans compte.
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
        persistRoomSession(joined, choice);
        setRoom(joined);
      } catch (joinError) {
        setError(
          joinError instanceof Error
            ? joinError.message
            : "Impossible de rejoindre cette room.",
        );
      }
    })();

    return (
      <p className="text-sm text-neutral-400" role="status">
        Connexion à la room…
      </p>
    );
  }

  if (error) {
    return (
      <section className="w-full max-w-md text-center">
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
        <a
          href="/games/ludo"
          className="mt-3 inline-block text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Retour au Ludo
        </a>
      </section>
    );
  }

  if (!room) return null;

  return (
    <LudoRoomView
      room={room}
      viewerUserId={viewerUserId}
      onLeft={() => {
        clearRoomSession(roomId);
        router.push("/games/ludo");
      }}
    />
  );
}
