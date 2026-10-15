"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useDocumentVisible } from "@/hooks/use-document-visible";
import { clearGameState, loadGameState, saveGameState } from "@/lib/games/persistence";

import { FIXED_STEP_SECONDS, PADDLE_RANGE } from "../engine/constants";
import { RallyMatch } from "../engine/rally-match";
import type { Difficulty, RallyEvent, RallySave, RallySnapshot } from "../engine/types";

/** Never simulate more than this in one frame after a stall. */
const MAX_CATCH_UP_SECONDS = 0.25;

/** Clé + version de la sauvegarde (reprise après rafraîchissement). */
const SAVE_KEY = "arena:rally:local";
const SAVE_VERSION = 1;

interface RallyLoop {
  match: RallyMatch;
  /** Mirrored a few times a second — enough for the scoreboard. */
  hud: RallySnapshot;
  lastPoint: { reason: string; side: 0 | 1 } | null;
  start: (level: Difficulty) => void;
  serve: () => void;
  togglePause: () => void;
  /** Steer the paddle from a 0..1 position across the viewport. */
  aimAtRatio: (ratio: number) => void;
  nudge: (direction: -1 | 1) => void;
  setPower: (down: boolean) => void;
}

/**
 * Drives the match on a fixed 120 Hz step, decoupled from the display
 * refresh, so physics behave the same on a 60 Hz laptop and a 144 Hz
 * monitor. Rendering reads the engine directly; only the scoreboard
 * goes through React state.
 *
 * The match is mirrored to `localStorage` while it is live and restored on
 * reload, so a refresh does not throw away a game in progress; the tab is
 * also frozen while hidden (the page is not being watched — same rule as
 * Tetris). A manual pause always wins over the automatic one.
 */
export function useRallyLoop(level: Difficulty): RallyLoop {
  const [lastPoint, setLastPoint] = useState<RallyLoop["lastPoint"]>(null);

  // The match is a mutable object created once. A lazy useState holds it
  // for the life of the component and, unlike a ref, is safe to read
  // while rendering. On the very first call we rehydrate a saved match
  // (unless it was finished or never started) instead of a fresh one.
  const [match] = useState(() => {
    const options = {
      level,
      onEvent: (event: RallyEvent) => {
        if (event.type === "point") {
          setLastPoint({ reason: event.reason, side: event.side });
        }
        if (event.type === "serve" || event.type === "start") {
          setLastPoint(null);
        }
      },
    };

    const saved = loadGameState<RallySave>(SAVE_KEY, SAVE_VERSION);
    if (saved && saved.state !== "over" && saved.state !== "intro") {
      return RallyMatch.restore(saved, options);
    }
    return new RallyMatch(options);
  });

  const [hud, setHud] = useState<RallySnapshot>(() => match.snapshot());

  // Fixed-step loop with an accumulator.
  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    let accumulator = 0;
    let sinceHud = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);

      const elapsed = Math.min((now - previous) / 1000, MAX_CATCH_UP_SECONDS);
      previous = now;
      accumulator += elapsed;

      while (accumulator >= FIXED_STEP_SECONDS) {
        match.step(FIXED_STEP_SECONDS);
        accumulator -= FIXED_STEP_SECONDS;
      }

      // The scoreboard does not need 120 updates a second.
      sinceHud += elapsed;
      if (sinceHud >= 0.1) {
        sinceHud = 0;
        setHud(match.snapshot());
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [match]);

  // Freeze the match when the tab is hidden, and resume it on return — unless
  // the player paused by hand, which always takes precedence. The engine is
  // driven directly (no setState here) so this stays a plain side effect.
  const visible = useDocumentVisible();
  const autoPaused = useRef(false);
  useEffect(() => {
    if (!visible) {
      if (
        match.state === "playing" ||
        match.state === "ready" ||
        match.state === "point"
      ) {
        match.togglePause();
        autoPaused.current = true;
      }
      return;
    }
    if (autoPaused.current) {
      autoPaused.current = false;
      if (match.state === "paused") match.togglePause();
    }
  }, [visible, match]);

  // Mirror the live match; a finished or unstarted one leaves nothing to
  // resume, so the save is cleared.
  useEffect(() => {
    if (hud.state === "over" || hud.state === "intro") {
      clearGameState(SAVE_KEY);
      return;
    }
    saveGameState<RallySave>(SAVE_KEY, SAVE_VERSION, match.serialize());
  }, [match, hud]);

  const start = useCallback(
    (next: Difficulty) => {
      match.start(next);
      setHud(match.snapshot());
    },
    [match],
  );

  const serve = useCallback(() => {
    match.playerServe();
  }, [match]);

  const togglePause = useCallback(() => {
    match.togglePause();
    setHud(match.snapshot());
  }, [match]);

  const aimAtRatio = useCallback(
    (ratio: number) => {
      match.setTarget((ratio * 2 - 1) * PADDLE_RANGE);
    },
    [match],
  );

  const nudge = useCallback(
    (direction: -1 | 1) => {
      match.nudgeTarget((direction * 6) / 120);
    },
    [match],
  );

  const setPower = useCallback(
    (down: boolean) => {
      match.setPower(down);
    },
    [match],
  );

  return {
    match,
    hud,
    lastPoint,
    start,
    serve,
    togglePause,
    aimAtRatio,
    nudge,
    setPower,
  };
}
