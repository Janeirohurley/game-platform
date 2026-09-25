/**
 * Identity and room contracts shared with the realtime server.
 *
 * Keep these in sync with server-games' `src/games/registry.ts` and
 * `src/rooms/schema/lobby-state.ts`. They are duplicated (rather than
 * imported) because the two sides live in separate codebases.
 */

export type RoomPhase = "waiting" | "ready" | "playing" | "finished";

/** Generic game identity, as declared in the realtime server registry. */
export interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
}

/** A player entry in the generic lobby (server state mirror). */
export interface LobbyPlayerView {
  userId: string;
  name: string;
  sessionId: string;
  seat: number;
  connected: boolean;
}

/** The lobby fields every game room exposes, generically. */
export interface LobbySnapshot {
  gameId: string;
  gameName: string;
  minPlayers: number;
  maxPlayers: number;
  targetPlayers: number;
  phase: RoomPhase;
  hostUserId: string;
  players: LobbyPlayerView[];
}

/** Room listing entry returned by matchmaking queries. */
export interface RoomListing {
  roomId: string;
  metadata?: {
    gameId: string;
    gameName: string;
    targetPlayers: number;
    players: number;
    maxPlayers: number;
  };
}

/** Ludo-specific fields of the synchronized game state (client view). */
export interface LudoPieceView {
  index: number;
  position: number;
}

export interface LudoPlayerView extends LobbyPlayerView {
  color: string;
  finished: number;
  pieces: LudoPieceView[];
}
