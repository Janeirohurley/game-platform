import type { DiceValue, LudoRules, PlayerColor } from "./types";


export const LUDO_STATE_VERSION = 1;

export const PLAYER_COLORS: readonly PlayerColor[] = ["red", "green", "yellow", "blue"];
export const PLAYER_COUNT = PLAYER_COLORS.length;
export const TOKENS_PER_PLAYER = 4;

export const MIN_HUMAN_PLAYERS = 1;
export const MAX_HUMAN_PLAYERS = PLAYER_COUNT;

export const BOARD_SIZE = 15;
export const TRACK_LENGTH = 52;
/** Distance (in track cells) between two consecutive colours' start squares. */
export const START_OFFSET = TRACK_LENGTH / PLAYER_COUNT;

/* Token positions, relative to the token's own colour. */
export const BASE_POSITION = -1;
export const START_POSITION = 0;
export const LAST_TRACK_POSITION = 50;
export const HOME_COLUMN_START = 51;
export const HOME_COLUMN_LENGTH = 5;
export const HOME_POSITION = 56;

export const DICE_VALUES: readonly DiceValue[] = [1, 2, 3, 4, 5, 6];
export const DICE_MAX = 6;

export const DEFAULT_RULES: LudoRules = {
  entryRoll: 6,
  exactHomeRoll: true,
  extraTurnOnSix: true,
  extraTurnOnCapture: true,
  extraTurnOnHome: true,
  maxConsecutiveSixes: 3,
  safeOffsets: [0, 8],
  gameEnd: "full_ranking",
  stopWhenHumansFinished: true,
};

export const COLOR_LABELS: Readonly<Record<PlayerColor, string>> = {
  red: "Red",
  green: "Green",
  yellow: "Yellow",
  blue: "Blue",
};