"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Room } from "@colyseus/sdk";

import { PADDLE_RANGE, clamp } from "../engine/constants";
import type { MatchState, Side } from "../engine/types";

/** How often the client streams its paddle intent. */
const INPUT_INTERVAL_MS = 1000 / 30;
/** How fast rendered positions catch up to the server's, per second. */
const SMOOTHING = 14;

interface RallyRoomState {
  matchState?: string;
  ballX?: number;
  ballY?: number;
  ballZ?: number;
  nearX?: number;
  nearY?: number;
  farX?: number;
  farY?: number;
  scoreNear?: number;
  scoreFar?: number;
  rally?: number;
  best?: number;
  server?: number;
  winnerUserId?: string;
  players?: Map<string, { userId: string; name: string; side: number }>;
}

/** What the renderer reads; mutated in place, never through React. */
export interface RallyView {
  ball: { x: number; y: number; z: number };
  near: { x: number; y: number };
  far: { x: number; y: number };
}

export interface OnlineRally {
  /**
   * Smoothed world. Handed over as a ref, not a value: it is mutated
   * every frame and read inside the render loop, never during a React
   * render.
   */
  view: RefObject<RallyView>;
  /** The side this viewer plays, or null before the match starts. */
  side: Side | null;
  matchState: MatchState;
  scores: [number, number];
  rally: number;
  best: number;
  /** True when this viewer is the one who must serve. */
  mustServe: boolean;
  names: [string, string];
  winnerUserId: string;
  lastPoint: { side: Side; reason: string } | null;
  aim: (x: number) => void;
  setPower: (on: boolean) => void;
  serve: () => void;
}

/**
 * Mirrors an authoritative Rally room.
 *
 * The server owns the simulation; this sends paddle intent at a steady
 * rate and eases the rendered positions towards the ones it publishes,
 * so a 30 Hz patch stream still looks continuous. Nothing here decides
 * anything about the match.
 */
export function useOnlineRally(
  room: Room,
  viewerUserId: string,
): OnlineRally {
  const view = useRef<RallyView>({
    ball: { x: 0, y: 1.68, z: 4.32 },
    near: { x: 0, y: 1.52 },
    far: { x: 0, y: 1.52 },
  });

  // Latest authoritative values, written by the state subscription.
  const target = useRef({
    ballX: 0, ballY: 1.68, ballZ: 4.32,
    nearX: 0, nearY: 1.52, farX: 0, farY: 1.52,
  });

  const intent = useRef({ target: 0, power: false });

  const [hud, setHud] = useState({
    matchState: "intro" as MatchState,
    scores: [0, 0] as [number, number],
    rally: 0,
    best: 0,
    server: 0,
    winnerUserId: "",
    side: null as Side | null,
    names: ["Joueur 1", "Joueur 2"] as [string, string],
  });
  const [lastPoint, setLastPoint] = useState<OnlineRally["lastPoint"]>(null);

  // --- Subscribe to the room ---
  useEffect(() => {
    const read = () => {
      const state = room.state as unknown as RallyRoomState;
      if (!state) return;

      target.current = {
        ballX: state.ballX ?? 0,
        ballY: state.ballY ?? 1.68,
        ballZ: state.ballZ ?? 4.32,
        nearX: state.nearX ?? 0,
        nearY: state.nearY ?? 1.52,
        farX: state.farX ?? 0,
        farY: state.farY ?? 1.52,
      };

      const roster = state.players ? [...state.players.values()] : [];
      const mine = roster.find((p) => p.userId === viewerUserId);
      const near = roster.find((p) => p.side === 0);
      const far = roster.find((p) => p.side === 1);

      setHud({
        matchState: (state.matchState ?? "intro") as MatchState,
        scores: [state.scoreNear ?? 0, state.scoreFar ?? 0],
        rally: state.rally ?? 0,
        best: state.best ?? 0,
        server: state.server ?? 0,
        winnerUserId: state.winnerUserId ?? "",
        side: mine ? ((mine.side === 1 ? 1 : 0) as Side) : null,
        names: [near?.name || "Joueur 1", far?.name || "Joueur 2"],
      });
    };

    read();
    room.onStateChange(read);

    room.onMessage(
      "rallyPoint",
      (message: { side?: number; reason?: string }) => {
        if (typeof message?.side !== "number") return;
        setLastPoint({
          side: (message.side === 1 ? 1 : 0) as Side,
          reason: message.reason ?? "",
        });
      },
    );
  }, [room, viewerUserId]);

  // --- Smooth rendered positions towards the server's ---
  useEffect(() => {
    let frame = 0;
    let previous = performance.now();

    const ease = (now: number) => {
      frame = requestAnimationFrame(ease);
      const dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      const k = Math.min(dt * SMOOTHING, 1);

      const v = view.current;
      const t = target.current;
      v.ball.x += (t.ballX - v.ball.x) * k;
      v.ball.y += (t.ballY - v.ball.y) * k;
      v.ball.z += (t.ballZ - v.ball.z) * k;
      v.near.x += (t.nearX - v.near.x) * k;
      v.near.y += (t.nearY - v.near.y) * k;
      v.far.x += (t.farX - v.far.x) * k;
      v.far.y += (t.farY - v.far.y) * k;
    };

    frame = requestAnimationFrame(ease);
    return () => cancelAnimationFrame(frame);
  }, []);

  // --- Stream paddle intent at a steady rate ---
  useEffect(() => {
    const id = window.setInterval(() => {
      room.send("input", {
        target: intent.current.target,
        power: intent.current.power,
      });
    }, INPUT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [room]);

  const aim = useCallback((x: number) => {
    intent.current.target = clamp(x, -PADDLE_RANGE, PADDLE_RANGE);
  }, []);

  const setPower = useCallback((on: boolean) => {
    intent.current.power = on;
  }, []);

  const serve = useCallback(() => {
    room.send("serve", {});
  }, [room]);

  const mustServe =
    hud.side !== null && hud.matchState === "ready" && hud.server === hud.side;

  return {
    view,
    side: hud.side,
    matchState: hud.matchState,
    scores: hud.scores,
    rally: hud.rally,
    best: hud.best,
    mustServe,
    names: hud.names,
    winnerUserId: hud.winnerUserId,
    lastPoint,
    aim,
    setPower,
    serve,
  };
}
