import { validateLudoConfig, createPlayers } from "./config";
import {
  BASE_POSITION,
  HOME_POSITION,
  LUDO_STATE_VERSION,
  PLAYER_COLORS,
  TOKENS_PER_PLAYER,
} from "./constants";
import { isDiceValue } from "./dice";
import { computeLegalMoves } from "./movement";
import type {
  CaptureRecord,
  DiceState,
  GamePhase,
  LastAction,
  LudoGameConfig,
  LudoRules,
  LudoState,
  PassReason,
  PlayerColor,
  PlayerConfig,
  Token,
  TokenStatus,
} from "./types";

/** Rebuilds a LudoState from untrusted data (localStorage, network, …).
 * Returns null when anything is missing or inconsistent — never a half-valid state.
 * Derived data (legal moves) is recomputed, animation/presentation data (events) is dropped.
 */

type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isColor = (v: unknown): v is PlayerColor => PLAYER_COLORS.some((c) => c === v);
const PHASES: readonly GamePhase[] = ["awaiting_roll", "awaiting_move", "awaiting_pass", "finished"];
const PASS_REASONS: readonly PassReason[] = ["no_legal_moves", "three_sixes", "timeout"];

function parseRules(raw: unknown): LudoRules | null {
  if (!isRecord(raw)) return null;
  const { entryRoll, exactHomeRoll, extraTurnOnSix, extraTurnOnCapture, extraTurnOnHome, maxConsecutiveSixes, safeOffsets, gameEnd, stopWhenHumansFinished } = raw;
  if (
    !isDiceValue(entryRoll) ||
    typeof exactHomeRoll !== "boolean" ||
    typeof extraTurnOnSix !== "boolean" ||
    typeof extraTurnOnCapture !== "boolean" ||
    typeof extraTurnOnHome !== "boolean" ||
    !isInt(maxConsecutiveSixes) ||
    !Array.isArray(safeOffsets) ||
    !safeOffsets.every(isInt) ||
    (gameEnd !== "first_winner" && gameEnd !== "full_ranking") ||
    typeof stopWhenHumansFinished !== "boolean"
  ) {
    return null;
  }
  return { entryRoll, exactHomeRoll, extraTurnOnSix, extraTurnOnCapture, extraTurnOnHome, maxConsecutiveSixes, safeOffsets: [...safeOffsets], gameEnd, stopWhenHumansFinished };
}

function parseConfig(raw: unknown): LudoGameConfig | null {
  if (!isRecord(raw) || !isInt(raw.humanPlayers) || !Array.isArray(raw.players)) return null;
  const rules = parseRules(raw.rules);
  if (!rules) return null;
  const players: PlayerConfig[] = [];
  for (const p of raw.players) {
    if (!isRecord(p) || !isColor(p.color) || (p.type !== "human" && p.type !== "bot") || !isStr(p.name)) return null;
    players.push({ color: p.color, type: p.type, name: p.name });
  }
  const config: LudoGameConfig = { humanPlayers: raw.humanPlayers, players, rules };
  if (raw.startingColor !== undefined) {
    if (!isColor(raw.startingColor)) return null;
    config.startingColor = raw.startingColor;
  }
  return validateLudoConfig(config).length === 0 ? config : null;
}

function parseTokens(raw: unknown, config: LudoGameConfig): Token[] | null {
  if (!Array.isArray(raw)) return null;
  const players = createPlayers(config);
  const tokens: Token[] = [];
  for (const color of PLAYER_COLORS) {
    for (let index = 0; index < TOKENS_PER_PLAYER; index++) {
      const id = `${color}-${index}`;
      const entry = raw.find((t): t is Rec => isRecord(t) && t.id === id);
      const owner = players.find((p) => p.color === color);
      if (!entry || !owner || entry.playerId !== owner.id || entry.color !== color || entry.index !== index) return null;
      const { position, status } = entry;
      if (!isInt(position) || position < BASE_POSITION || position > HOME_POSITION) return null;
      const expected: TokenStatus = position === BASE_POSITION ? "base" : position === HOME_POSITION ? "home" : "active";
      if (status !== expected) return null;
      tokens.push({ id, playerId: owner.id, color, index, status: expected, position });
    }
  }
  return raw.length === tokens.length ? tokens : null;
}

