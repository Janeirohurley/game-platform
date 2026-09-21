import {
  BASE_POSITION,
  HOME_COLUMN_LENGTH,
  HOME_COLUMN_START,
  HOME_POSITION,
  LAST_TRACK_POSITION,
  PLAYER_COLORS,
  START_OFFSET,
  TRACK_LENGTH,
} from "./constants";
import type { BoardCell, GridCoord, PlayerColor, Point } from "./types";

/**
 * Board model (15 x 15 grid, row 0 = top, col 0 = left).
 *
 *   red    base top-left      green  base top-right
 *   blue   base bottom-left   yellow base bottom-right
 *
 * The shared track has 52 cells, numbered clockwise from red's start square (6,1).
 * Each colour starts 13 cells further along, and leaves the track for its private
 * home column after 51 cells (relative positions 0..50).
 */

type Segment = readonly [row: number, col: number, dRow: number, dCol: number, count: number];

const TRACK_SEGMENTS: readonly Segment[] = [
  [6, 1, 0, 1, 5], //   (6,1)  → (6,5)    red start … left arm, top row
  [5, 6, -1, 0, 6], //  (5,6)  → (0,6)    up the top-left column
  [0, 7, 0, 1, 2], //   (0,7)  → (0,8)    top edge
  [1, 8, 1, 0, 5], //   (1,8)  → (5,8)    green start … down the top-right column
  [6, 9, 0, 1, 6], //   (6,9)  → (6,14)   right arm, top row
  [7, 14, 1, 0, 2], //  (7,14) → (8,14)   right edge
  [8, 13, 0, -1, 5], // (8,13) → (8,9)    yellow start … right arm, bottom row
  [9, 8, 1, 0, 6], //   (9,8)  → (14,8)   down the bottom-right column
  [14, 7, 0, -1, 2], // (14,7) → (14,6)   bottom edge
  [13, 6, -1, 0, 5], // (13,6) → (9,6)    blue start … up the bottom-left column
  [8, 5, 0, -1, 6], //  (8,5)  → (8,0)    left arm, bottom row
  [7, 0, -1, 0, 2], //  (7,0)  → (6,0)    left edge
];

function line(row: number, col: number, dRow: number, dCol: number, count: number): GridCoord[] {
  const out: GridCoord[] = [];
  for (let i = 0; i < count; i++) out.push({ row: row + dRow * i, col: col + dCol * i });
  return out;
}

export const TRACK_COORDS: readonly GridCoord[] = TRACK_SEGMENTS.flatMap(([r, c, dr, dc, n]) =>
  line(r, c, dr, dc, n),
);

export const HOME_COLUMN_COORDS: Readonly<Record<PlayerColor, readonly GridCoord[]>> = {
  red: line(7, 1, 0, 1, HOME_COLUMN_LENGTH),
  green: line(1, 7, 1, 0, HOME_COLUMN_LENGTH),
  yellow: line(7, 13, 0, -1, HOME_COLUMN_LENGTH),
  blue: line(13, 7, -1, 0, HOME_COLUMN_LENGTH),
};

/** Top-left grid corner of each colour's 6x6 base area. */
export const BASE_ORIGINS: Readonly<Record<PlayerColor, GridCoord>> = {
  red: { row: 0, col: 0 },
  green: { row: 0, col: 9 },
  yellow: { row: 9, col: 9 },
  blue: { row: 9, col: 0 },
};

export const BASE_AREA_SIZE = 6;
export const CENTER_ORIGIN: GridCoord = { row: 6, col: 6 };
export const CENTER_SIZE = 3;

/** Absolute track index of each colour's start square. */
export const START_TRACK_INDEX: Readonly<Record<PlayerColor, number>> = {
  red: 0,
  green: START_OFFSET,
  yellow: START_OFFSET * 2,
  blue: START_OFFSET * 3,
};

/* ---------------- safe cells ---------------- */

const safeCache = new Map<string, ReadonlySet<number>>();

