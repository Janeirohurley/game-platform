import {
  COLOR_LABELS,
  DEFAULT_RULES,
  MAX_HUMAN_PLAYERS,
  MIN_HUMAN_PLAYERS,
  PLAYER_COLORS,
  PLAYER_COUNT,
  TRACK_LENGTH,
} from "./constants";
import { isDiceValue } from "./dice";
import type { LudoGameConfig, LudoRules, Player, PlayerColor, PlayerConfig } from "./types";

export interface ConfigIssue {
  path: string;
  message: string;
}

export class LudoConfigError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(`Invalid Ludo configuration: ${issues.map((i) => `${i.path}: ${i.message}`).join("; ")}`);
    this.name = "LudoConfigError";
    this.issues = issues;
  }
}

export interface CreateConfigOptions {
  humanPlayers: number;
  /** Names of the human players, in seat order. Missing names get a default. */
  names?: readonly string[];
  rules?: Partial<LudoRules>;
  startingColor?: PlayerColor;
}

export function defaultPlayerName(type: "human" | "bot", color: PlayerColor, seat: number): string {
  return type === "human" ? `Player ${seat + 1}` : `Bot ${COLOR_LABELS[color]}`;
}

/**
 * Deterministic seat assignment: the first `humanPlayers` seats (Red, Green, Yellow, Blue order)
 * are humans, the remaining seats are bots. One code path for 1, 2, 3 and 4 humans.
 */
export function createLudoConfig(options: CreateConfigOptions): LudoGameConfig {
  const { humanPlayers, names = [], rules, startingColor } = options;
  const players: PlayerConfig[] = PLAYER_COLORS.map((color, seat) => {
    const type = seat < humanPlayers ? "human" : "bot";
    const custom = type === "human" ? names[seat]?.trim() : undefined;
    return { color, type, name: custom ? custom : defaultPlayerName(type, color, seat) };
  });
  const config: LudoGameConfig = {
    humanPlayers,
    players,
    rules: { ...DEFAULT_RULES, ...rules },
    ...(startingColor ? { startingColor } : {}),
  };
  assertValidConfig(config);
  return config;
}

export function validateLudoConfig(config: LudoGameConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const add = (path: string, message: string): void => {
    issues.push({ path, message });
  };

  if (!Number.isInteger(config.humanPlayers) || config.humanPlayers < MIN_HUMAN_PLAYERS || config.humanPlayers > MAX_HUMAN_PLAYERS) {
    add("humanPlayers", `must be an integer between ${MIN_HUMAN_PLAYERS} and ${MAX_HUMAN_PLAYERS}`);
  }
  if (config.players.length !== PLAYER_COUNT) {
    add("players", `must contain exactly ${PLAYER_COUNT} players`);
  } else {
    const seen = new Set<PlayerColor>();
    let humans = 0;
    config.players.forEach((p, i) => {
      if (!PLAYER_COLORS.includes(p.color)) add(`players[${i}].color`, "unknown colour");
      else if (seen.has(p.color)) add(`players[${i}].color`, "duplicate colour");
      seen.add(p.color);
      if (p.type !== "human" && p.type !== "bot") add(`players[${i}].type`, "must be human or bot");
      if (p.type === "human") humans += 1;
      if (typeof p.name !== "string" || p.name.trim().length === 0) add(`players[${i}].name`, "must not be empty");
    });
    if (humans !== config.humanPlayers) add("humanPlayers", "does not match the number of human seats");
  }
  if (config.startingColor !== undefined && !PLAYER_COLORS.includes(config.startingColor)) {
    add("startingColor", "unknown colour");
  }

  const r = config.rules;
  if (!isDiceValue(r.entryRoll)) add("rules.entryRoll", "must be a die value (1-6)");
  if (!Number.isInteger(r.maxConsecutiveSixes) || r.maxConsecutiveSixes < 0) {
    add("rules.maxConsecutiveSixes", "must be an integer >= 0");
  }
  if (r.safeOffsets.some((o) => !Number.isInteger(o) || o < 0 || o >= TRACK_LENGTH)) {
    add("rules.safeOffsets", `offsets must be integers between 0 and ${TRACK_LENGTH - 1}`);
  }
  if (r.gameEnd !== "first_winner" && r.gameEnd !== "full_ranking") {
    add("rules.gameEnd", "must be first_winner or full_ranking");
  }
  return issues;
}

export function assertValidConfig(config: LudoGameConfig): void {
  const issues = validateLudoConfig(config);
  if (issues.length > 0) throw new LudoConfigError(issues);
}

/** Players in seat order (Red, Green, Yellow, Blue). */
export function createPlayers(config: LudoGameConfig): Player[] {
  return PLAYER_COLORS.map((color, seat) => {
    const entry = config.players.find((p) => p.color === color);
    if (!entry) throw new LudoConfigError([{ path: "players", message: `missing ${color} player` }]);
    return { id: `player-${color}`, name: entry.name.trim(), type: entry.type, color, seat };
  });
}