"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Short-lived notices stacked over the board.
 *
 * A running game produces a steady trickle of small facts — who rolled
 * what, who was captured, who dropped. A fixed banner can only ever show
 * the last one, and silently loses the rest. These queue instead, each
 * one visible long enough to read.
 */

export type ToastTone = "info" | "good" | "bad";

export interface GameToast {
  id: number;
  text: string;
  tone: ToastTone;
}

/** How long a notice stays on screen. */
const LIFETIME_MS = 2_800;
/** Beyond this, the oldest is dropped rather than stacking forever. */
const MAX_VISIBLE = 3;

export function useGameToasts() {
  const [toasts, setToasts] = useState<GameToast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  // Every pending dismissal is cancelled on unmount, so none of them
  // fires against a component that is gone.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) window.clearTimeout(timer);
      pending.length = 0;
    };
  }, []);

  const push = useCallback((text: string, tone: ToastTone = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text, tone }].slice(-MAX_VISIBLE));

    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      timers.current = timers.current.filter((pending) => pending !== timer);
    }, LIFETIME_MS);

    timers.current.push(timer);
  }, []);

  return { toasts, push };
}

const TONE_CLASSES: Record<ToastTone, string> = {
  info: "bg-black/75 text-white",
  good: "bg-emerald-500/90 text-black",
  bad: "bg-rose-500/90 text-white",
};

/** The stack itself. Purely presentational. */
export function GameToasts({ toasts }: { toasts: GameToast[] }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-16 z-20 flex -translate-x-1/2 flex-col items-center gap-2"
    >
      {/* Scoped keyframes: no animation library, no global stylesheet. */}
      <style>{`
        @keyframes ludo-toast-in {
          from { opacity: 0; transform: translateY(-14px) scale(.94); }
          60%  { opacity: 1; transform: translateY(2px) scale(1.02); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ludo-toast { animation: none !important; }
        }
      `}</style>

      {toasts.map((toast) => (
        <p
          key={toast.id}
          className={`ludo-toast rounded-full px-4 py-1.5 text-sm font-semibold shadow-lg backdrop-blur-sm ${TONE_CLASSES[toast.tone]}`}
          style={{ animation: "ludo-toast-in .32s cubic-bezier(.2,.8,.3,1)" }}
        >
          {toast.text}
        </p>
      ))}
    </div>
  );
}
