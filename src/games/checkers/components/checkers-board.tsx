"use client";

import { BOARD_SIZE, colOf, isPlayable, rowOf, squareIndex } from "../engine/board";
import type { Board, Color } from "../engine/types";

interface CheckersBoardProps {
  board: Board;
  /** Whose side is at the bottom. Black players see the board flipped. */
  orientation: Color;
  from: number | null;
  pending: readonly number[];
  targets: ReadonlySet<number>;
  movableFrom: ReadonlySet<number>;
  /** Square the last click was refused on — briefly outlined in red. */
  rejected: number | null;
  /** Squares touched by the previous move, for a subtle trail. */
  lastMove: readonly number[];
  disabled: boolean;
  onSelect: (square: number) => void;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Human-readable square name, for screen readers. */
function squareName(square: number): string {
  return `${FILES[colOf(square)]}${BOARD_SIZE - rowOf(square)}`;
}

/**
 * The board. Presentational only: it renders what it is given and
 * reports clicks. Every rule lives in the engine, every decision about
 * what is selectable lives in `useCheckersSelection`.
 */
export function CheckersBoard({
  board,
  orientation,
  from,
  pending,
  targets,
  movableFrom,
  rejected,
  lastMove,
  disabled,
  onSelect,
}: CheckersBoardProps) {
  // Row/col traversal order: White reads the board top-down, Black flipped.
  const rows = [...Array(BOARD_SIZE).keys()];
  const cols = [...Array(BOARD_SIZE).keys()];
  const orderedRows = orientation === "white" ? rows : [...rows].reverse();
  const orderedCols = orientation === "white" ? cols : [...cols].reverse();

  const chainHead = pending.length > 0 ? pending[pending.length - 1] : from;

  return (
    <div
      role="grid"
      aria-label="Damier"
      className="grid aspect-square w-full max-w-[min(90vw,32rem)] grid-cols-8 overflow-hidden rounded-2xl border border-slate-200/80 shadow-xl dark:border-white/10"
    >
      {orderedRows.map((row) =>
        orderedCols.map((col) => {
          const square = squareIndex(row, col);
          const dark = isPlayable(row, col);
          const piece = board[square];

          const isOrigin = square === from;
          const isChainHead = square === chainHead;
          const isTarget = targets.has(square);
          const isSteppedThrough = pending.includes(square);
          const isMovable = movableFrom.has(square) && from === null;
          const isRejected = square === rejected;
          const inLastMove = lastMove.includes(square);

          const clickable = !disabled && (dark || isTarget);

          return (
            <button
              key={square}
              type="button"
              role="gridcell"
              disabled={!clickable}
              onClick={() => onSelect(square)}
              aria-label={
                piece
                  ? `${squareName(square)}, ${piece.color === "white" ? "blanc" : "noir"} ${piece.kind === "king" ? "dame" : "pion"}`
                  : `${squareName(square)}, case vide`
              }
              aria-selected={isOrigin || isChainHead}
              className={[
                "relative flex items-center justify-center transition-colors",
                dark
                  ? "bg-amber-800/90 dark:bg-amber-950"
                  : "bg-amber-100 dark:bg-amber-200/80",
                clickable ? "cursor-pointer" : "cursor-default",
                inLastMove ? "ring-1 ring-inset ring-cyan-400/50" : "",
                isSteppedThrough ? "ring-2 ring-inset ring-emerald-400/70" : "",
                isRejected ? "ring-2 ring-inset ring-red-500" : "",
              ].join(" ")}
            >
              {/* Available destination */}
              {isTarget && !piece && (
                <span
                  aria-hidden
                  className="absolute size-1/3 rounded-full bg-emerald-400/80 shadow-[0_0_12px_2px_rgba(52,211,153,.55)]"
                />
              )}

              {piece && (
                <span
                  aria-hidden
                  className={[
                    "flex size-[78%] items-center justify-center rounded-full border-2 shadow-md transition-transform",
                    piece.color === "white"
                      ? "border-slate-300 bg-gradient-to-br from-slate-50 to-slate-300 text-slate-500"
                      : "border-slate-900 bg-gradient-to-br from-slate-700 to-slate-950 text-slate-300",
                    isOrigin || isChainHead
                      ? "scale-105 ring-2 ring-emerald-400"
                      : "",
                    isMovable ? "ring-1 ring-emerald-400/45" : "",
                  ].join(" ")}
                >
                  {piece.kind === "king" && (
                    <span className="text-[clamp(0.6rem,2.4vw,1.1rem)] font-bold leading-none">
                      ♛
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
