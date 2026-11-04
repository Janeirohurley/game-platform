"use client";

import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping } from "three";

import { BOARD_SIZE, colOf, rowOf, squareIndex } from "../engine/board";
import type { Board, Color } from "../engine/types";
import { CheckersScene } from "./checkers-scene";

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
      className="relative w-full max-w-[min(96vw,52rem)] overflow-hidden rounded-md border border-[#4a2c20] bg-[#160f0d] shadow-[0_24px_54px_rgba(23,9,3,.46)]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,202,113,.15),transparent_34%),linear-gradient(180deg,#1e0e09_0%,#0e0706_100%)]" />

      <div
        className="pointer-events-none absolute left-5 top-4 z-10 flex items-center gap-3 text-[10px] font-semibold tracking-[0.28em] text-amber-100/70 sm:left-7 sm:top-5"
      >
        <span className="size-1.5 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,.85)]" />
        SALON DES DAMES
      </div>

      <div
        role="grid"
        aria-label="Damier"
        className="sr-only"
      >
      {orderedRows.map((row) =>
        orderedCols.map((col) => {
          const square = squareIndex(row, col);
          const piece = board[square];

          const isOrigin = square === from;
          const isChainHead = square === chainHead;
          const isTarget = targets.has(square);
          const isSteppedThrough = pending.includes(square);
          const isMovable = movableFrom.has(square) && from === null;
          const isRejected = square === rejected;
          const inLastMove = lastMove.includes(square);

          const clickable = !disabled && (row + col) % 2 === 1;

          // Un seul noeud texte, enveloppe dans un <span> : les traductions
          // navigateur remplacent les noeuds texte nus par des <font>, et
          // React plante ensuite en supprimant un noeud qu'il ne possede
          // plus. Un element stable evite ce cas.
          const description = [
            inLastMove ? "Dernier coup" : null,
            isSteppedThrough ? "Prise en chaîne" : null,
            isRejected ? "Coup refusé" : null,
            isMovable ? "Coup disponible" : null,
            isTarget ? "Destination disponible" : null,
          ]
            .filter(Boolean)
            .join(". ");

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
              className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              {description ? <span>{description}</span> : null}
            </button>
          );
        }),
      )}
      </div>

      <div className="relative aspect-[16/10] min-h-[20rem] sm:min-h-[28rem]">
        <Canvas
          shadows="percentage"
          dpr={[1, 2]}
          camera={{ position: [0, 4.4, 9], fov: 50, near: 0.1, far: 60 }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 1.24,
          }}
          onCreated={({ gl }) => {
            gl.domElement.style.touchAction = "none";
          }}
          className={disabled ? "cursor-default" : "cursor-pointer"}
        >
          <CheckersScene
            board={board}
            orientation={orientation}
            from={from}
            pending={pending}
            targets={targets}
            movableFrom={movableFrom}
            rejected={rejected}
            lastMove={lastMove}
            disabled={disabled}
            onSelect={onSelect}
          />
        </Canvas>
      </div>
    </div>
  );
}
