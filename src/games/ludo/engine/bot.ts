import { getSafeTrackIndices, getTrackIndex } from "./board";
import { LAST_TRACK_POSITION, HOME_COLUMN_START, TRACK_LENGTH } from "./constants";
import { applyMove, computeLegalMoves, getTokenProgress } from "./movement";
import type { LegalMove, LudoAction, LudoState, Token, PlayerColor } from "./types";

/** Bot strategy.

Priorities are strict tiers:
  tier 3  finish a token
  tier 2  capture an opponent
  tier 1  everything else, ranked by a weighted score (leave base, reach the home column,
          land on a safe cell, leave / avoid danger, advance)

Ties are broken deterministically (higher destination, then lower token index), so the bot
is a pure function of the state. It is a competent casual opponent, not a perfect one: it only
looks one move ahead and estimates danger from the six possible dice values.
*/
export const BOT_WEIGHTS = {
  capturedProgress: 3,
  enterHomeColumn: 300,
  leaveBase: 260,
  leaveBaseWhenNoTokenOnBoard: 200,
  safeLanding: 90,
  danger: 260,
  progress: 1.5,
} as const;

/** Probability (0..1) that an opponent can capture a token standing at `position`, one roll ahead. */
export function estimateDanger(
  tokens: readonly Token[],
  ownerId: string,
  color: PlayerColor,
  position: number,
  safeOffsets: readonly number[],
): number {
  const index = getTrackIndex(color, position);
  if (index === null) return 0;
  if (getSafeTrackIndices(safeOffsets).has(index)) return 0;
  const threateningRolls = new Set<number>();
  for (const other of tokens) {
    if (other.playerId === ownerId || other.status !== "active" || other.position > LAST_TRACK_POSITION) continue;
    const otherIndex = getTrackIndex(other.color, other.position);
    if (otherIndex === null) continue;
    const distance = (index - otherIndex + TRACK_LENGTH) % TRACK_LENGTH;
    if (distance >= 1 && distance <= 6 && other.position + distance <= LAST_TRACK_POSITION) {
      threateningRolls.add(distance);
    }
  }
  return threateningRolls.size / 6;
}

export interface MoveEvaluation {
  move: LegalMove;
  tier: 1 | 2 | 3;
  score: number;
}

export function evaluateMove(state: LudoState, move: LegalMove): MoveEvaluation {
  const rules = state.config.rules;
  const token = state.tokens.find((t) => t.id === move.tokenId);
  if (!token) return { move, tier: 1, score: Number.NEGATIVE_INFINITY };

  const after = applyMove(state.tokens, move);
  const tier: 1 | 2 | 3 = move.kind === "finish" ? 3 : move.captures.length > 0 ? 2 : 1;
  let score = 0;

  if (move.captures.length > 0) {
    for (const victimId of move.captures) {
      const victim = state.tokens.find((t) => t.id === victimId);
      if (victim) score += getTokenProgress(victim) * BOT_WEIGHTS.capturedProgress;
    }
  }
  if (move.kind === "enter_home_column") score += BOT_WEIGHTS.enterHomeColumn;
  if (move.kind === "leave_base") {
    score += BOT_WEIGHTS.leaveBase;
    const onBoard = state.tokens.some((t) => t.playerId === token.playerId && t.status === "active");
    if (!onBoard) score += BOT_WEIGHTS.leaveBaseWhenNoTokenOnBoard;
  }

  const destinationIndex = getTrackIndex(token.color, move.to);
  const landsSafe =
    move.to >= HOME_COLUMN_START ||
    (destinationIndex !== null && getSafeTrackIndices(rules.safeOffsets).has(destinationIndex));
  if (landsSafe) score += BOT_WEIGHTS.safeLanding;

  const before =
    move.from >= 0 ? estimateDanger(state.tokens, token.playerId, token.color, move.from, rules.safeOffsets) : 0;
  const dangerAfter = estimateDanger(after, token.playerId, token.color, move.to, rules.safeOffsets);
  score += (before - dangerAfter) * BOT_WEIGHTS.danger;

  score += (move.to + 1) * BOT_WEIGHTS.progress;
  return { move, tier, score };
}

/** Best legal move for the current player, or null when there is none. */
export function chooseBotMove(state: LudoState): LegalMove | null {
  if (state.phase !== "awaiting_move" || state.dice.value === null) return null;
  const moves = computeLegalMoves(state.tokens, state.currentPlayerId, state.dice.value, state.config.rules);
  let best: MoveEvaluation | null = null;
  for (const move of moves) {
    const evaluation = evaluateMove(state, move);
    if (best === null || isBetter(evaluation, best, state)) best = evaluation;
  }
  return best ? best.move : null;
}

function tokenIndexOf(state: LudoState, tokenId: string): number {
  return state.tokens.find((t) => t.id === tokenId)?.index ?? 0;
}

function isBetter(a: MoveEvaluation, b: MoveEvaluation, state: LudoState): boolean {
  if (a.tier !== b.tier) return a.tier > b.tier;
  if (a.score !== b.score) return a.score > b.score;
  if (a.move.to !== b.move.to) return a.move.to > b.move.to;
  return tokenIndexOf(state, a.move.tokenId) < tokenIndexOf(state, b.move.tokenId);
}

/** The next action a bot would play for the current player (null if it is not a bot's turn). */
export function getBotAction(state: LudoState): LudoAction | null {
  if (state.phase === "finished") return null;
  const player = state.players.find((p) => p.id === state.currentPlayerId);
  if (!player || player.type !== "bot") return null;
  switch (state.phase) {
    case "awaiting_roll":
      return { type: "ROLL_DICE", playerId: player.id };
    case "awaiting_pass":
      return { type: "PASS_TURN", playerId: player.id };
    case "awaiting_move": {
      const move = chooseBotMove(state);
      return move ? { type: "MOVE_TOKEN", playerId: player.id, tokenId: move.tokenId } : { type: "PASS_TURN", playerId: player.id, reason: "timeout" };
    }
    default:
      return null;
  }
}
