"use client";

import { useEffect, useRef } from "react";

import { BOARD_HEIGHT, BOARD_WIDTH, getCells } from "../engine";
import { boardFromString } from "./tetris-view";
import type { TetrisPlayerView } from "./types";

const CELL = 6;

interface MiniBoardProps {
  player: TetrisPlayerView;
  /** Plateau éteint (joueur éliminé). */
  dimmed?: boolean;
}

/** Petit plateau d'un adversaire, dessiné sur un canvas (200 cases sans 200 nœuds DOM). */
export function MiniBoard({ player, dimmed = false }: MiniBoardProps) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, BOARD_WIDTH * CELL, BOARD_HEIGHT * CELL);
    context.fillStyle = "rgba(255,255,255,0.88)";
    const board = boardFromString(player.board);
    board.forEach((row, y) =>
      row.forEach((cell, x) => {
        if (cell !== 0) context.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
      }),
    );

    if (player.pieceType && player.status === "playing") {
      context.fillStyle = "rgb(125,211,252)";
      for (const [x, y] of getCells({
        type: player.pieceType as "I",
        rotation: player.pieceRotation,
        x: player.pieceX,
        y: player.pieceY,
      })) {
        if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
          context.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
        }
      }
    }
  }, [
    player.board,
    player.pieceType,
    player.pieceRotation,
    player.pieceX,
    player.pieceY,
    player.status,
  ]);

  return (
    <canvas
      ref={canvas}
      width={BOARD_WIDTH * CELL}
      height={BOARD_HEIGHT * CELL}
      role="img"
      aria-label={`Plateau de ${player.name} : ${player.lines} lignes, score ${player.score}`}
      className={`rounded-sm border border-white/15 bg-black/40 ${
        dimmed ? "opacity-35" : ""
      }`}
      style={{ width: BOARD_WIDTH * CELL, height: BOARD_HEIGHT * CELL }}
    />
  );
}
