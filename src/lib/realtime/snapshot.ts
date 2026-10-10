"use client";

import type { Room } from "@colyseus/sdk";

import type {
  LobbyPendingRequestView,
  LobbyJoinRequestResultView,
  LobbyPlayerView,
  LobbySnapshot,
  LobbySpectatorView,
  RoomPhase,
} from "./types";
import { TURN_DURATION_MS_BY_GAME } from "./types";

/**
 * Read the generic lobby fields off a joined room.
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
        startedAt?: number;
        hostUserId: string;
        players: Map<
          string,
          LobbyPlayerView & { voiceMuted?: boolean; adminMuted?: boolean }
        >;
        pendingPlayerRequests: Map<string, LobbyPendingRequestView>;
        joinRequestResults?: Map<string, LobbyJoinRequestResultView>;
        spectators: Map<string, LobbySpectatorView>;
        currentTurn?: string | null;
        turnDeadline?: number;
        turnDurationMs?: number;
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
    startedAt: state.startedAt ?? 0,
    hostUserId: state.hostUserId,
    players: [...state.players.values()].map((player) => ({
      ...player,
      avatarUrl: player.avatarUrl ?? "",
      voiceMuted: player.voiceMuted,
      adminMuted: player.adminMuted,
    })),
    pendingPlayerRequests: [
      ...(state.pendingPlayerRequests?.values() ?? []),
    ].map((request) => ({ ...request })),
    joinRequestResults: [
      ...(state.joinRequestResults?.values() ?? []),
    ].map((result) => ({ ...result })),
    spectators: [...(state.spectators?.values() ?? [])].map(
      (spectator) => ({ ...spectator }),
    ),
    currentTurn: state.currentTurn ?? null,
    turnDeadline: state.turnDeadline ?? 0,
    // The server mirrors the live per-turn budget once set (the host may
    // have changed it in the lobby); fall back to the game's fixed table.
    turnDurationMs:
      state.turnDurationMs ?? TURN_DURATION_MS_BY_GAME[state.gameId] ?? 0,
  };
}
