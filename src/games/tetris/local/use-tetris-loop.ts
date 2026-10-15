"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDocumentVisible } from "@/hooks/use-document-visible";
import { clearGameState, loadGameState, saveGameState } from "@/lib/games/persistence";

import {
  FALL_DELAYS_MS,
  applyInput,
  createGame,
  type TetrisInput,
  type TetrisState,
} from "../engine";

const BEST_SCORE_KEY = "arena:tetris:best";

/** Clé + version de la sauvegarde de partie (reprise après rafraîchissement). */
const SAVE_KEY = "arena:tetris:local";
const SAVE_VERSION = 1;

/**
 * Options de départ, comme sur l'écran d'accueil de l'original :
 * `startLines` (0 a 10) empile des lignes de débris en bas du plateau et
 * `startLevel` (1 a 6) fixe la vitesse de chute initiale.
 */
export interface TetrisStartConfig {
  startLines: number;
  startLevel: number;
}

export const DEFAULT_START_CONFIG: TetrisStartConfig = {
  startLines: 0,
  startLevel: 1,
};

export const MAX_START_LINES = 10;
export const MAX_START_LEVEL = FALL_DELAYS_MS.length;

function clampStartConfig(config: TetrisStartConfig): TetrisStartConfig {
  return {
    startLines: Math.min(Math.max(Math.trunc(config.startLines), 0), MAX_START_LINES),
    startLevel: Math.min(Math.max(Math.trunc(config.startLevel), 1), MAX_START_LEVEL),
  };
}

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

function createLocalGame(config: TetrisStartConfig): TetrisState {
  return createGame(randomSeed(), config.startLevel, config.startLines);
}

/** Forme rangée dans `localStorage` pour reprendre une partie au rechargement. */
interface TetrisSave {
  config: TetrisStartConfig;
  started: boolean;
  paused: boolean;
  /** `null` sur l'écran de démarrage : seule la config est retenue. */
  game: TetrisState | null;
}

interface TetrisBoot {
  config: TetrisStartConfig;
  started: boolean;
  paused: boolean;
  game: TetrisState;
  /** Vrai si l'on reprend une partie en cours : la 1re chute est ralentie. */
  canResume: boolean;
}

/**
 * Reconstruit l'état initial : reprend la partie enregistrée si elle existait et
 * n'était pas terminée, sinon ouvre l'écran de démarrage (config restaurée).
 * Sans sauvegarde, c'est une partie neuve.
 */
function bootTetris(): TetrisBoot {
  const saved = loadGameState<TetrisSave>(SAVE_KEY, SAVE_VERSION);
  const config = saved ? clampStartConfig(saved.config) : DEFAULT_START_CONFIG;

  if (saved?.started && saved.game && saved.game.status === "playing") {
    // Comme l'original : une partie non terminée reprend là où elle en était ;
    // si elle était en pause manuelle, elle le reste.
    return {
      config,
      started: true,
      paused: saved.paused,
      game: saved.game,
      canResume: !saved.paused,
    };
  }

  // Écran de démarrage : la config choisie (lignes de débris / vitesse) reste.
  return {
    config,
    started: false,
    paused: false,
    game: createLocalGame(config),
    canResume: false,
  };
}

/**
 * Boucle de jeu LOCALE : fait tourner le moteur pur avec une gravité
 * cadencée par le niveau. Le moteur ne connaît ni le temps ni le DOM ;
 * c'est ce hook qui injecte les `tick`. En ligne, ce rôle reviendra au
 * serveur (`this.clock`) — le moteur, lui, ne changera pas.
 *
 * L'écran de démarrage (choix des lignes de débris et de la vitesse) vit ici :
 * tant que `start()` n'a pas été appelé, `started` est faux, la gravité est
 * en pause et `send` ignore les entrées. On garde malgré tout une partie
 * « d'aperçu » pour que la console affiche l'effet du réglage en direct.
 *
 * Ce hook lit `window` et tire une graine aléatoire dès son premier rendu :
 * il ne doit donc être monté QUE côté client (voir `local-tetris.tsx`, qui
 * charge la session avec `ssr: false`). Sans ça, le HTML serveur et le premier
 * rendu client auraient deux graines différentes (erreur d'hydratation).
 */
