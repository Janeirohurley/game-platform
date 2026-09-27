"use client";

import type { Room } from "@colyseus/sdk";

import type {
  LobbyPendingRequestView,
  LobbyPlayerView,
  LobbySnapshot,
  LobbySpectatorView,
  RoomPhase,
} from "./types";

/**
 * Read the generic lobby fields off a joined room.
 *
 * The SDK resolves create()/joinById() on the join handshake, but the
 * first full state message can arrive on a later WebSocket frame. Until
 * it does, `room.state` fields are undefined — return null and let the
 * onStateChange subscription populate the snapshot instead of crashing
 * on a half-decoded state.
 */
export function readLobbySnapshot(room: Room): LobbySnapshot | null {
  const state = room.state as unknown as
    | {
        gameId: string;
        gameName: string;
        minPlayers: number;
        maxPlayers: number;
        targetPlayers: number;
        phase: RoomPhase;
        hostUserId: string;
        players: Map<
          string,
          LobbyPlayerView & { voiceMuted?: boolean; adminMuted?: boolean }
        >;
        pendingPlayerRequests: Map<string, LobbyPendingRequestView>;
        spectators: Map<string, LobbySpectatorView>;
      }
    | undefined;

  if (!state?.players) return null;

  return {
    gameId: state.gameId,
    gameName: state.gameName,
    minPlayers: state.minPlayers,
    maxPlayers: state.maxPlayers,
    targetPlayers: state.targetPlayers,
    phase: state.phase,
    hostUserId: state.hostUserId,
    players: [...state.players.values()].map((player) => ({
      ...player,
      voiceMuted: player.voiceMuted,
      adminMuted: player.adminMuted,
    })),
    pendingPlayerRequests: [
      ...(state.pendingPlayerRequests?.values() ?? []),
    ].map((request) => ({ ...request })),
    spectators: [...(state.spectators?.values() ?? [])].map(
      (spectator) => ({ ...spectator }),
    ),
  };
}
