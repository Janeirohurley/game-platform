"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Rotate01Icon } from "@hugeicons/core-free-icons";

import type { ChessColor } from "../types";
import type { OnlineChessOutcome } from "./use-online-chess";

interface ChessOnlineHudProps {
  labels: Record<ChessColor, string>;
  turnColor: ChessColor;
  viewerColor: ChessColor | null;
  canPlay: boolean;
  turnSecondsLeft: number;
  history: string[];
  outcome: OnlineChessOutcome;
  onFlip: () => void;
}

/**
 * Mirror of the room's turn clock and recent moves. Player names, presence
 * and the turn ring already live in `MatchHud`; this strip only adds what
 * the 3D board cannot show by itself.
 */
export function ChessOnlineHud({
  labels,
  turnColor,
  viewerColor,
  canPlay,
  turnSecondsLeft,
  history,
  outcome,
  onFlip,
}: ChessOnlineHudProps) {
  const playing = outcome === "playing";
  const lowTime = turnSecondsLeft > 0 && turnSecondsLeft <= 15;

  const turnLabel = !playing
    ? "Partie terminée"
    : canPlay
      ? "À toi de jouer"
      : viewerColor
        ? "Tour adverse"
        : `Au tour de ${labels[turnColor]}`;

  const lastMoves = history.slice(-4);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex flex-col items-center gap-1.5 px-3 sm:top-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-[#080d15]/85 px-3 py-1.5 text-white shadow-lg backdrop-blur-md">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">
          En ligne
        </span>
        <span aria-hidden className="h-3 w-px bg-white/15" />
        <span className="text-sm font-semibold" role="status">
          {turnLabel}
        </span>
        {playing && turnSecondsLeft > 0 && (
          <span
            className={`text-sm font-semibold tabular-nums ${
              lowTime ? "text-red-400" : "text-white/65"
            }`}
          >
            {`${turnSecondsLeft}s`}
          </span>
        )}

        <button
          type="button"
          onClick={onFlip}
          title="Retourner la caméra"
          aria-label="Retourner la caméra"
          className="ml-1 flex size-7 items-center justify-center rounded-md border border-white/10 text-white/65 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          <HugeiconsIcon icon={Rotate01Icon} size={14} strokeWidth={1.8} />
        </button>
      </div>

      {lastMoves.length > 0 && (
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#080d15]/70 px-2 py-1 text-[11px] shadow-lg backdrop-blur-md">
          {lastMoves.map((san, index) => (
            <span key={`${san}-${index}`} className="font-mono text-white/65">
              {san}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
