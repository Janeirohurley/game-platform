"use client";

import { useCallback, useEffect, useState } from "react";

import {
  FALL_DELAYS_MS,
  applyInput,
  createGame,
  type TetrisInput,
  type TetrisState,
} from "../engine";

const BEST_SCORE_KEY = "arena:tetris:best";

function readBestScore(): number {
  // localStorage peut lever (navigation privée, stockage bloqué) : le jeu doit
  // rester jouable sans, d'où le try/catch et la valeur de repli.
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_KEY);
    const value = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeBestScore(score: number) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    /* sans stockage, le meilleur score n'est simplement pas conservé */
  }
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

/**
 * Boucle de jeu LOCALE : fait tourner le moteur pur avec une gravité
 * cadencée par le niveau. Le moteur ne connaît ni le temps ni le DOM ;
 * c'est ce hook qui injecte les `tick`. En ligne, ce rôle reviendra au
 * serveur (`this.clock`) — le moteur, lui, ne changera pas.
 *
 * Ce hook lit `window` et tire une graine aléatoire dès son premier rendu :
 * il ne doit donc être monté QUE côté client (voir `local-tetris.tsx`, qui
 * charge la session avec `ssr: false`). Sans ça, le HTML serveur et le premier
 * rendu client auraient deux graines différentes (erreur d'hydratation).
 * On évite ainsi de créer la partie dans un `useEffect`, ce qui provoquerait
 * un second rendu inutile.
 */
export function useTetrisLoop(startLevel = 1) {
  const [game, setGame] = useState<TetrisState>(() =>
    createGame(randomSeed(), startLevel),
  );
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState<number>(readBestScore);

  const restart = useCallback(() => {
    setGame(createGame(randomSeed(), startLevel));
    setPaused(false);
    // Relit le stockage : le meilleur score de la partie qui vient de finir
    // y a été écrit par l'effet ci-dessous.
    setBest(readBestScore());
  }, [startLevel]);

  const send = useCallback((input: TetrisInput) => {
    setGame((current) => applyInput(current, input));
  }, []);

  const { level, status, score } = game;

  useEffect(() => {
    if (status !== "playing" || paused) return;
    const id = window.setInterval(
      () => send("tick"),
      FALL_DELAYS_MS[level - 1],
    );
    return () => window.clearInterval(id);
  }, [level, status, paused, send]);

  // Enregistre le meilleur score à la fin de la partie. Cet effet n'écrit que
  // dans un système externe (localStorage), jamais dans l'état React.
  useEffect(() => {
    if (status === "over" && score > readBestScore()) writeBestScore(score);
  }, [status, score]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const sendIfRunning = useCallback(
    (input: TetrisInput) => {
      if (!paused) send(input);
    },
    [paused, send],
  );

  return { game, paused, best, send: sendIfRunning, restart, togglePause };
}
