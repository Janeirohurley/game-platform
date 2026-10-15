"use client";

import { useCallback, useEffect, useState } from "react";

import { loadGameState, saveGameState, clearGameState } from "@/lib/games/persistence";

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

/** Clé + version de la sauvegarde (reprise après rafraîchissement). */
const SAVE_KEY = "arena:checkers:local";
const SAVE_VERSION = 1;

interface CheckersSave {
  state: GameState;
  lastMove: readonly number[];
  plies: number;
}

/**
 * Reconstruit l'état initial à partir de la sauvegarde, ou part d'une partie
 * neuve. La partie n'est reprise que si elle était encore en cours ; un plateau
 * déjà terminé est ignoré (on rouvre une nouvelle partie).
 */
function bootCheckers(): CheckersSave {
  const saved = loadGameState<CheckersSave>(SAVE_KEY, SAVE_VERSION);
  if (saved?.state && saved.state.outcome.kind === "playing") return saved;
  return { state: createInitialState(), lastMove: [], plies: 0 };
}

/**
 * Local two-player game: both players share one device and take turns.
 *
 * No server, no network — just the engine. The hook holds the state and
 * nothing else; every rule is the engine's, which is why the online mode
 * can be refereed by the identical logic server-side. The position is
 * mirrored to `localStorage` so a reload resumes the same game.
 */
export function useLocalCheckers(): LocalCheckers {
  const [boot] = useState(bootCheckers);
  const [state, setState] = useState<GameState>(boot.state);
  const [lastMove, setLastMove] = useState<readonly number[]>(boot.lastMove);
  const [plies, setPlies] = useState(boot.plies);

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

  // Sauvegarde à chaque coup ; un plateau terminé est effacé, pour repartir sur
  // une partie neuve au prochain chargement.
  useEffect(() => {
    if (state.outcome.kind !== "playing") {
      clearGameState(SAVE_KEY);
      return;
    }
    saveGameState<CheckersSave>(SAVE_KEY, SAVE_VERSION, { state, lastMove, plies });
  }, [state, lastMove, plies]);

  return { state, lastMove, plies, play, reset };
}