function parseDice(raw: unknown, playerIds: readonly string[]): DiceState | null {
  if (!isRecord(raw)) return null;
  const { value, rolledBy, consecutiveSixes, rollCount } = raw;
  if (value !== null && !isDiceValue(value)) return null;
  if (rolledBy !== null && !(isStr(rolledBy) && playerIds.includes(rolledBy))) return null;
  if (!isInt(consecutiveSixes) || consecutiveSixes < 0 || !isInt(rollCount) || rollCount < 0) return null;
  return { value, rolledBy, consecutiveSixes, rollCount };
}

function parseCaptureLog(raw: unknown): CaptureRecord[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CaptureRecord[] = [];
  for (const r of raw) {
    if (
      !isRecord(r) || !isInt(r.turn) || !isStr(r.byPlayerId) || !isStr(r.byTokenId) ||
      !isStr(r.victimPlayerId) || !isStr(r.victimTokenId) || !isInt(r.trackIndex)
    ) return null;
    out.push({ turn: r.turn, byPlayerId: r.byPlayerId, byTokenId: r.byTokenId, victimPlayerId: r.victimPlayerId, victimTokenId: r.victimTokenId, trackIndex: r.trackIndex });
  }
  return out;
}

function parseLastAction(raw: unknown): LastAction | null {
  if (!isRecord(raw)) return null;
  const type = raw.type;
  if (type !== "ROLL_DICE" && type !== "MOVE_TOKEN" && type !== "PASS_TURN" && type !== "RESET_GAME") return null;
  const last: LastAction = { type, playerId: isStr(raw.playerId) ? raw.playerId : null };
  if (isDiceValue(raw.value)) last.value = raw.value;
  if (isStr(raw.tokenId)) last.tokenId = raw.tokenId;
  return last;
}

export function parseLudoState(raw: unknown): LudoState | null {
  if (!isRecord(raw) || raw.version !== LUDO_STATE_VERSION) return null;
  const config = parseConfig(raw.config);
  if (!config) return null;
  const players = createPlayers(config);
  const playerIds = players.map((p) => p.id);
  const tokens = parseTokens(raw.tokens, config);
  const dice = parseDice(raw.dice, playerIds);
  const captureLog = parseCaptureLog(raw.captureLog);
  if (!tokens || !dice || !captureLog) return null;

  const phase = PHASES.find((p) => p === raw.phase);
  if (!phase) return null;
  if (!isStr(raw.currentPlayerId) || !playerIds.includes(raw.currentPlayerId)) return null;
  const passReason = raw.passReason === null ? null : PASS_REASONS.find((r) => r === raw.passReason) ?? undefined;
  if (passReason === undefined) return null;
  const idList = (v: unknown): string[] | null =>
    Array.isArray(v) && v.every((x): x is string => isStr(x) && playerIds.includes(x)) ? [...v] : null;
  const finishedPlayerIds = idList(raw.finishedPlayerIds);
  const ranking = idList(raw.ranking);
  if (!finishedPlayerIds || !ranking) return null;
  if (raw.winner !== null && !(isStr(raw.winner) && playerIds.includes(raw.winner))) return null;
  if (!isInt(raw.turn) || raw.turn < 1 || !isInt(raw.rng)) return null;

  const legalMoves =
    phase === "awaiting_move" && dice.value !== null
      ? computeLegalMoves(tokens, raw.currentPlayerId, dice.value, config.rules)
      : [];
  if (phase === "awaiting_move" && legalMoves.length === 0) return null;
  if (phase === "awaiting_pass" && dice.value === null) return null;
  if (phase === "finished" && (ranking.length !== playerIds.length || raw.winner === null)) return null;
  if (phase !== "finished" && finishedPlayerIds.includes(raw.currentPlayerId)) return null;

  return {
    version: LUDO_STATE_VERSION,
    config,
    phase,
    players,
    tokens,
    currentPlayerId: raw.currentPlayerId,
    dice,
    legalMoves,
    passReason,
    winner: raw.winner,
    finishedPlayerIds,
    ranking,
    turn: raw.turn,
    rng: raw.rng >>> 0,
    lastAction: parseLastAction(raw.lastAction),
    events: [],
    captureLog,
  };
}
