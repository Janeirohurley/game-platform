"use client";

import { MatchScreen, PlayOnline } from "@/components/realtime/match";
import { RallyRoomView } from "@/games/rally/online/rally-room-view";

interface PlayOnlineRallyProps {
  gameId: string;
  allowedPlayerCounts: readonly number[];
  viewerUserId: string;
}

/**
 * Rally's online entry point.
 *
 * Same correction as Checkers: this used to call `createRoom` on mount,
 * so every visitor opened a private table nobody could discover. Rally is
 * a two-seat game, which made it the worst case — a table that needs
 * exactly one more player, and no way to find one.
 */
export function PlayOnlineRally({
  gameId,
  allowedPlayerCounts,
  viewerUserId,
}: PlayOnlineRallyProps) {
  return (
    <PlayOnline
      gameId={gameId}
      viewerUserId={viewerUserId}
      allowedPlayerCounts={allowedPlayerCounts}
      backHref="/games/rally/play"
      backLabel="Retour à Rally"
      renderRoom={({ room, joinMode, onRoomReconnected, onLeft }) => (
        <MatchScreen
          room={room}
          gameId={gameId}
          viewerUserId={viewerUserId}
          joinMode={joinMode}
          onRoomReconnected={onRoomReconnected}
          backHref="/games/rally/play"
          backLabel="Retour à Rally"
          onLeft={onLeft}
        >
          <RallyRoomView
            room={room}
            viewerUserId={viewerUserId}
            onLeave={onLeft}
          />
        </MatchScreen>
      )}
    />
  );
}
