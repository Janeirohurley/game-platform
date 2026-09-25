"use client";

import { useCallback, useEffect, useState } from "react";
import type { Room } from "@colyseus/sdk";

import { createInitialBoard, decodeBoard } from "../engine/board";
import type { Color, GameOutcome, GameState, Move } from "../engine/types";

interface CheckersRoomState {
  board?: string;
  turnColor?: string;
  currentTurn?: string;
  idlePlies?: number;
  outcome?: string;
  outcomeReason?: string;
  winnerUserId?: string;
  players?: Map<string, { userId: string; name: string; color: string }>;
}

export interface OnlineCheckers {
  /** Engine view of the server's authoritative board. */
  state: GameState;
  /** The colour the viewer plays, or null while seats are unassigned. */
  viewerColor: Color | null;
  /** True when it is the viewer's turn and the game is running. */
  canPlay: boolean;
  /** Display names keyed by colour. */
  labels: Record<Color, string>;
  lastMove: readonly number[];
  /** Send a move intent. The server decides whether it happens. */
  sendMove: (move: Move) => void;
}

const FALLBACK_LABELS: Record<Color, string> = {
  white: "Blancs",
  black: "Noirs",
};

function readOutcome(state: CheckersRoomState, colors: Record<string, Color>): GameOutcome {
  if (state.outcome === "draw") return { kind: "draw", reason: "idle-plies" };
  if (state.outcome === "win") {
    const winner = state.winnerUserId ? colors[state.winnerUserId] : undefined;
    // `timeout` and `forfeit` are room-level reasons the engine's type
    // does not carry; they surface through the banner as a plain win.
    const reason =
      state.outcomeReason === "no-moves" ? "no-moves" : "captured-all";
    return { kind: "win", winner: winner ?? "white", reason };
  }
  return { kind: "playing" };
}

/**
 * Mirrors the authoritative room state into the shape the board and the
 * engine already understand.
 *
 * Nothing here decides anything: legality is recomputed locally only to
 * light up the squares, and the server re-validates every move it
 * receives. A client that lies simply has its message ignored.
 */
export function useOnlineCheckers(
  room: Room,
  viewerUserId: string,
): OnlineCheckers {
  const [raw, setRaw] = useState<CheckersRoomState>(
    () => room.state as unknown as CheckersRoomState,
  );
  const [lastMove, setLastMove] = useState<readonly number[]>([]);

  useEffect(() => {
    const sync = () => setRaw({ ...(room.state as unknown as CheckersRoomState) });
    sync();
    room.onStateChange(sync);

    room.onMessage(
      "moveApplied",
      (message: { from?: number; path?: number[] }) => {
        if (typeof message?.from !== "number" || !Array.isArray(message.path)) {
          return;
        }
        setLastMove([message.from, ...message.path]);
      },
    );
  }, [room]);

  const players = raw.players ? [...raw.players.values()] : [];
  const colorByUser: Record<string, Color> = {};
  const labels = { ...FALLBACK_LABELS };

  for (const player of players) {
    if (player.color !== "white" && player.color !== "black") continue;
    colorByUser[player.userId] = player.color;
    labels[player.color] = player.name || FALLBACK_LABELS[player.color];
  }

  const viewerColor = colorByUser[viewerUserId] ?? null;
  const turn: Color = raw.turnColor === "black" ? "black" : "white";

  const state: GameState = {
    // Before the first state frame the board string is empty; fall back
    // to the opening position so the board renders instead of blanking.
    board: raw.board ? decodeBoard(raw.board) : createInitialBoard(),
    turn,
    idlePlies: raw.idlePlies ?? 0,
    outcome: readOutcome(raw, colorByUser),
  };

  const canPlay =
    state.outcome.kind === "playing" &&
    Boolean(viewerColor) &&
    raw.currentTurn === viewerUserId;

  const sendMove = useCallback(
    (move: Move) => {
      room.send("move", {
        from: move.from,
        to: move.to,
        path: [...move.path],
      });
    },
    [room],
  );

  return { state, viewerColor, canPlay, labels, lastMove, sendMove };
}
