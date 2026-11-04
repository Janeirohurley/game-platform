"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CrownIcon } from "@hugeicons/core-free-icons";

import { countPieces } from "../engine/board";
import type { Board, Color, GameOutcome } from "../engine/types";

interface GameStatusProps {
  board: Board;
  turn: Color;
  outcome: GameOutcome;
  /** Label for each side — player names online, "Blancs"/"Noirs" locally. */
  labels: Record<Color, string>;
  /** The colour the viewer plays, when they play one (online). */
  viewerColor?: Color;
  /** Set when the viewer just tried something illegal. */
  invalidHint?: boolean;
}

const COLOR_NAMES: Record<Color, string> = {
  white: "Blancs",
  black: "Noirs",
};

function outcomeText(outcome: GameOutcome, labels: Record<Color, string>): string {
  if (outcome.kind === "draw") {
    return "Partie nulle — 50 demi-coups sans capture ni promotion.";
  }
  if (outcome.kind === "win") {
    const reason =
      outcome.reason === "captured-all"
        ? "toutes les pièces adverses sont capturées"
        : "l'adversaire n'a plus aucun coup légal";
    return `${labels[outcome.winner]} gagnent — ${reason}.`;
  }
  return "";
}

/**
 * Turn indicator, material count and end-of-game banner. Shared by the
 * local and online views so both read identically.
 */
export function GameStatus({
  board,
  turn,
  outcome,
  labels,
  viewerColor,
  invalidHint,
}: GameStatusProps) {
  const finished = outcome.kind !== "playing";

  return (
    <div className="w-full max-w-[min(90vw,32rem)]">
      {finished ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
        >
          <HugeiconsIcon icon={CrownIcon} size={16} strokeWidth={1.8} />
          <span>{outcomeText(outcome, labels)}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.035]">
          <p className="flex items-center gap-2 text-sm" role="status">
            <span
              aria-hidden
              className={[
                "size-3 rounded-full border",
                turn === "white"
                  ? "border-slate-300 bg-slate-100"
                  : "border-slate-900 bg-slate-800",
              ].join(" ")}
            />
            <span className="font-medium">
              {viewerColor && turn === viewerColor
                ? "À toi de jouer"
                : `Au tour des ${COLOR_NAMES[turn].toLowerCase()}`}
            </span>
            {viewerColor && (
              <span className="text-xs text-slate-400 dark:text-white/35">
                · tu joues les {COLOR_NAMES[viewerColor].toLowerCase()}
              </span>
            )}
          </p>

          <p className="flex items-center gap-3 text-xs text-slate-500 dark:text-white/45">
            <span>{`${labels.white} : ${countPieces(board, "white")}`}</span>
            <span aria-hidden>·</span>
            <span>{`${labels.black} : ${countPieces(board, "black")}`}</span>
          </p>
        </div>
      )}

      {invalidHint && !finished && (
        <p
          role="alert"
          className="mt-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400"
        >
          <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={1.8} />
          Coup impossible. La prise est obligatoire quand elle existe, et il
          faut jouer la plus longue.
        </p>
      )}
    </div>
  );
}
