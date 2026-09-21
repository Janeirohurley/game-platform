import { computeLegalMoves, getTokenProgress } from "./movement";
import { computeStandings, type StandingEntry } from "./rules";
import type { LegalMove, LudoState, Player, Token } from "./types";

export function getPlayer(state: LudoState, playerId: string): Player | undefined {
  return state.players.find((p) => p.id === playerId);
}

export function getCurrentPlayer(state: LudoState): Player {
  const player = getPlayer(state, state.currentPlayerId);
  if (!player) throw new Error(`Unknown current player: ${state.currentPlayerId}`);
  return player;
}

export function getPlayerTokens(state: LudoState, playerId: string): Token[] {
  return state.tokens.filter((t) => t.playerId === playerId);
}

export function getToken(state: LudoState, tokenId: string): Token | undefined {
  return state.tokens.find((t) => t.id === tokenId);
}

export function isBotTurn(state: LudoState): boolean {
  return state.phase !== "finished" && getCurrentPlayer(state).type === "bot";
}

export function isHumanTurn(state: LudoState): boolean {
  return state.phase !== "finished" && getCurrentPlayer(state).type === "human";
}

/** Legal moves recomputed from tokens + die (does not trust `state.legalMoves`). */
export function getLegalMoves(state: LudoState): LegalMove[] {
  if (state.phase !== "awaiting_move" || state.dice.value === null) return [];
  return computeLegalMoves(state.tokens, state.currentPlayerId, state.dice.value, state.config.rules);
}

export function canRoll(state: LudoState, playerId: string): boolean {
  return state.phase === "awaiting_roll" && state.currentPlayerId === playerId;
}

export function getStandings(state: LudoState): StandingEntry[] {
  return computeStandings(state.players, state.tokens, state.finishedPlayerIds);
}

export function countTokens(state: LudoState, playerId: string): { base: number; active: number; home: number } {
  const own = getPlayerTokens(state, playerId);
  return {
    base: own.filter((t) => t.status === "base").length,
    active: own.filter((t) => t.status === "active").length,
    home: own.filter((t) => t.status === "home").length,
  };
}

export function getPlayerProgress(state: LudoState, playerId: string): number {
  return getPlayerTokens(state, playerId).reduce((sum, t) => sum + getTokenProgress(t), 0);
}

export function getCaptureStats(state: LudoState, playerId: string): { captures: number; timesCaptured: number } {
  return {
    captures: state.captureLog.filter((c) => c.byPlayerId === playerId).length,
    timesCaptured: state.captureLog.filter((c) => c.victimPlayerId === playerId).length,
  };
}

/** Human-facing token number (1-4). */
export function tokenNumber(token: Token): number {
  return token.index + 1;
}
