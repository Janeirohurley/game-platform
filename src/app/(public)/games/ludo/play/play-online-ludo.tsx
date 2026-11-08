"use client";

import { PlayOnline } from "@/components/realtime/match";
import { LudoRoomView } from "@/games/ludo/online/ludo-room-view";

interface PlayOnlineLudoProps {
  gameId: string;
  /** Table sizes Ludo supports — read from the games registry. */
  allowedPlayerCounts: readonly number[];
  supportsBots?: boolean;
  viewerUserId: string;
}

/**
 * Ludo's online entry point.
 *
 * The matchmaking itself — open tables, quick play, creation, refresh
 * survival, sign-in prompts, room-closed handling — lives in
 * `PlayOnline`, shared by every game. All that stays here is the board,
 * which is the one part Ludo does differently: `LudoRoomView` owns its
 * own match screen rather than being wrapped in one.
 */
export function PlayOnlineLudo({
  gameId,
  allowedPlayerCounts,
  supportsBots = false,
  viewerUserId,
}: PlayOnlineLudoProps) {
  return (
    <PlayOnline
      gameId={gameId}
      viewerUserId={viewerUserId}
      allowedPlayerCounts={allowedPlayerCounts}
      supportsBots={supportsBots}
      backHref="/games/ludo/play"
      backLabel="Retour au Ludo"
      renderRoom={({ room, joinMode, onRoomReconnected, onLeft }) => (
        <LudoRoomView
          room={room}
          viewerUserId={viewerUserId}
          joinMode={joinMode}
          onRoomReconnected={onRoomReconnected}
          onLeft={onLeft}
        />
      )}
    />
  );
}
