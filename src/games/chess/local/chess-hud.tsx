"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Menu01Icon,
  Refresh01Icon,
  Rotate01Icon,
} from "@hugeicons/core-free-icons";

import type { ChessMode, ChessSnapshot } from "../types";
import { pieceGlyph } from "./piece-glyphs";

interface ChessHudProps {
  snapshot: ChessSnapshot;
  mode: ChessMode | null;
  onMenu: () => void;
  onRestart: () => void;
  onFlip: () => void;
}

const MODE_LABELS: Record<ChessMode, string> = {
  hotseat: "Deux joueurs",
  "vs-bot-white": "Blancs contre l'IA",
  "vs-bot-black": "Noirs contre l'IA",
};

function sideName(side: "w" | "b"): string {
  return side === "w" ? "Blancs" : "Noirs";
}

/**
 * Compact floating HUD. The board stays the main surface; every control is
 * a small icon button so the 3D scene is never buried under chrome.
 */
export function ChessHud({
  snapshot,
  mode,
  onMenu,
  onRestart,
  onFlip,
}: ChessHudProps) {
  const turnLabel = snapshot.isGameOver
    ? "Partie terminée"
    : `Aux ${sideName(snapshot.turn)} de jouer`;
  const lastMoves = snapshot.history.slice(-4);
  const capturedWhite = snapshot.capturedBy.w;
  const capturedBlack = snapshot.capturedBy.b;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-[#080d15]/80 px-3 py-2 text-white shadow-lg backdrop-blur-md">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            {mode ? MODE_LABELS[mode] : "Partie libre"}
          </p>
          <p
            className="mt-0.5 flex items-center gap-2 text-sm font-semibold"
            aria-live="polite"
          >
            {turnLabel}
            {snapshot.inCheck && !snapshot.isGameOver && (
              <span className="rounded-md bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-300">
                Échec
              </span>
            )}
            {snapshot.isThinking && !snapshot.isGameOver && (
              <span className="text-[10px] font-medium text-amber-300/80">
                L&apos;IA réfléchit…
              </span>
            )}
          </p>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onFlip}
            title="Retourner la caméra"
            aria-label="Retourner la caméra"
            className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-[#080d15]/80 text-white/65 shadow-lg backdrop-blur-md transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <HugeiconsIcon icon={Rotate01Icon} size={17} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={onRestart}
            title="Nouvelle partie"
            aria-label="Nouvelle partie"
            className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-[#080d15]/80 text-white/65 shadow-lg backdrop-blur-md transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <HugeiconsIcon icon={Refresh01Icon} size={17} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={onMenu}
            title="Menu des modes"
            aria-label="Menu des modes"
            className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-[#080d15]/80 text-white/65 shadow-lg backdrop-blur-md transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <HugeiconsIcon icon={Menu01Icon} size={17} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center gap-2 text-[11px] text-white/55">
        <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#080d15]/70 px-2 py-1 backdrop-blur-md">
          <span className="text-white/30">Blancs</span>
          <span className="tracking-tight text-white/80">
            {capturedWhite.length > 0
              ? capturedWhite.map((type) => pieceGlyph("b", type)).join("")
              : "—"}
          </span>
        </span>
        <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#080d15]/70 px-2 py-1 backdrop-blur-md">
          <span className="text-white/30">Noirs</span>
          <span className="tracking-tight text-white/80">
            {capturedBlack.length > 0
              ? capturedBlack.map((type) => pieceGlyph("w", type)).join("")
              : "—"}
          </span>
        </span>

        {lastMoves.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#080d15]/70 px-2 py-1 backdrop-blur-md">
            {lastMoves.map((move, index) => (
              <span
                key={`${move.from}-${move.to}-${index}`}
                className="font-mono text-white/65"
              >
                {move.san}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
