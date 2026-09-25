"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Room } from "@colyseus/sdk";

import type {
  GamePiece,
  GameState,
  Player as BoardPlayer,
} from "@/games/ludo/types/game";
import { playSound } from "@/lib/sounds";
import type { LudoPlayerView } from "@/lib/realtime/types";

import LudoBoard from "../components/board/LudoBoard";

export interface ServerLudoSnapshot {
  gameId: string;
  gameName: string;
  minPlayers: number;
  maxPlayers: number;
  targetPlayers: number;
  phase: "waiting" | "ready" | "playing" | "finished";
  hostUserId: string;
  players: LudoPlayerView[];
  currentTurn: string;
  diceValue: number;
  turnDeadline: number;
  winnerUserId: string;
}

export interface OnlineLudoPlayProps {
  room: Room;
  snapshot: ServerLudoSnapshot;
  viewerUserId: string;
  onLeave: () => void;
}

const COLOR_ORDER = ["yellow", "red", "blue", "green"] as const;
type BoardColor = (typeof COLOR_ORDER)[number];

/**
 * Server-driven Ludo view.
 *
 * The authoritative state lives on the Colyseus server. This component:
 *   - mirrors `snapshot` into the `GameState` shape the existing 3D
 *     board already consumes (no visual rewrite),
 *   - sends *intents* only (`rollDice`, `movePiece`),
 *   - never computes rules locally — the server decides everything.
 */
