import { getSafeTrackIndices, getTrackIndex } from "./board";
import {
  BASE_POSITION,
  HOME_COLUMN_START,
  HOME_POSITION,
  LAST_TRACK_POSITION,
  START_POSITION,
  TOKENS_PER_PLAYER,
} from "./constants";
import type {
  DiceValue,
  LegalMove,
  LudoRules,
  MoveKind,
  PlayerColor,
  Token,
  TokenCellRef,
} from "./types";

/** Logical cell of a token position. Throws RangeError for a position outside -1..56. */
export function resolveTokenCell(color: PlayerColor, position: number): TokenCellRef {
  if (!Number.isInteger(position) || position < BASE_POSITION || position > HOME_POSITION) {
    throw new RangeError(`Invalid token position: ${position}`);
  }
  if (position === BASE_POSITION) return { kind: "base" };
  if (position === HOME_POSITION) return { kind: "home" };
  if (position >= HOME_COLUMN_START) {
    return { kind: "home_column", color, index: position - HOME_COLUMN_START };
  }
  const index = getTrackIndex(color, position);
  if (index === null) throw new RangeError(`Invalid token position: ${position}`);
  return { kind: "track", index };
}

/** Destination position for a token with a given roll, or null when the token cannot move. */
export function getDestination(token: Token, roll: DiceValue, rules: LudoRules): number | null {
  if (token.status === "home") return null;
  if (token.status === "base") return roll === rules.entryRoll ? START_POSITION : null;
  const target = token.position + roll;
  if (target <= HOME_POSITION) return target;
  return rules.exactHomeRoll ? null : HOME_POSITION;
}

export function classifyMove(from: number, to: number): MoveKind {
  if (from === BASE_POSITION) return "leave_base";
  if (to === HOME_POSITION) return "finish";
  if (from <= LAST_TRACK_POSITION && to >= HOME_COLUMN_START) return "enter_home_column";
  return "advance";
}

/** Opponent tokens that would be captured when `mover` lands on `destination`. */
export function findCaptures(
  tokens: readonly Token[],
  mover: Token,
  destination: number,
  rules: LudoRules,
): string[] {
  const index = getTrackIndex(mover.color, destination);
  if (index === null) return [];
  if (getSafeTrackIndices(rules.safeOffsets).has(index)) return [];
  const victims: string[] = [];
  for (const other of tokens) {
    if (other.playerId === mover.playerId || other.status !== "active") continue;
    if (getTrackIndex(other.color, other.position) === index) victims.push(other.id);
  }
  return victims;
}

/** All legal moves of `playerId` for `roll`, ordered by token index. */
export function computeLegalMoves(
  tokens: readonly Token[],
  playerId: string,
  roll: DiceValue,
  rules: LudoRules,
): LegalMove[] {
  const moves: LegalMove[] = [];
  const own = tokens.filter((t) => t.playerId === playerId).sort((a, b) => a.index - b.index);
  for (const token of own) {
    const to = getDestination(token, roll, rules);
    if (to === null) continue;
    moves.push({
      tokenId: token.id,
      from: token.position,
      to,
      kind: classifyMove(token.position, to),
      captures: findCaptures(tokens, token, to, rules),
    });
  }
  return moves;
}

/** Applies a (pre-validated) move immutably: moves the token and sends captured tokens to base. */
export function applyMove(tokens: readonly Token[], move: LegalMove): Token[] {
  return tokens.map((token) => {
    if (token.id === move.tokenId) {
      return {
        ...token,
        position: move.to,
        status: move.to === HOME_POSITION ? "home" : "active",
      };
    }
    if (move.captures.includes(token.id)) {
      return { ...token, position: BASE_POSITION, status: "base" };
    }
    return token;
  });
}

export function isPlayerFinished(tokens: readonly Token[], playerId: string): boolean {
  const own = tokens.filter((t) => t.playerId === playerId);
  return own.length === TOKENS_PER_PLAYER && own.every((t) => t.status === "home");
}

/** Progress of a token: 0 in base … 57 when home (position + 1). */
export function getTokenProgress(token: Token): number {
  return token.position + 1;
}

/** Intermediate positions travelled by a move (excluding `from`), for animation. */
export function getMovePath(from: number, to: number): number[] {
  if (from === BASE_POSITION) return [START_POSITION];
  const path: number[] = [];
  for (let p = from + 1; p <= to; p++) path.push(p);
  return path;
}
