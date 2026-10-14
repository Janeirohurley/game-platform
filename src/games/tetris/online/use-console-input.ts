"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ConsoleKey,
  ConsolePhase,
  ConsolePressed,
} from "../components/console/console-keys";
import type { TetrisClientInput } from "./types";

const KEYBOARD_TO_CONSOLE: Record<string, ConsoleKey> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "rotate",
  ArrowDown: "down",
  " ": "drop",
};

const INPUT_BY_KEY: Partial<Record<ConsoleKey, TetrisClientInput>> = {
  left: "left",
  right: "right",
  rotate: "rotate",
  down: "softDrop",
  drop: "hardDrop",
};

/** Touches qui se répètent : [délai initial, intervalle] en ms (comme en local). */
const REPEAT: Partial<Record<ConsoleKey, readonly [number, number]>> = {
  left: [200, 100],
  right: [200, 100],
  down: [200, 50],
};

const DROP_RECOIL_MS = 100;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/**
 * Relie clavier physique et boutons de la console aux intentions envoyées
 * au serveur. Pause, reset et musique n'existent pas en ligne : ces touches
 * sont ignorées.
 *
 * Le clavier n'est écouté que si `enabled`, et jamais pendant une saisie
 * (le chat utilise la barre d'espace).
 */
export function useConsoleInput(
  enabled: boolean,
  send: (input: TetrisClientInput) => void,
) {
  const [pressed, setPressed] = useState<ConsolePressed>({});
  const [dropped, setDropped] = useState(false);
  const repeatTimers = useRef<Partial<Record<ConsoleKey, number>>>({});
  const recoilTimer = useRef(0);

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const stopRepeat = useCallback((key: ConsoleKey) => {
    const id = repeatTimers.current[key];
    if (id !== undefined) {
      window.clearTimeout(id);
      window.clearInterval(id);
      delete repeatTimers.current[key];
    }
  }, []);

  const act = useCallback((key: ConsoleKey) => {
    const input = INPUT_BY_KEY[key];
    if (!input) return;
    sendRef.current(input);
    if (key === "drop") {
      setDropped(true);
      window.clearTimeout(recoilTimer.current);
      recoilTimer.current = window.setTimeout(
        () => setDropped(false),
        DROP_RECOIL_MS,
      );
    }
  }, []);

  const handleKey = useCallback(
    (key: ConsoleKey, phase: ConsolePhase) => {
      if (!INPUT_BY_KEY[key]) return;
      if (phase === "down") {
        if (repeatTimers.current[key] !== undefined) return;
        setPressed((current) => ({ ...current, [key]: true }));
        act(key);
        const repeat = REPEAT[key];
        if (repeat) {
          const [begin, interval] = repeat;
          repeatTimers.current[key] = window.setTimeout(() => {
            repeatTimers.current[key] = window.setInterval(
              () => act(key),
              interval,
            );
          }, begin);
        }
        return;
      }
      stopRepeat(key);
      setPressed((current) => ({ ...current, [key]: false }));
    },
    [act, stopRepeat],
  );

  const releaseAll = useCallback(() => {
    (Object.keys(repeatTimers.current) as ConsoleKey[]).forEach(stopRepeat);
    setPressed({});
  }, [stopRepeat]);

  // Quand `enabled` repasse à faux (éliminé, fin de match), le nettoyage de
  // cet effet relâche déjà toutes les touches : pas besoin d'un autre effet.
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const key = KEYBOARD_TO_CONSOLE[event.key];
      if (!key || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      if (event.repeat) return;
      handleKey(key, "down");
    }
    function onKeyUp(event: KeyboardEvent) {
      const key = KEYBOARD_TO_CONSOLE[event.key];
      if (key) handleKey(key, "up");
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
  }, [enabled, handleKey, releaseAll]);

  return { pressed, dropped, handleKey };
}
