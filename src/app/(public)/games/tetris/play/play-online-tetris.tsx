"use client";

import { MatchScreen, PlayOnline } from "@/components/realtime/match";
import { TetrisRoomView } from "@/games/tetris/online/tetris-room-view";

interface PlayOnlineTetrisProps {
  gameId: string;
  allowedPlayerCounts: readonly number[];
  viewerUserId: string;
}

/**
 * Tetris' online entry point.
 *
 * Tetris could already open a table of a chosen size, but never showed
 * the ones other players had opened — so a 10-seat game was in practice
 * played alone. The shared `PlayOnline` brings the open-table list and
 * quick play, plus the room-closed notice it was missing.
 */
export function PlayOnlineTetris({
  gameId,
  allowedPlayerCounts,
  viewerUserId,
}: PlayOnlineTetrisProps) {
  return (
    <PlayOnline
      gameId={gameId}
      viewerUserId={viewerUserId}
      allowedPlayerCounts={allowedPlayerCounts}
      backHref="/games/tetris/play"
      backLabel="Retour à Tetris"
      renderRoom={({ room, joinMode, onRoomReconnected, onLeft }) => (
        <MatchScreen
          room={room}
          gameId={gameId}
          viewerUserId={viewerUserId}
          joinMode={joinMode}
          onRoomReconnected={onRoomReconnected}
          backHref="/games/tetris/play"
          backLabel="Retour à Tetris"
          onLeft={onLeft}
        >
          <TetrisRoomView
            room={room}
            viewerUserId={viewerUserId}
            onLeave={onLeft}
          />
        </MatchScreen>
      )}
    />
  );
}
