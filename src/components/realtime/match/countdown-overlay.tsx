"use client";

import { useEffect, useState } from "react";

export interface CountdownOverlayProps {
  /** Seconds the host received from the server broadcast. */
  seconds: number;
}

/**
 * Full-screen "attention à jouer" veil shown between the host's start
 * click and the real kick-off. The server broadcasts `countdown` and only
 * flips to PLAYING once the delay elapses; this overlay counts down
 * locally for motion, then the parent unmounts it on `gameStarted`.
 * It covers the whole screen for the whole table — nobody plays early.
 */
export function CountdownOverlay({ seconds }: CountdownOverlayProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    // The initial value already shows `seconds`; the interval only ticks.
    const id = window.setInterval(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [seconds]);

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-black/75 backdrop-blur-sm"
    >
      <p className="text-lg font-semibold uppercase tracking-[0.35em] text-white/85">
        Attention à jouer
      </p>
      <p
        key={remaining}
        className="animate-pulse text-8xl font-black tabular-nums text-white drop-shadow-[0_0_1.5rem_rgba(52,211,153,0.45)]"
      >
        {remaining === 0 ? "GO" : remaining}
      </p>
      <p className="text-sm text-white/60">La partie commence…</p>
    </div>
  );
}