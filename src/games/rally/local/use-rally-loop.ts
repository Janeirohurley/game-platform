"use client";

import { useCallback, useEffect, useState } from "react";

import { FIXED_STEP_SECONDS, PADDLE_RANGE } from "../engine/constants";
import { RallyMatch } from "../engine/rally-match";
import type { Difficulty, RallyEvent, RallySnapshot } from "../engine/types";

/** Never simulate more than this in one frame after a stall. */
const MAX_CATCH_UP_SECONDS = 0.25;

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
 */
export function useRallyLoop(level: Difficulty): RallyLoop {
  const [lastPoint, setLastPoint] = useState<RallyLoop["lastPoint"]>(null);

  // The match is a mutable object created once. A lazy useState holds it
  // for the life of the component and, unlike a ref, is safe to read
  // while rendering.
  const [match] = useState(
    () =>
      new RallyMatch({
        level,
        onEvent: (event: RallyEvent) => {
          if (event.type === "point") {
            setLastPoint({ reason: event.reason, side: event.side });
          }
          if (event.type === "serve" || event.type === "start") {
            setLastPoint(null);
          }
        },
      }),
  );

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
