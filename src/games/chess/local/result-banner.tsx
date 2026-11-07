"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ChessKingIcon,
  Refresh01Icon,
  Settings01Icon,
  TrophyIcon,
} from "@hugeicons/core-free-icons";

import type { ChessSnapshot } from "../types";

interface ResultBannerProps {
  snapshot: ChessSnapshot;
  onRestart: () => void;
  onMenu: () => void;
}

const DRAW_LABELS: Record<string, string> = {
  stalemate: "Pat : le roi n'est pas en échec mais aucun coup n'est possible.",
  "fifty-move": "Nulle par la règle des 50 coups.",
  threefold: "Nulle par répétition triple de la position.",
  "insufficient-material": "Nulle : matériel insuffisant pour mater.",
  draw: "La partie se termine par un match nul.",
};

/** End-of-game panel. The 3D scene keeps its own celebration animation. */
export function ResultBanner({
  snapshot,
  onRestart,
  onMenu,
}: ResultBannerProps) {
  const winner = snapshot.winner;
  const title = winner
    ? `Les ${winner === "w" ? "Blancs" : "Noirs"} gagnent`
    : "Partie nulle";
  const subtitle = winner
    ? "Échec et mat"
    : (snapshot.endReason && DRAW_LABELS[snapshot.endReason]) ??
      "La partie est terminée.";

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 p-3 sm:p-4">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-white/15 bg-[#080d15]/92 p-4 text-white shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
            <HugeiconsIcon
              icon={winner ? TrophyIcon : ChessKingIcon}
              size={20}
              strokeWidth={1.7}
            />
          </span>
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-black transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <HugeiconsIcon icon={Refresh01Icon} size={15} strokeWidth={1.8} />
            Rejouer
          </button>
          <button
            type="button"
            onClick={onMenu}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-white/65 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <HugeiconsIcon icon={Settings01Icon} size={15} strokeWidth={1.8} />
            Modes
          </button>
        </div>
      </div>
    </div>
  );
}
