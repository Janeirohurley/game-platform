"use client";

import { useCallback, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";

import { RALLY_CAMERA, RALLY_RENDERER, RallyScene } from "../components/rally-scene";
import { TARGET_SCORE } from "../engine/constants";
import type { Difficulty } from "../engine/types";
import { useRallyLoop } from "./use-rally-loop";

const LEVEL_LABELS: Record<Difficulty, string> = {
  chill: "Tranquille",
  club: "Club",
  pro: "Pro",
};

/**
 * Rally, single screen against the computer.
 *
 * The court fills its container and the interface floats over it, the
 * way the reference build lays it out. Pointer, A/D and touch all steer
 * the same paddle; holding any of them plays a power shot.
 */
export function LocalRally() {
  const {
    match,
    hud,
    lastPoint,
    start,
    serve,
    togglePause,
    aimAtRatio,
    nudge,
    setPower,
  } = useRallyLoop("club");

  const court = useRef<HTMLDivElement>(null);
  const held = useRef(new Set<string>());

  // Pointer: the paddle follows the cursor across the court's width.
  const handlePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const box = court.current?.getBoundingClientRect();
      if (!box || box.width === 0) return;
      aimAtRatio((event.clientX - box.left) / box.width);
    },
    [aimAtRatio],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button > 0) return;
      handlePointer(event);
      setPower(true);
      serve();
    },
    [handlePointer, serve, setPower],
  );

  // Keyboard: A/D steer, space serves, P and Escape pause.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === " " || key === "spacebar") {
        event.preventDefault();
        serve();
        setPower(true);
        return;
      }
      if (key === "p" || key === "escape") {
        togglePause();
        return;
      }
      if (key === "a" || key === "d" || key === "arrowleft" || key === "arrowright") {
        held.current.add(key);
      }
    };

    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      held.current.delete(key);
      if (key === " " || key === "spacebar") setPower(false);
    };

    const release = () => {
      held.current.clear();
      setPower(false);
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
    };
  }, [serve, togglePause, setPower]);

  // Held arrow/A/D keys nudge the paddle every frame.
  useEffect(() => {
    let frame = 0;
    const step = () => {
      frame = requestAnimationFrame(step);
      const keys = held.current;
      if (keys.has("a") || keys.has("arrowleft")) nudge(-1);
      if (keys.has("d") || keys.has("arrowright")) nudge(1);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [nudge]);

  const intro = hud.state === "intro";
  const over = hud.state === "over";
  const paused = hud.state === "paused";
  const awaitingServe = hud.state === "ready";

  return (
    <div
      ref={court}
      onPointerMove={handlePointer}
      onPointerDown={handlePointerDown}
      onPointerUp={() => setPower(false)}
      onPointerLeave={() => setPower(false)}
      className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-2xl border border-[#b6c4bd] bg-[#738589] select-none sm:aspect-[16/10] dark:border-white/10"
    >
      <Canvas
        shadows="percentage"
        camera={RALLY_CAMERA}
        dpr={[1, 1.75]}
        gl={RALLY_RENDERER}
        className="absolute inset-0"
      >
        <color attach="background" args={["#738589"]} />
        <RallyScene
          scores={hud.scores}
          scoreLabels={["TOI", "CPU"]}
          read={() => ({
            ball: match.ball,
            near: { x: match.player.x, y: match.player.y, vx: match.player.vx },
            far: { x: match.cpu.x, y: match.cpu.y, vx: match.cpu.vx },
          })}
        />
      </Canvas>

      {/* L'etat du match n'est pas un deuxieme tableau : le score reste sur le mur. */}
      <p className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-cyan-100/15 bg-[#102126]/88 px-3 py-1.5 text-[10px] font-semibold tracking-[0.14em] text-cyan-50/75">
        {paused
          ? "EN PAUSE"
          : awaitingServe
            ? hud.server === 0
              ? "À TOI DE SERVIR"
              : "SERVICE ADVERSE"
            : `ÉCHANGE ${hud.rally} · RECORD ${hud.best}`}
      </p>

      {/* Difficulty */}
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        {(Object.keys(LEVEL_LABELS) as Difficulty[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => start(option)}
            aria-pressed={hud.level === option}
            className={`rounded-md border px-3 py-1 text-[10px] font-bold tracking-[1.4px] transition ${
              hud.level === option
                ? "border-[#d96d53] bg-[#d9553a] text-white"
                : "border-cyan-50/15 bg-[#102126]/85 text-cyan-50/70 hover:bg-[#183037]"
            }`}
          >
            {LEVEL_LABELS[option].toUpperCase()}
          </button>
        ))}
      </div>

      {/* Point feedback */}
      {lastPoint && !over && (
        <p className="pointer-events-none absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-md border border-cyan-100/15 bg-[#102126]/92 px-4 py-1.5 text-xs font-medium text-[#e7f1ed]">
          {lastPoint.side === 0 ? "Point pour toi" : "Point pour le CPU"} ·{" "}
          {lastPoint.reason}
        </p>
      )}

      {/* Controls hint */}
      <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 text-center text-xs font-semibold tracking-[0.14em] text-cyan-50/60">
        SOURIS OU A/D POUR BOUGER · MAINTIENS POUR FRAPPER FORT · P POUR LA PAUSE
      </p>

      {/* Overlays */}
      {(intro || over || paused) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#071116]/85 backdrop-blur-sm">
          <div className="max-w-sm px-6 text-center">
            <h2 className="text-3xl font-black tracking-[-1.6px] text-[#f0f8f3]">
              {intro ? "Rally" : over ? (hud.winner === 0 ? "Bien joué." : "On remet ça ?") : "Pause"}
            </h2>

            <p className="mt-3 text-sm text-cyan-50/65">
              {intro
                ? `Premier à ${TARGET_SCORE} points, avec deux points d'écart. Prends ton temps.`
                : over
                  ? `${hud.scores[0]} – ${hud.scores[1]} · meilleur échange : ${hud.best}`
                  : "Reprends quand tu veux."}
            </p>

            <button
              type="button"
              onClick={() => (paused ? togglePause() : start(hud.level))}
              className="mt-6 h-11 rounded-md bg-[#d9553a] px-7 text-sm font-bold text-white transition hover:bg-[#c24b32]"
            >
              {intro ? "Commencer" : over ? "Rejouer" : "Reprendre"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

