"use client";

import { useCallback, useState } from "react";

import { applyMove, createInitialState } from "../engine/rules";
import type { GameState, Move } from "../engine/types";

interface LocalCheckers {
  state: GameState;
  /** Squares touched by the previous move, for the board's trail. */
  lastMove: readonly number[];
  /** Number of plies played, shown in the status panel. */
  plies: number;
  play: (move: Move) => void;
  reset: () => void;
}

/**
 * Local two-player game: both players share one device and take turns.
 *
 * No server, no network — just the engine. The hook holds the state and
 * nothing else; every rule is the engine's, which is why the online mode
 * can be refereed by the identical logic server-side.
 */
export function useLocalCheckers(): LocalCheckers {
  const [state, setState] = useState<GameState>(() => createInitialState());
  const [lastMove, setLastMove] = useState<readonly number[]>([]);
  const [plies, setPlies] = useState(0);

  const play = useCallback((move: Move) => {
    setState((current) => applyMove(current, move));
    setLastMove([move.from, ...move.path]);
    setPlies((count) => count + 1);
  }, []);

  const reset = useCallback(() => {
    setState(createInitialState());
    setLastMove([]);
    setPlies(0);
  }, []);

  return { state, lastMove, plies, play, reset };
}
