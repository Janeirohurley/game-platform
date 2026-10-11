"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ConsoleKey,
  ConsolePhase,
  ConsolePressed,
} from "../components/console/console-keys";
import { ConsoleFit } from "../components/console/console-fit";
import { TetrisConsole } from "../components/console/tetris-console";
import type { TetrisInput } from "../engine";
import { useTetrisLoop } from "./use-tetris-loop";
import { useTetrisSound } from "./use-tetris-sound";

const KEYBOARD_TO_CONSOLE: Record<string, ConsoleKey> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "rotate",
  ArrowDown: "down",
  " ": "drop",
  p: "pause",
  P: "pause",
  r: "reset",
  R: "reset",
  s: "music",
  S: "music",
};

/** Touches qui se répètent quand on les maintient : [délai initial, intervalle] en ms. */
const REPEAT: Partial<Record<ConsoleKey, readonly [number, number]>> = {
  left: [200, 100],
  right: [200, 100],
  down: [200, 50],
};

const DROP_RECOIL_MS = 100;

/**
 * Partie locale de Tetris sur la console. Ce composant est le seul à relier
 * trois mondes : le clavier et les boutons de la console (entrées), le
 * moteur pur (règles) et le son. Aucune progression (XP, Elo) n'est écrite :
 * sans serveur, aucun résultat n'est digne de confiance — même règle que le
 * Ludo local.
 */
export function TetrisSession() {
  const { game, paused, best, send, restart, togglePause } = useTetrisLoop();
  const [soundOn, setSoundOn] = useState(true);
  const [pressed, setPressed] = useState<ConsolePressed>({});
  const [dropped, setDropped] = useState(false);
  const play = useTetrisSound(soundOn);

  // Timers de répétition (maintien d'une touche) et de recul de la console.
  const repeatTimers = useRef<Partial<Record<ConsoleKey, number>>>({});
  const recoilTimer = useRef<number>(0);

  const act = useCallback(
    (key: ConsoleKey) => {
      const inputByKey: Partial<Record<ConsoleKey, TetrisInput>> = {
        left: "left",
        right: "right",
        rotate: "rotate",
        down: "softDrop",
        drop: "hardDrop",
      };
      const input = inputByKey[key];

      if (input) {
        send(input);
        if (key === "rotate") play("rotate");
        else if (key === "drop") play("fall");
        else play("move");

        if (key === "drop") {
          setDropped(true);
          window.clearTimeout(recoilTimer.current);
          recoilTimer.current = window.setTimeout(() => setDropped(false), DROP_RECOIL_MS);
        }
        return;
      }

      if (key === "pause") togglePause();
      if (key === "music") setSoundOn((on) => !on);
      if (key === "reset") {
        restart();
        play("start");
      }
    },
    [send, play, togglePause, restart],
  );

  const stopRepeat = useCallback((key: ConsoleKey) => {
    const id = repeatTimers.current[key];
    if (id !== undefined) {
      window.clearTimeout(id);
      window.clearInterval(id);
      delete repeatTimers.current[key];
    }
  }, []);

  const handleKey = useCallback(
    (key: ConsoleKey, phase: ConsolePhase) => {
      if (phase === "down") {
        // Un appui déjà en cours (répétition clavier du système) est ignoré :
        // c'est notre propre minuterie qui gère le maintien.
        if (repeatTimers.current[key] !== undefined) return;
        setPressed((current) => ({ ...current, [key]: true }));
        act(key);

        const repeat = REPEAT[key];
        if (repeat) {
          const [begin, interval] = repeat;
          repeatTimers.current[key] = window.setTimeout(() => {
            repeatTimers.current[key] = window.setInterval(() => act(key), interval);
          }, begin);
        }
        return;
      }

      stopRepeat(key);
      // `pause` et `music` restent allumés selon leur état, pas selon l'appui.
      setPressed((current) => ({ ...current, [key]: false }));
    },
    [act, stopRepeat],
  );

  // Clavier physique : mêmes entrées que les boutons de la console.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = KEYBOARD_TO_CONSOLE[event.key];
      if (!key || event.metaKey || event.ctrlKey || event.altKey) return;
      // Évite que les flèches et l'espace fassent défiler la page.
      event.preventDefault();
      if (event.repeat) return;
      handleKey(key, "down");
    }

    function onKeyUp(event: KeyboardEvent) {
      const key = KEYBOARD_TO_CONSOLE[event.key];
      if (key) handleKey(key, "up");
    }

    // Fenêtre perdue de vue : on relâche tout, sinon une touche « reste enfoncée ».
    function releaseAll() {
      (Object.keys(repeatTimers.current) as ConsoleKey[]).forEach(stopRepeat);
      setPressed({});
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
      window.clearTimeout(recoilTimer.current);
    };
  }, [handleKey, stopRepeat]);

  // Sons déclenchés par le RÉSULTAT d'un coup : on compare à l'état précédent.
  const previous = useRef({ lines: game.lines, status: game.status });
  useEffect(() => {
    if (game.lines > previous.current.lines) play("clear");
    if (game.status === "over" && previous.current.status !== "over") play("gameover");
    previous.current = { lines: game.lines, status: game.status };
  }, [game.lines, game.status, play]);

  return (
    <section aria-label="Tetris — partie locale">
      <ConsoleFit>
        <TetrisConsole
          game={game}
          paused={paused}
          best={best}
          soundOn={soundOn}
          pressed={{ ...pressed, music: soundOn, pause: paused }}
          dropped={dropped}
          onKey={handleKey}
        />
      </ConsoleFit>
    </section>
  );
}
