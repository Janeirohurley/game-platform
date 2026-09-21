/**
 * Ludo engine — domain types.
 *
 * Everything in here is plain, serializable data (no classes, no functions, no DOM types),
 * so a LudoState can be persisted, sent over the network or replayed.
 */

export type PlayerColor = "red" | "green" | "yellow" | "blue";
export type PlayerType = "human" | "bot";
export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;
export type TokenStatus = "base" | "active" | "home";

/**
 * awaiting_roll : the current player must roll.
 * awaiting_move : a die was rolled and at least one legal move exists.
 * awaiting_pass : a die was rolled but the turn is forfeited (no legal move / third six).
 * finished      : the game is over.
 */
export type GamePhase = "awaiting_roll" | "awaiting_move" | "awaiting_pass" | "finished";
export type PassReason = "no_legal_moves" | "three_sixes" | "timeout";
export type GameEndMode = "first_winner" | "full_ranking";
export type MoveKind = "leave_base" | "advance" | "enter_home_column" | "finish";
export type ExtraTurnReason = "six" | "capture" | "home";

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  color: PlayerColor;
  seat: number;
}

export interface PlayerConfig {
  color: PlayerColor;
  type: PlayerType;
  name: string;
}

export interface LudoRules {
  /** Die value required to bring a token out of base. */
  entryRoll: DiceValue;
  /** true: a token must roll the exact number to reach the final home. false: overshoot is allowed. */
  exactHomeRoll: boolean;
  extraTurnOnSix: boolean;
  extraTurnOnCapture: boolean;
  extraTurnOnHome: boolean;
  /** Rolling this many sixes in a row forfeits the turn. 0 disables the rule. */
  maxConsecutiveSixes: number;
  /**
   * Safe cells, as offsets (0..51) from each colour's start square.
   * [0, 8] = the four start squares + the four "star" squares.
   */
  safeOffsets: readonly number[];
  gameEnd: GameEndMode;
  /** With `full_ranking`: end the game once every human player has finished. */
  stopWhenHumansFinished: boolean;
}

export interface LudoGameConfig {
  humanPlayers: number;
  players: PlayerConfig[];
  rules: LudoRules;
  /** Colour that plays first (default: red). */
  startingColor?: PlayerColor;
}

/**
 * Token position, relative to the token's own colour:
 *   -1        in base
 *   0..50     on the shared 52-cell track (0 = the colour's start square)
 *   51..55    on the colour's private home column
 *   56        finished (centre)
 */
export interface Token {
  id: string;
  playerId: string;
  color: PlayerColor;
  /** 0..3 : the number shown to players is index + 1. */
  index: number;
  status: TokenStatus;
  position: number;
}

export interface LegalMove {
  tokenId: string;
  from: number;
  to: number;
  kind: MoveKind;
  /** Ids of the opponent tokens that would be sent back to base. */
  captures: string[];
}

export interface DiceState {
  value: DiceValue | null;
  rolledBy: string | null;
  consecutiveSixes: number;
  rollCount: number;
}

export type TurnChangeReason = "move_complete" | PassReason;

export type LudoEvent =
  | { type: "dice_rolled"; playerId: string; value: DiceValue }
  | { type: "no_legal_moves"; playerId: string; reason: PassReason }
  | { type: "token_moved"; playerId: string; tokenId: string; from: number; to: number; kind: MoveKind }
  | { type: "token_captured"; playerId: string; tokenId: string; victimTokenIds: string[] }
  | { type: "token_finished"; playerId: string; tokenId: string }
  | { type: "player_finished"; playerId: string; rank: number }
  | { type: "extra_turn"; playerId: string; reason: ExtraTurnReason }
  | { type: "turn_changed"; fromPlayerId: string; toPlayerId: string; reason: TurnChangeReason }
  | { type: "game_over"; winnerId: string; ranking: string[] }
  | { type: "game_reset" };

export interface CaptureRecord {
  turn: number;
  byPlayerId: string;
  byTokenId: string;
  victimPlayerId: string;
  victimTokenId: string;
  /** Absolute track index (0..51) where the capture happened. */
  trackIndex: number;
}

export interface LastAction {
  type: LudoAction["type"];
  playerId: string | null;
  value?: DiceValue;
  tokenId?: string;
}

export interface LudoState {
  version: number;
  config: LudoGameConfig;
  phase: GamePhase;
  players: Player[];
  tokens: Token[];
  currentPlayerId: string;
  dice: DiceState;
  /** Legal moves for the current roll (empty unless phase is awaiting_move). */
  legalMoves: LegalMove[];
  passReason: PassReason | null;
  /** First player to bring all tokens home. */
  winner: string | null;
  /** Players that brought all tokens home, in finishing order. */
  finishedPlayerIds: string[];
  /** Complete final ranking (all players) — only filled once phase === "finished". */
  ranking: string[];
  /** Number of turn hand-overs + 1. */
  turn: number;
  /** State of the seeded PRNG that produces dice values (uint32). */
  rng: number;
  lastAction: LastAction | null;
  /** Events produced by the last transition. Presentation hints only. */
  events: LudoEvent[];
  captureLog: CaptureRecord[];
}

export type LudoAction =
  | {
      type: "ROLL_DICE";
      playerId: string;
      /** Injected value (tests, replays, authoritative server). Omit to draw from the state's PRNG. */
      value?: DiceValue;
    }
  | { type: "MOVE_TOKEN"; playerId: string; tokenId: string }
  | {
      type: "PASS_TURN";
      playerId: string;
      /** "timeout" lets a server skip a player who is not responding. */
      reason?: "timeout";
    }
  | { type: "RESET_GAME"; seed?: number };

export type ActionErrorCode =
  | "GAME_FINISHED"
  | "INVALID_PHASE"
  | "NOT_YOUR_TURN"
  | "INVALID_DICE_VALUE"
  | "UNKNOWN_TOKEN"
  | "TOKEN_NOT_OWNED"
  | "ILLEGAL_MOVE"
  | "INVALID_ACTION";

export interface ActionError {
  code: ActionErrorCode;
  message: string;
}

export type ActionResult =
  | { ok: true; state: LudoState; events: LudoEvent[] }
  | { ok: false; state: LudoState; error: ActionError };

/* ---------------- board model ---------------- */

export interface GridCoord {
  row: number;
  col: number;
}

export interface Point {
  x: number;
  y: number;
}

export type CellType = "track" | "start" | "home_column";

export interface BoardCell {
  id: string;
  type: CellType;
  row: number;
  col: number;
  isSafe: boolean;
  playerColor?: PlayerColor;
  /** Absolute index on the shared track (0..51). */
  trackIndex?: number;
  /** 0..4 on a private home column. */
  homeColumnIndex?: number;
}

export type TokenCellRef =
  | { kind: "base" }
  | { kind: "track"; index: number }
  | { kind: "home_column"; color: PlayerColor; index: number }
  | { kind: "home" };

/** Source of randomness (0 <= next() < 1). Never used inside the reducer. */
export interface RandomSource {
  next(): number;
}