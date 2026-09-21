"use client";

import { useMemo } from "react";
import type { LudoState } from "../engine";
import { getCurrentPlayer } from "../engine";
import { LABELS, PLAYER_COLOR_NAMES } from "../utils/labels";
import { PLAYER_PALETTE } from "../utils/colors";

export interface LudoGameHeaderProps {
  state: LudoState;
}

export function LudoGameHeader({ state }: LudoGameHeaderProps) {
  const current = useMemo(() => getCurrentPlayer(state), [state]);

  const phaseLabel =
    state.phase === "finished"
      ? LABELS.gameOverTitle
      : state.phase === "awaiting_roll"
        ? "Roll"
        : state.phase === "awaiting_move"
          ? "Move"
          : "Pass";

  return (
    <header className="border-b border-slate-200/80 pb-4 dark:border-white/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight">Ludo</span>
          <span className="text-xs text-slate-500 dark:text-white/50">Round {state.turn}</span>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-sm text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-white"
            aria-live="polite"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: PLAYER_PALETTE[current.color]?.main ?? "#888" }}
              aria-hidden="true"
            />
            <span>
              {state.phase === "finished"
                ? LABELS.finished
                : `${LABELS.currentPlayer(current.name, PLAYER_COLOR_NAMES[current.color])} — ${phaseLabel}`}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}
