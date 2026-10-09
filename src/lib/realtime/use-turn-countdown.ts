"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The visible share of a turn budget that is still left:
 * 1 = just restarted, 0 = fully spent, clamped both ways.
 */
export function turnProgressFraction(
  elapsedMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - elapsedMs / durationMs));
}

/**
 * Drives the circular "the move is being awaited" ring around an avatar.
 *
 * The server's room clock is unreachable from the browser, so a wall-clock
 * deadline cannot be read directly. The caller restarts a fresh window by
 * remounting the host component with a changing React `key` (the pair of
 * the current player and the server deadline moves on every roll and every
 * turn change — the server refreshing its deadline IS the signal that a
 * fresh window began). This hook then simply counts that window down at
 * ~10fps locally. Joining mid-turn starts at full; the drift is purely
 * cosmetic — the server still enforces the real timeout.
 */
export function useTurnCountdown(durationMs: number): number {
  const [progress, setProgress] = useState(1);
  const startedAt = useRef(0);

  useEffect(() => {
    if (durationMs <= 0) return;
    startedAt.current = Date.now();
    const id = window.setInterval(() => {
      setProgress(
        turnProgressFraction(Date.now() - startedAt.current, durationMs),
      );
    }, 100);
    return () => window.clearInterval(id);
  }, [durationMs]);

  return progress;
}