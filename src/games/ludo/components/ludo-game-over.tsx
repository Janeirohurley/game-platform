"use client";

import { useMemo } from "react";
import type { LudoState } from "../engine";
import { getStandings, getCurrentPlayer } from "../engine";
import { PLAYER_PALETTE } from "../utils/colors";
import { LABELS, PLAYER_COLOR_NAMES } from "../utils/labels";

export interface LudoGameOverProps {
  state: LudoState;
  onRestart: () => void;
}

export function LudoGameOver({ state, onRestart }: LudoGameOverProps) {
  const standings = useMemo(() => getStandings(state), [state]);
  const current = useMemo(() => getCurrentPlayer(state), [state]);

  const winner = standings[0];

  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">{LABELS.gameOverTitle}</h2>

      <div className="flex items-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold"
          style={{
            backgroundColor: PLAYER_PALETTE[current.color]?.main,
            color: PLAYER_PALETTE[current.color]?.ink,
            border: `2px solid ${PLAYER_PALETTE[current.color]?.dark}`,
          }}
          aria-hidden="true"
        >
          {PLAYER_COLOR_NAMES[current.color].charAt(0)}
        </span>
        <p className="text-lg text-slate-700 dark:text-white/90">
          {LABELS.winner(
            winner.playerId === state.winner ? "You" : winner.playerId === current.id ? current.name : winner.playerId,
          )}
        </p>
      </div>

      <div className="w-full max-w-sm">
        <p className="mb-2 text-sm font-semibold tracking-tight">{LABELS.rankingPrefix}</p>
        <ol className="flex flex-col gap-2 text-left">
          {standings.map((entry) => {
            const player = state.players.find((p) => p.id === entry.playerId);
            const color = player?.color ?? "red";
            const palette = PLAYER_PALETTE[color];
            return (
              <li key={entry.playerId} className="rounded-lg border border-slate-200/80 bg-white/80 px-4 py-2 text-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold"
                    style={{ backgroundColor: palette.main, color: palette.ink, border: `1px solid ${palette.dark}` }}
                  >
                    {PLAYER_COLOR_NAMES[color].charAt(0)}
                  </span>
                  <span className="flex-1 font-medium">
                    {entry.playerId === state.winner ? "You" : player?.name ?? "?"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-white/50">
                    {entry.finished ? `${LABELS.tokensHome(entry.tokensHome)}` : `${entry.tokensHome}/4 home`}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-white/50">#{entry.rank}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <button
        type="button"
        className="rounded-lg border border-slate-950 bg-slate-950 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-black"
        onClick={onRestart}
      >
        {LABELS.restart}
      </button>
    </div>
  );
}
