"use client";

import { useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";

import { CheckersBoard } from "../components/checkers-board";
import { GameStatus } from "../components/game-status";
import { useCheckersSelection } from "../use-checkers-selection";
import { useLocalCheckers } from "./use-local-checkers";

const LABELS = { white: "Blancs", black: "Noirs" } as const;

/**
 * Two players, one device, no server.
 *
 * The board is always shown from White's side: on a shared screen a
 * board that flips every turn is disorienting, and both players sit in
 * front of the same screen anyway.
 */
export function LocalCheckers() {
  const { state, lastMove, play, reset } = useLocalCheckers();

  const playing = state.outcome.kind === "playing";
  const { from, pending, targets, movableFrom, rejected, select, reset: clearSelection } =
    useCheckersSelection(state, playing, play);

  const handleReset = useCallback(() => {
    clearSelection();
    reset();
  }, [clearSelection, reset]);

  return (
    <div className="flex flex-col items-center gap-4">
      <GameStatus
        board={state.board}
        turn={state.turn}
        outcome={state.outcome}
        labels={LABELS}
        invalidHint={rejected !== null}
      />

      <CheckersBoard
        board={state.board}
        orientation="white"
        from={from}
        pending={pending}
        targets={targets}
        movableFrom={movableFrom}
        rejected={rejected}
        lastMove={lastMove}
        disabled={!playing}
        onSelect={select}
      />

      <button
        type="button"
        onClick={handleReset}
        className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-semibold transition hover:bg-slate-950 hover:text-white dark:border-white/10 dark:hover:bg-white dark:hover:text-black"
      >
        <HugeiconsIcon icon={RefreshIcon} size={16} strokeWidth={1.8} />
        <span>{playing ? "Recommencer" : "Nouvelle partie"}</span>
      </button>
    </div>
  );
}
