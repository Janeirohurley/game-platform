"use client";

import { useMemo } from "react";
import type { LudoState } from "../engine";
import { getCurrentPlayer, countTokens, getCaptureStats } from "../engine";
import { PLAYER_PALETTE } from "../utils/colors";
import { LABELS, PLAYER_COLOR_NAMES } from "../utils/labels";

export interface LudoPlayerPanelProps {
  state: LudoState;
  isHumanTurn: boolean;
  canRoll: boolean;
  busy: boolean;
}

export function LudoPlayerPanel({ state, isHumanTurn, canRoll, busy }: LudoPlayerPanelProps) {
  const current = useMemo(() => getCurrentPlayer(state), [state]);
  const palette = PLAYER_PALETTE[current.color];
  const counts = useMemo(() => countTokens(state, current.id), [state, current.id]);
  const captures = useMemo(() => getCaptureStats(state, current.id), [state, current.id]);

  const isBot = current.type === "bot";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-bold"
          style={{ backgroundColor: palette.main, color: palette.ink, border: `2px solid ${palette.dark}` }}
          aria-hidden="true"
        >
          {PLAYER_COLOR_NAMES[current.color].charAt(0)}
        </span>
        <div>
          <p className="text-sm font-semibold">{current.name}</p>
          <p className="text-xs text-slate-500 dark:text-white/50">
            {isBot ? "Bot" : isHumanTurn ? "You" : "Waiting"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-white/80 px-2.5 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-white/70">
          {LABELS.tokensHome(counts.home)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-white/80 px-2.5 py-1 text-xs text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-white/70">
          {captures.captures} captures
        </span>
      </div>

      {isBot && state.phase !== "finished" && (
        <p className="text-xs text-slate-500 dark:text-white/50">
          {LABELS.botTurn(current.name)}
        </p>
      )}

      {isHumanTurn && !busy && state.phase === "awaiting_roll" && canRoll && (
        <p className="text-xs text-slate-500 dark:text-white/50">{LABELS.roll}</p>
      )}

      {isHumanTurn && !busy && state.phase === "awaiting_move" && (
        <p className="text-xs text-slate-500 dark:text-white/50">{LABELS.chooseToken}</p>
      )}
    </div>
  );
}