/** Absolute track indices that are safe for the given offsets-from-start rule. */
export function getSafeTrackIndices(safeOffsets: readonly number[]): ReadonlySet<number> {
  const key = safeOffsets.join(",");
  const cached = safeCache.get(key);
  if (cached) return cached;
  const set = new Set<number>();
  for (const color of PLAYER_COLORS) {
    for (const offset of safeOffsets) {
      set.add((START_TRACK_INDEX[color] + offset) % TRACK_LENGTH);
    }
  }
  safeCache.set(key, set);
  return set;
}

/* ---------------- cell mapping ---------------- */

/** Absolute track index of a token position, or null when the token is not on the shared track. */
export function getTrackIndex(color: PlayerColor, position: number): number | null {
  if (position < 0 || position > LAST_TRACK_POSITION) return null;
  return (START_TRACK_INDEX[color] + position) % TRACK_LENGTH;
}

export function trackCellId(index: number): string {
  return `track-${index}`;
}

export function homeColumnCellId(color: PlayerColor, index: number): string {
  return `home-${color}-${index}`;
}

/** Every drawable cell of the board as data (track, start squares, home columns). */
export function createBoardCells(safeOffsets: readonly number[]): BoardCell[] {
  const safe = getSafeTrackIndices(safeOffsets);
  const cells: BoardCell[] = [];
  TRACK_COORDS.forEach((coord, index) => {
    const owner = PLAYER_COLORS.find((c) => START_TRACK_INDEX[c] === index);
    cells.push({
      id: trackCellId(index),
      type: owner ? "start" : "track",
      row: coord.row,
      col: coord.col,
      isSafe: safe.has(index),
      playerColor: owner,
      trackIndex: index,
    });
  });
  for (const color of PLAYER_COLORS) {
    HOME_COLUMN_COORDS[color].forEach((coord, index) => {
      cells.push({
        id: homeColumnCellId(color, index),
        type: "home_column",
        row: coord.row,
        col: coord.col,
        isSafe: true,
        playerColor: color,
        homeColumnIndex: index,
      });
    });
  }
  return cells;
}

/* ---------------- geometry (board units: one cell = 1 x 1) ---------------- */

export function cellCenter(coord: GridCoord): Point {
  return { x: coord.col + 0.5, y: coord.row + 0.5 };
}

export function getBaseSlotPoint(color: PlayerColor, tokenIndex: number): Point {
  const origin = BASE_ORIGINS[color];
  return {
    x: origin.col + 1.75 + (tokenIndex % 2) * 2.5,
    y: origin.row + 1.75 + Math.floor(tokenIndex / 2) * 2.5,
  };
}

const FINISH_AXIS: Readonly<Record<PlayerColor, Point>> = {
  red: { x: 1, y: 0 },
  green: { x: 0, y: 1 },
  yellow: { x: -1, y: 0 },
  blue: { x: 0, y: -1 },
};

/** Where finished tokens are parked inside their colour's centre triangle. */
export function getFinishSlotPoint(color: PlayerColor, tokenIndex: number): Point {
  const axis = FINISH_AXIS[color];
  const centre = CENTER_ORIGIN.col + CENTER_SIZE / 2;
  const bx = centre - axis.x * 0.95;
  const by = centre - axis.y * 0.95;
  const along = (tokenIndex % 2 - 0.5) * 0.34;
  const across = (Math.floor(tokenIndex / 2) - 0.5) * 0.38;
  return { x: bx + axis.x * along - axis.y * across, y: by + axis.y * along + axis.x * across };
}

/** Board-space point for a token position. */
export function getTokenPoint(color: PlayerColor, position: number, tokenIndex: number): Point {
  if (position === BASE_POSITION) return getBaseSlotPoint(color, tokenIndex);
  if (position >= HOME_POSITION) return getFinishSlotPoint(color, tokenIndex);
  if (position >= HOME_COLUMN_START) {
    return cellCenter(HOME_COLUMN_COORDS[color][position - HOME_COLUMN_START]);
  }
  const index = getTrackIndex(color, position);
  if (index === null) throw new RangeError(`Invalid token position: ${position}`);
  return cellCenter(TRACK_COORDS[index]);
}