export function OnlineLudoPlay({
  room,
  snapshot,
  viewerUserId,
  onLeave,
}: OnlineLudoPlayProps) {
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  // Tracks whether the dice was already "consumed" for the current roll,
  // so the local 3D spin animation only plays once per server roll.
  const animatedDiceRef = useRef<{ value: number; consumed: boolean }>({
    value: 0,
    consumed: true,
  });

  // Capture notifications (used for sound + feedback).
  useEffect(() => {
    const offCaptured = room.onMessage(
      "pieceCaptured",
      (message: { byUserId: string }) => {
        playSound("capture");
        setLastMessage(
          message.byUserId === viewerUserId
            ? "Capture ! Tu rejoues."
            : "Un de tes pions a été capturé !",
        );
      },
    );
    const offFinished = room.onMessage("gameFinished", (message: {
      winnerUserId: string;
    }) => {
      playSound("win");
      setLastMessage(
        message.winnerUserId === viewerUserId
          ? "Victoire ! 🎉"
          : "Partie terminée.",
      );
    });
    return () => {
      offCaptured();
      offFinished();
    };
  }, [room, viewerUserId]);

  const isMyTurn = snapshot.currentTurn === viewerUserId;
  const dice = snapshot.diceValue;

  // Which of my pieces can legally move, according to the SERVER state.
  // This is display filtering only — the server re-validates every move.
  const movablePieceIndexes = useMemo(() => {
    if (!isMyTurn || dice < 1 || dice > 6) return new Set<number>();
    const me = snapshot.players.find((player) => player.userId === viewerUserId);
    if (!me) return new Set<number>();
    const movable = new Set<number>();
    for (const piece of me.pieces) {
      if (piece.position === 57) continue;
      // Leaving base requires a 6; overshooting the finish is illegal.
      if (piece.position === -1) {
        if (dice === 6) movable.add(piece.index);
        continue;
      }
      if (piece.position + dice <= 56) movable.add(piece.index);
    }
    return movable;
  }, [isMyTurn, dice, snapshot.players, viewerUserId]);

  // Mirror server state into the board's GameState shape.
  const gameState: GameState = useMemo(() => {
    const players: BoardPlayer[] = snapshot.players.map((player) => {
      const color = (COLOR_ORDER.includes(player.color as BoardColor)
        ? player.color
        : "yellow") as BoardColor;
      const pieces: GamePiece[] = player.pieces.map((piece) => ({
        id: `${player.userId}:${piece.index}`,
        playerId: player.userId,
        position: piece.position,
        isSelected: false,
        canMove:
          player.userId === viewerUserId &&
          movablePieceIndexes.has(piece.index),
      }));
      return {
        id: player.userId,
        name: player.name,
        color,
        pieces,
        isActive: player.userId === snapshot.currentTurn,
      };
    });

    return {
      players,
      currentPlayerIndex: Math.max(
        0,
        players.findIndex((player) => player.id === snapshot.currentTurn),
      ),
      diceValue: dice >= 1 ? dice : null,
      gamePhase:
        snapshot.phase === "finished"
          ? "finished"
          : snapshot.phase === "playing"
            ? "playing"
            : "setup",
      winner: null,
      lastRoll: dice >= 1 ? dice : null,
      canRollAgain: false,
      turnStartTime: snapshot.turnDeadline || null,
      autoPlayEnabled: false,
    };
  }, [snapshot, movablePieceIndexes, viewerUserId, dice]);

  const handleRollDice = useCallback(() => {
    if (!isMyTurn || dice !== 0) return;
    playSound("diceRoll");
    room.send("rollDice", {});
  }, [room, isMyTurn, dice]);

  /**
   * Cosmetic dice animation: when a fresh server roll arrives, tell the
   * board to spin and settle on the SERVER's value. The board's own
   * onDiceResult callback is ignored — the server is the only authority.
   */
  const handleDiceResult = useCallback(
    (value: number) => {
      if (animatedDiceRef.current.consumed) {
        animatedDiceRef.current = { value, consumed: false };
      }
    },
    [],
  );

  // Trigger the cosmetic spin once per new server dice value.
  useEffect(() => {
    if (dice < 1 || dice > 6) return;
    if (
      animatedDiceRef.current.consumed ||
      animatedDiceRef.current.value !== dice
    ) {
      animatedDiceRef.current = { value: dice, consumed: true };
      boardRef.current?.throwDiceWithValue(dice);
    }
  }, [dice]);

  const boardRef = useRef<{
    throwDice: () => void;
    throwDiceWithValue: (value?: number) => void;
    isDiceAnimating: boolean;
  }>(null);

  const handlePieceClick = useCallback(
    (piece: GamePiece) => {
      if (!isMyTurn) return;
      const pieceIndex = Number(piece.id.split(":")[1]);
      if (!movablePieceIndexes.has(pieceIndex)) return;
      room.send("movePiece", { pieceIndex });
    },
    [room, isMyTurn, movablePieceIndexes],
  );

  const winner = snapshot.players.find(
    (player) => player.userId === snapshot.winnerUserId,
  );

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: "#333333" }}>
      {/* R3F scene — LudoBoard renders three.js elements and MUST live
          inside a Canvas, otherwise React treats <mesh>/<boxGeometry> as
          unknown DOM tags and the whole board crashes. */}
      <Canvas camera={{ position: [0, 12, 12], fov: 60 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={1.0} />
        <pointLight position={[-10, 10, -10]} intensity={0.4} />
        <gridHelper args={[100, 100, "#ffffff", "#4D4D4D"]} />

        <LudoBoard
          ref={boardRef}
          gameState={gameState}
          onPieceClick={handlePieceClick}
          onDiceResult={handleDiceResult}
          onDiceClick={handleRollDice}
        />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          minDistance={8}
          maxDistance={40}
        />
      </Canvas>

      {/* Turn banner */}
      <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-sm text-white backdrop-blur-sm">
        {snapshot.phase === "finished"
          ? `${winner?.name ?? "Quelqu'un"} a gagné !`
          : isMyTurn
            ? dice === 0
              ? "À toi ! Lance le dé (Entrée)."
              : "Choisis un pion à déplacer."
            : "Tour de l'adversaire…"}
      </div>

      {lastMessage && (
        <div
          className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-black"
          onAnimationEnd={() => setLastMessage(null)}
        >
          {lastMessage}
        </div>
      )}

      {/* Leave button */}
      <button
        type="button"
        onClick={onLeave}
        className="absolute right-4 top-4 z-10 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-red-500/70"
      >
        Quitter
      </button>
    </div>
  );
}
