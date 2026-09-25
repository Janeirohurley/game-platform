"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Room } from "@colyseus/sdk";
import { Canvas } from "@react-three/fiber";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout01Icon } from "@hugeicons/core-free-icons";

import { RoomChat } from "@/components/realtime/chat";
import { RallyScene } from "../components/rally-scene";
import { PADDLE_RANGE } from "../engine/constants";
import { useOnlineRally } from "./use-online-rally";

interface RallyRoomViewProps {
  room: Room;
  viewerUserId: string;
  onLeave: () => void;
}

/**
 * Online Rally.
 *
 * The server runs the one simulation; this streams paddle intent and
 * draws the world it publishes. The far player's side is mirrored for
 * whoever plays it, so both people see their own paddle nearest them.
 */
export function RallyRoomView({
  room,
  viewerUserId,
  onLeave,
}: RallyRoomViewProps) {
  const {
    view,
    side,
    matchState,
    scores,
    rally,
    best,
    mustServe,
    names,
    winnerUserId,
    lastPoint,
    aim,
    setPower,
    serve,
  } = useOnlineRally(room, viewerUserId);

  const court = useRef<HTMLDivElement>(null);
  const held = useRef(new Set<string>());

  // Side 1 sits at the far end: flip its input and its camera so the
  // player still steers "their" paddle with the same gesture.
  const flip = side === 1 ? -1 : 1;

  const handlePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const box = court.current?.getBoundingClientRect();
      if (!box || box.width === 0) return;
      const ratio = (event.clientX - box.left) / box.width;
      aim((ratio * 2 - 1) * PADDLE_RANGE * flip);
    },
    [aim, flip],
  );

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === " " || key === "spacebar") {
        event.preventDefault();
        serve();
        setPower(true);
        return;
      }
      if (["a", "d", "arrowleft", "arrowright"].includes(key)) {
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
  }, [serve, setPower]);

  // Held keys nudge the aim, same feel as the local game.
  const aimRef = useRef(0);
  useEffect(() => {
    let frame = 0;
    const step = () => {
      frame = requestAnimationFrame(step);
      const keys = held.current;
      let delta = 0;
      if (keys.has("a") || keys.has("arrowleft")) delta -= 6 / 120;
      if (keys.has("d") || keys.has("arrowright")) delta += 6 / 120;
      if (delta !== 0) {
        aimRef.current = Math.max(
          -PADDLE_RANGE,
          Math.min(PADDLE_RANGE, aimRef.current + delta * flip),
        );
        aim(aimRef.current);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [aim, flip]);

  // Scene reader: side 1 sees the table from the other end. Not
  // memoised — the scene calls it inside its own frame loop, so a fresh
  // closure each render costs nothing and keeps `side` current.
  const read = () => {
    const world = view.current;
    if (!world) {
      return {
        ball: { x: 0, y: 1.68, z: 4.32 },
        near: { x: 0, y: 1.52 },
        far: { x: 0, y: 1.52 },
      };
    }
    if (side !== 1) return world;
    return {
      ball: { x: -world.ball.x, y: world.ball.y, z: -world.ball.z },
      near: { x: -world.far.x, y: world.far.y },
      far: { x: -world.near.x, y: world.near.y },
    };
  };

  const mine = side === 1 ? scores[1] : scores[0];
  const theirs = side === 1 ? scores[0] : scores[1];
  const myName = side === 1 ? names[1] : names[0];
  const theirName = side === 1 ? names[0] : names[1];
  const over = matchState === "over";
  const iWon = over && winnerUserId === viewerUserId;

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={court}
        onPointerMove={handlePointer}
        onPointerDown={(event) => {
          handlePointer(event);
          setPower(true);
          serve();
        }}
        onPointerUp={() => setPower(false)}
        onPointerLeave={() => setPower(false)}
        className="relative aspect-[4/3] w-full max-w-4xl touch-none overflow-hidden rounded-2xl border border-[#d6d8cf] bg-[#e9e7df] select-none sm:aspect-[16/10] dark:border-white/10"
      >
        <Canvas shadows camera={{ position: [0, 3.35, 8.6], fov: 42 }}>
          <color attach="background" args={["#e9e7df"]} />
          <fog attach="fog" args={["#e9e7df", 12, 24]} />
          <RallyScene read={read} />
        </Canvas>

        {/* Scoreboard */}
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
          <div className="flex items-center gap-6 rounded-[17px] border border-[#d6d8cf] bg-[#f5f4ee]/90 px-6 py-3 backdrop-blur-sm">
            <Score label={truncate(myName)} value={mine} accent />
            <span className="-mt-1 text-[#b5bcb0]">·</span>
            <Score label={truncate(theirName)} value={theirs} />
          </div>

          <p className="mt-2 text-center text-[9px] font-bold tracking-[2.2px] text-[#768170]">
            {matchState === "ready"
              ? mustServe
                ? "À TOI DE SERVIR"
                : "SERVICE ADVERSE"
              : `ÉCHANGE ${rally} · RECORD ${best}`}
          </p>
        </div>

        {lastPoint && !over && (
          <p className="pointer-events-none absolute bottom-14 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#20302a]/85 px-4 py-1.5 text-xs font-medium text-[#e9e7df]">
            {lastPoint.side === side ? "Point pour toi" : "Point adverse"} ·{" "}
            {lastPoint.reason}
          </p>
        )}

        <p className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 text-center text-[9px] font-bold tracking-[2px] text-[#768170]">
          SOURIS OU A/D POUR BOUGER · MAINTIENS POUR FRAPPER FORT
        </p>

        {mustServe && (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center text-sm font-semibold text-[#20302a]">
            Clique ou appuie sur Espace pour servir
          </p>
        )}

        {over && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#e9e7df]/85 backdrop-blur-sm">
            <div className="px-6 text-center">
              <h2 className="text-3xl font-black tracking-[-1.6px] text-[#202c28]">
                {iWon ? "Bien joué." : "On remet ça ?"}
              </h2>
              <p className="mt-3 text-sm text-[#5d675e]">
                {mine} – {theirs} · meilleur échange : {best}
              </p>
            </div>
          </div>
        )}
      </div>

      <RoomChat room={room} viewerUserId={viewerUserId} />

      <button
        type="button"
        onClick={onLeave}
        className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-red-500 dark:text-white/35 dark:hover:text-red-400"
      >
        <HugeiconsIcon icon={Logout01Icon} size={14} strokeWidth={1.8} />
        Quitter la partie
      </button>
    </div>
  );
}

const truncate = (name: string) =>
  (name.length > 7 ? `${name.slice(0, 7)}…` : name).toUpperCase();

function Score({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <span className="flex min-w-[46px] flex-col gap-1 text-[9px] font-bold tracking-[2px] text-[#737d72]">
      {label}
      <span
        className={`text-[31px] font-medium leading-none tracking-[-1px] tabular-nums ${
          accent ? "text-[#cf583c]" : "text-[#273d31]"
        }`}
      >
        {String(value).padStart(2, "0")}
      </span>
    </span>
  );
}
