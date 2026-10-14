/**
 * Identity and room contracts shared with the realtime server.
 *
 * Keep these in sync with server-games' `src/games/registry.ts` and
 * `src/rooms/schema/lobby-state.ts`. They are duplicated (rather than
 * imported) because the two sides live in separate codebases.
 */

export type RoomPhase = "waiting" | "ready" | "playing" | "finished" | "closed";

/**
 * Skill levels a platform bot is provisioned with — mirrored from
 * server-games' bot brain so the UI can label a seated bot. String keys
 * arrive over the wire, so consumers must treat an unknown value as
 * "no label" rather than index blindly.
 */
export type BotDifficulty = "easy" | "normal" | "hard";

/** French labels per level — keeps the UI and the server brain in step. */
export const BOT_DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Facile",
  normal: "Normal",
  hard: "Difficile",
};

/** Generic game identity, as declared in the realtime server registry. */
export interface GameDefinition {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Table sizes the game supports — the creator picks among these. */
  allowedPlayerCounts?: readonly number[];
}

/** A player entry in the generic lobby (server state mirror). */
export interface LobbyPlayerView {
  userId: string;
  name: string;
  /** Avatar URL from the gamer profile ("" = initials fallback). */
  avatarUrl: string;
  sessionId: string;
  seat: number;
  connected: boolean;
  /**
   * Seat piloted by a platform bot. Bots are real platform accounts but
   * have no connection — the server seats and plays them in-process.
   */
  isBot?: boolean;
  /** Bot skill level key ("" for humans); see `BOT_DIFFICULTY_LABELS`. */
  botDifficulty?: string;
  /** Logical mic state, mirrored from the server (`voice:mute`). */
  voiceMuted?: boolean;
  /** Admin-imposed mute — the player cannot lift it themselves. */
  adminMuted?: boolean;
}

/** A read-only onlooker — outside player capacity. */
export interface LobbySpectatorView {
  userId: string;
  name: string;
  sessionId: string;
}

/** Someone who asked to play and awaits the admin's decision. */
export interface LobbyPendingRequestView {
  requestId?: string;
  userId: string;
  name: string;
  requestedAt: number;
}

export type JoinRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "expired";

export interface LobbyJoinRequestResultView {
  requestId: string;
  userId: string;
  status: Exclude<JoinRequestStatus, "pending">;
  updatedAt: number;
  reason: string;
}

/** The lobby fields every game room exposes, generically. */
export interface LobbySnapshot {
  gameId: string;
  gameName: string;
  minPlayers: number;
  maxPlayers: number;
  targetPlayers: number;
  phase: RoomPhase;
  /**
   * Server wall-clock epoch (ms) when the match started — the HUD shows
   * the elapsed game time from it. 0 while the lobby is still waiting.
   */
  startedAt: number;
  hostUserId: string;
  players: LobbyPlayerView[];
  /** Users waiting for admin approval to become players. */
  pendingPlayerRequests: LobbyPendingRequestView[];
  /** Recent terminal outcomes used to reconcile after reconnect. */
  joinRequestResults?: LobbyJoinRequestResultView[];
  /** Read-only onlookers — disjoint from players, outside capacity. */
  spectators: LobbySpectatorView[];
  /**
   * Turn-based games: id of the player whose turn it is
   * (null before the match starts or for games without turns).
   */
  currentTurn: string | null;
  /**
   * Server-relative deadline of the current turn. The client cannot read
   * the server's room clock — it only uses this to DETECT a timing reset
   * (every roll/turn changes it), then re-times the visible countdown
   * locally from `turnDurationMs`.
   */
  turnDeadline: number;
  /** Mirrored per-turn budget (ms) for the running game; 0 = no timer. */
  turnDurationMs: number;
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
    spectators: number;
    phase: string;
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

/**
 * Checkers-specific fields of the synchronized state (client view).
 * Mirrors `server-games/src/games/checkers/checkers-state.ts`.
 */
export interface CheckersPlayerView extends LobbyPlayerView {
  /** "white" or "black"; empty until the match starts. */
  color: string;
}

export interface CheckersSnapshot extends LobbySnapshot {
  /** 64-character board encoding, empty before the match starts. */
  board: string;
  turnColor: string;
  currentTurn: string;
  turnDeadline: number;
  idlePlies: number;
  /** "playing" | "win" | "draw". */
  outcome: string;
  outcomeReason: string;
  winnerUserId: string;
}

/**
 * A chat message exactly as the room created it.
 * Mirrors `server-games/src/rooms/room-chat.ts` — the client authors
 * none of these fields, it only ever sends `{ content }`.
 */
export interface RoomChatMessage {
  id: string;
  /** Room-local and increasing; messages render in this order. */
  sequence: number;
  userId: string;
  username: string;
  content: string;
  createdAt: number;
}

/** Why the room refused a message. Sent only to its sender. */
export type ChatRejectionReason =
  | "invalid"
  | "empty"
  | "too-long"
  | "rate-limited"
  | "not-in-room";

/** Mirrors the server's MAX_CONTENT_LENGTH, for the input's own limit. */
export const CHAT_MAX_CONTENT_LENGTH = 300;

/**
 * Each game's default per-turn budget, mirrored from server-games. It is
 * only a FALLBACK: rooms that expose a `turnDurationMs` field (Ludo, once
 * the host picked it) win over this table. The server's room clock is
 * unreachable from the browser, so the circular turn countdown re-times
 * itself locally against the same values and resets whenever
 * `turnDeadline` moves.
 */
export const TURN_DURATION_MS_BY_GAME: Record<string, number> = {
  ludo: 30_000,
  checkers: 60_000,
};

/**
 * Per-turn budgets a Ludo host may pick (ms) — mirrors server-games'
 * `TURN_DURATION_OPTIONS`. 0 = no time limit.
 */
export const LUDO_TURN_DURATION_OPTIONS: readonly {
  value: number;
  label: string;
}[] = [
  { value: 0, label: "Sans limite" },
  { value: 30_000, label: "30 s" },
  { value: 60_000, label: "60 s" },
  { value: 90_000, label: "90 s" },
];
