"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "@colyseus/sdk";

import { joinRoom, reconnectRoom, watchRoom } from "@/lib/realtime";
import { clearRoomSession, persistRoomSession, readRoomSession } from "@/lib/realtime/session-url";
import { MatchScreen } from "@/components/realtime/match";
import { TetrisRoomView } from "@/games/tetris/online/tetris-room-view";

export interface JoinOnlineTetrisProps {
  roomId: string;
  viewerUserId: string;
}

type JoinChoice = null | "play" | "watch";

/**
 * Invitation flow (spec sections 4 and 7): join as a player (admin
 * approval) or watch as a spectator — both land in the match screen.
 */
export function JoinOnlineTetris({ roomId, viewerUserId }: JoinOnlineTetrisProps) {
  const router = useRouter();
  const [choice, setChoice] = useState<JoinChoice>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(() => readRoomSession(roomId) !== null);

  useEffect(() => {
    const session = readRoomSession(roomId);
    if (!session) return;
    let cancelled = false;
    void (async () => {
      try {
        const joined = await reconnectRoom(session.reconnectionToken).catch(() =>
          session.mode === "watch" ? watchRoom(roomId) : joinRoom("tetris", roomId, session.mode),
        );
        if (cancelled) { void joined.leave(); return; }
        persistRoomSession(joined, session.mode);
        setChoice(session.mode);
        setRoom(joined);
      } catch {
        clearRoomSession(roomId);
        setError("Impossible de restaurer ta connexion. Réessaie de rejoindre la room.");
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  const beginJoin = (mode: "play" | "watch") => {
    setChoice(mode);
    setError(null);
    void (async () => {
      try {
        const joined = mode === "watch" ? await watchRoom(roomId) : await joinRoom("tetris", roomId, mode);
        persistRoomSession(joined, mode);
        setRoom(joined);
      } catch (joinError) {
        setError(joinError instanceof Error ? joinError.message : "Impossible de rejoindre cette partie.");
      }
    })();
  };

  if (restoring) return <p className="text-sm text-neutral-400" role="status">Restauration de la partie…</p>;

  if (!choice) {
    return (
      <section className="flex w-full max-w-md flex-col gap-4 text-center">
        <h1 className="text-lg font-semibold text-white">
          Rejoindre la partie de Tetris
        </h1>
        <p className="text-sm text-white/50">
          Choisis comment participer. Les joueurs doivent être acceptés par le
          créateur ; regarder est libre et sans compte.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => beginJoin("play")}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Rejoindre comme joueur
          </button>
          <button
            type="button"
            onClick={() => beginJoin("watch")}
            className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10"
          >
            Regarder (sans compte)
          </button>
        </div>
      </section>
    );
  }

  if (!room && !error) {
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
          href="/games/tetris"
          className="text-sm text-neutral-400 underline hover:text-neutral-200"
        >
          Retour à Tetris
        </a>
      </section>
    );
  }

  if (!room) return null;

  return (
    <MatchScreen
      room={room}
      gameId="tetris"
      viewerUserId={viewerUserId}
      joinMode={choice}
      onRoomReconnected={setRoom}
      backHref="/games/tetris/play"
      backLabel="Retour à Tetris"
      onLeft={() => {
        clearRoomSession(roomId);
        router.push("/games/tetris");
      }}
    >
      <TetrisRoomView
        room={room}
        viewerUserId={viewerUserId}
        onLeave={() => {
          router.push("/games/tetris");
        }}
      />
    </MatchScreen>
  );
}