export function useTetrisLoop() {
  // Instantané calculé une seule fois : on restaure la sauvegarde (ou on repart
  // de zéro) au tout premier rendu. Le `useState` paresseux garantit un seul
  // appel, et l'initialiseur ne relit pas le stockage à chaque rendu.
  const [boot] = useState(bootTetris);
  const [config, setConfigState] = useState<TetrisStartConfig>(boot.config);
  const [started, setStarted] = useState(boot.started);
  const [game, setGame] = useState<TetrisState>(boot.game);
  const [paused, setPaused] = useState(boot.paused);
  const [best, setBest] = useState<number>(readBestScore);
  // Change à chaque largage volontaire pour redémarrer la gravité à zéro,
  // comme l'original (voir `send` ci-dessous).
  const [gravityEpoch, setGravityEpoch] = useState(0);
  // Consommé par la première chute après une reprise (voir l'effet de gravité).
  const resumeBoost = useRef(boot.canResume);
  const visible = useDocumentVisible();

  // Changer un réglage reconstruit l'aperçu sur-le-champ : la console montre
  // alors les débris et le niveau choisis avant même de commencer. On met à
  // jour l'état dans le gestionnaire d'événement (pas dans un effet), pour
  // éviter les rendus en cascade.
  const setConfig = useCallback(
    (next: TetrisStartConfig) => {
      const clamped = clampStartConfig(next);
      setConfigState(clamped);
      if (!started) setGame(createLocalGame(clamped));
    },
    [started],
  );

  const start = useCallback(() => {
    setGame(createLocalGame(config));
    setPaused(false);
    setStarted(true);
  }, [config]);

  const restart = useCallback(() => {
    // Sans partie en cours (écran de démarrage), « reset » n'a rien à relancer.
    if (!started) return;
    setGame(createLocalGame(config));
    setPaused(false);
    // Relit le stockage : le meilleur score de la partie qui vient de finir
    // y a été écrit par l'effet ci-dessous.
    setBest(readBestScore());
  }, [config, started]);

  const send = useCallback((input: TetrisInput) => {
    setGame((current) => applyInput(current, input));
    // Un largage volontaire (descente ou chute) remet la gravité à zéro,
    // comme l'original `states.auto()` : sinon la pièce peut retomber d'une
    // deuxième case presque aussitôt, ce qui rend la descente trop rapide.
    if (input === "softDrop" || input === "hardDrop") {
      setGravityEpoch((epoch) => epoch + 1);
    }
  }, []);

  const { level, status, score } = game;

  useEffect(() => {
    if (!started || status !== "playing" || paused || !visible) return;
    const base = FALL_DELAYS_MS[level - 1];
    // Reprise après rafraîchissement : la première chute met deux fois plus de
    // temps, comme l'original (`states.auto(speedRun / 2)`), le temps de se
    // réorienter. Le drapeau n'est consommé qu'ici, quand la chute démarre.
    const delay = resumeBoost.current ? base / 2 : base;
    resumeBoost.current = false;
    const id = window.setInterval(() => send("tick"), delay);
    return () => window.clearInterval(id);
  }, [started, level, status, paused, visible, gravityEpoch, send]);

  // Enregistre le meilleur score à la fin de la partie. Cet effet n'écrit que
  // dans un système externe (localStorage), jamais dans l'état React.
  useEffect(() => {
    if (started && status === "over" && score > readBestScore()) writeBestScore(score);
  }, [started, status, score]);

  // Sauvegarde la partie en cours à chaque changement, pour pouvoir la reprendre
  // après un rechargement (comme l'original). Sur l'écran de démarrage, seule la
  // config est retenue ; une partie terminée est effacée.
  useEffect(() => {
    if (!started) {
      saveGameState<TetrisSave>(SAVE_KEY, SAVE_VERSION, {
        config,
        started: false,
        paused: false,
        game: null,
      });
      return;
    }
    if (status === "over") {
      clearGameState(SAVE_KEY);
      return;
    }
    saveGameState<TetrisSave>(SAVE_KEY, SAVE_VERSION, {
      config,
      started: true,
      paused,
      game,
    });
  }, [config, started, paused, game, status]);

  const togglePause = useCallback(() => setPaused((p) => !p), []);

  const sendIfRunning = useCallback(
    (input: TetrisInput) => {
      if (started && !paused && visible) send(input);
    },
    [started, paused, visible, send],
  );

  return {
    game,
    paused,
    best,
    started,
    config,
    setConfig,
    start,
    restart,
    togglePause,
    send: sendIfRunning,
  };
}
