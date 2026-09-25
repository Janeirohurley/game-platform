"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";

import { GameLobby } from "@/components/realtime/lobby";
import { RoomChat } from "@/components/realtime/chat";
import { useRoom } from "@/lib/realtime";
import { CheckersRoomView } from "@/games/checkers/online/checkers-room-view";

interface PlayOnlineCheckersProps {
  gameId: string;
  viewerUserId: string;
}

/**
 * Online flow for Checkers.
 *
 * Simpler than Ludo's: the table is always two seats, so there is no
 * size to pick and the room is created straight away. The waiting room
 * is the platform's generic lobby — nothing game-specific about it.
 */
export function PlayOnlineCheckers({
  gameId,
  viewerUserId,
}: PlayOnlineCheckersProps) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const { snapshot, status, error, room, roomId, startGame, leave } = useRoom({
    gameId,
    targetPlayers: 2,
  });

  const inviteUrl = useMemo(() => {
    if (!roomId || typeof window === "undefined") return "";
    return `${window.location.origin}/games/${gameId}/join/${roomId}`;
  }, [gameId, roomId]);

  const handleCopyInvite = useCallback(() => {
    if (inviteUrl) void navigator.clipboard.writeText(inviteUrl);
  }, [inviteUrl]);

  const handleLeave = useCallback(() => {
    leave();
    router.push("/games/checkers");
  }, [leave, router]);

  const handleStart = useCallback(() => {
    setStarting(true);
    startGame();
    setTimeout(() => setStarting(false), 1500);
  }, [startGame]);

  if (status === "error") {
    return (
      <Panel>
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error ?? "Connexion impossible."}
        </p>
      </Panel>
    );
  }

  if (!snapshot || !roomId) {
    return (
      <Panel>
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
      </Panel>
    );
  }

  if (room && (snapshot.phase === "playing" || snapshot.phase === "finished")) {
    return (
      <CheckersRoomView
        room={room}
        viewerUserId={viewerUserId}
        onLeave={handleLeave}
      />
    );
  }

  return (
    <>
      <GameLobby
        snapshot={snapshot}
        viewerUserId={viewerUserId}
        inviteUrl={inviteUrl}
        onCopyInvite={handleCopyInvite}
        onLeave={handleLeave}
        onStart={handleStart}
        starting={starting}
      />

      {/* Players can talk while waiting for an opponent. */}
      <RoomChat room={room} viewerUserId={viewerUserId} />
    </>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
      {children}
    </div>
  );
}
