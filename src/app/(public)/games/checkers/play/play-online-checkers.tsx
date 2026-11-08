"use client";

import { MatchScreen, PlayOnline } from "@/components/realtime/match";
import { CheckersRoomView } from "@/games/checkers/online/checkers-room-view";

interface PlayOnlineCheckersProps {
  gameId: string;
  allowedPlayerCounts: readonly number[];
  viewerUserId: string;
}

/**
 * Checkers' online entry point.
 *
 * Until now this component created a table on mount — `createRoom`, which
 * maps to Colyseus' `client.create()`, ALWAYS opens a new room. Two
 * players arriving at the same moment therefore sat in two different
 * rooms waiting for each other, and the only way to actually meet was to
 * exchange a `/join/<roomId>` link. The shared `PlayOnline` replaces that
 * with the open-table list and quick play the matchmaker already served
 * (`GET /api/rooms/checkers` has always answered).
 */
export function PlayOnlineCheckers({
  gameId,
  allowedPlayerCounts,
  viewerUserId,
}: PlayOnlineCheckersProps) {
  return (
    <PlayOnline
      gameId={gameId}
      viewerUserId={viewerUserId}
      allowedPlayerCounts={allowedPlayerCounts}
      backHref="/games/checkers/play"
      backLabel="Retour aux Dames"
      renderRoom={({ room, joinMode, onRoomReconnected, onLeft }) => (
        <MatchScreen
          room={room}
          gameId={gameId}
          viewerUserId={viewerUserId}
          joinMode={joinMode}
          onRoomReconnected={onRoomReconnected}
          backHref="/games/checkers/play"
          backLabel="Retour aux Dames"
          onLeft={onLeft}
        >
          <CheckersRoomView
            room={room}
            viewerUserId={viewerUserId}
            onLeave={onLeft}
          />
        </MatchScreen>
      )}
    />
  );
}
