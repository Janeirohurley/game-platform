"use client";

import { useEffect, useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import type { Room } from "@colyseus/sdk";

import { createRoom, joinRoom, reconnectRoom } from "@/lib/realtime/client";
import { clearRoomSession, persistRoomSession, readRoomIdFromUrl, readRoomSession } from "@/lib/realtime/session-url";
import { waitForRoomReady } from "@/lib/realtime/seat-prepare";
import { MatchScreen } from "@/components/realtime/match";
import { CheckersRoomView } from "@/games/checkers/online/checkers-room-view";

interface PlayOnlineCheckersProps {
  gameId: string;
  viewerUserId: string;
}

/**
 * Online flow for Checkers (spec sections 1 and 3): the table is always
 * two seats, the room is created straight away and the creator lands
 * directly in the match screen — board + integrated waiting overlays,
 * no separate lobby page. The second seat goes through admin approval.
 */
export function PlayOnlineCheckers({
  gameId,
  viewerUserId,
}: PlayOnlineCheckersProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  const handleLeave = useMemo(() => {
    return (joined: Room) => {
      clearRoomSession(joined.roomId);
      void joined.leave(true);
      setGone(true);
    };
  }, []);

  useEffect(() => {
    if (room || error || gone) return;
    let cancelled = false;
    void (async () => {
      try {
        const roomId = readRoomIdFromUrl();
        const session = roomId ? readRoomSession(roomId) : null;
        const restored = roomId
          ? session
            ? await reconnectRoom(session.reconnectionToken).catch(() => joinRoom(gameId, roomId, session.mode))
            : await joinRoom(gameId, roomId, "play")
          : await createRoom(gameId, 2);
        if (cancelled) { void restored.leave(); return; }
        // Fresh table (created or first join): hold the loader until the
        // server has acknowledged the lobby before dropping onto the board.
        if (!session) await waitForRoomReady(restored);
        if (cancelled) { void restored.leave(); return; }
        persistRoomSession(restored, session?.mode ?? "play");
        setRoom(restored);
      } catch (createError) {
        if (!cancelled) setError(createError instanceof Error ? createError.message : "Création ou restauration de la table impossible.");
      }
    })();
    return () => { cancelled = true; };
  }, [gameId, room, error, gone]);

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
      joinMode="play"
      onRoomReconnected={setRoom}
      backHref="/games/checkers/play"
      backLabel="Retour aux dames"
      onLeft={() => handleLeave(room)}
    >
      <CheckersRoomView
        room={room}
        viewerUserId={viewerUserId}
        onLeave={() => handleLeave(room)}
      />
    </MatchScreen>
  );
}
