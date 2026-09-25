"use client";

import { useCallback, useMemo, useState } from "react";

import { legalMovesFrom } from "./engine/rules";
import type { GameState, Move } from "./engine/types";

/**
 * Board interaction, shared by the local and online views.
 *
 * Captures can chain, and two different chains may end on the same
 * square, so a destination alone does not identify a move. The player
 * therefore walks the path one landing square at a time: each click
 * narrows the candidate moves until exactly one path is complete, which
 * is then committed. Simple moves complete on the first click.
 *
 * The hook only ever *proposes* a move through `onCommit`. It never
 * mutates game state — that belongs to the local reducer or, online, to
 * the server.
 */

export interface CheckersSelection {
  /** Currently selected origin square, or null. */
  from: number | null;
  /** Landing squares already chosen in an in-progress capture chain. */
  pending: readonly number[];
  /** Squares that can be clicked next, mapped to nothing but membership. */
  targets: ReadonlySet<number>;
  /** Squares holding a piece the player may pick up right now. */
  movableFrom: ReadonlySet<number>;
  /** Set when the last click was rejected — drives the invalid-move hint. */
  rejected: number | null;
  select: (square: number) => void;
  reset: () => void;
}

export function useCheckersSelection(
  state: GameState,
  canPlay: boolean,
  onCommit: (move: Move) => void,
): CheckersSelection {
  const [from, setFrom] = useState<number | null>(null);
  const [pending, setPending] = useState<readonly number[]>([]);
  const [rejected, setRejected] = useState<number | null>(null);

  /** Origins the side to move may actually use — mandatory captures included. */
  const movableFrom = useMemo(() => {
    if (!canPlay) return new Set<number>();
    const origins = new Set<number>();
    for (let square = 0; square < state.board.length; square++) {
      if (legalMovesFrom(state, square).length > 0) origins.add(square);
    }
    return origins;
  }, [state, canPlay]);

  /** Moves still compatible with the path walked so far. */
  const candidates = useMemo(() => {
    if (from === null) return [] as Move[];
    return legalMovesFrom(state, from).filter((move) =>
      pending.every((step, index) => move.path[index] === step),
    );
  }, [state, from, pending]);

  const targets = useMemo(() => {
    const next = new Set<number>();
    for (const move of candidates) {
      const step = move.path[pending.length];
      if (step !== undefined) next.add(step);
    }
    return next;
  }, [candidates, pending.length]);

  const reset = useCallback(() => {
    setFrom(null);
    setPending([]);
    setRejected(null);
  }, []);

  const select = useCallback(
    (square: number) => {
      if (!canPlay) {
        setRejected(square);
        return;
      }

      // Picking up (or switching) a piece.
      if (from === null || movableFrom.has(square)) {
        if (!movableFrom.has(square)) {
          setRejected(square);
          return;
        }
        setFrom(square);
        setPending([]);
        setRejected(null);
        return;
      }

      // Clicking the selected piece again cancels the selection.
      if (square === from && pending.length === 0) {
        reset();
        return;
      }

      if (!targets.has(square)) {
        setRejected(square);
        return;
      }

      const path = [...pending, square];
      setRejected(null);

      const complete = candidates.find(
        (move) =>
          move.path.length === path.length &&
          move.path.every((step, index) => step === path[index]),
      );

      if (complete) {
        reset();
        onCommit(complete);
        return;
      }

      // More jumps to come in this chain.
      setPending(path);
    },
    [canPlay, from, pending, movableFrom, targets, candidates, onCommit, reset],
  );

  return { from, pending, targets, movableFrom, rejected, select, reset };
}
