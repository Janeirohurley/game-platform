"use client";

const RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export interface CountdownRingProps {
  /** 1 = window just restarted, 0 = budget spent. */
  progress: number;
}

/**
 * SVG progress ring drawn around the avatar of the player whose turn it
 * is: a faint full track behind a bright arc that drains clockwise as the
 * turn budget runs out. Pure ring — the caller positions it over its own
 * avatar (the ring is sized to a 40px circle via `-inset-1`).
 */
export function CountdownRing({ progress }: CountdownRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <span className="pointer-events-none absolute -inset-1" aria-hidden="true">
      <svg className="size-full -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          stroke="currentColor"
          className="text-white/15"
        />
        <circle
          cx="20"
          cy="20"
          r={RADIUS}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
          className="text-yellow-400 transition-[stroke-dashoffset] duration-100 ease-linear"
        />
      </svg>
    </span>
  );
}