"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { Room } from "@colyseus/sdk";

import type {
  GamePiece,
  GameState,
  Player as BoardPlayer,
} from "@/games/ludo/types/game";
import { playSound } from "@/lib/sounds";
import type { LudoPlayerView } from "@/lib/realtime/types";

import { finishedPositionFor } from "../data/boardPositions";
import { DEFAULT_PLAYER_COUNT, isLudoColor, type LudoColor } from "../data/track";
import LudoBoard from "../components/board/LudoBoard";
import LudoArena from "../components/board/LudoArena";
import { GameToasts, useGameToasts } from "./game-toasts";
import {
  CameraRig,
  type CameraViewName,
} from "./camera-controls";
import { CameraViewsPanel } from "./camera-views-panel";

export interface ServerLudoSnapshot {
  gameId: string;
  gameName: string;
  minPlayers: number;
  maxPlayers: number;
  targetPlayers: number;
  phase: "waiting" | "ready" | "playing" | "finished" | "closed";
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
}

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
}: OnlineLudoPlayProps) {
  const { toasts, push } = useGameToasts();

  /*
   * Camera state (spec: "bien positionner la table"). The default is a
   * stable three-quarter view; named views glide the camera, auto-rotate
   * is opt-in, and the lock freezes everything for distraction-free
   * watching. A manual drag clears the active view back to "free".
   */
  const [cameraView, setCameraView] = useState<CameraViewName | "free">(
    "overview",
  );
  const [autoRotate, setAutoRotate] = useState(false);
  const [cameraLocked, setCameraLocked] = useState(false);

  const boardRef = useRef<{
    throwDice: () => void;
    throwDiceWithValue: (value?: number) => void;
    isDiceAnimating: boolean;
  }>(null);

  // Latest roster, so a notice can name who did what without making the
  // subscription below re-run on every state patch.
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // Everything the room tells us: rolls, captures, drops, end of match.
  useEffect(() => {
    const nameOf = (userId: string) =>
      snapshotRef.current.players.find((player) => player.userId === userId)
        ?.name ?? "Quelqu'un";

    /*
     * The roll arrives as an event, not as a state change.
     *
     * State reaches clients as periodic patches, so a roll that leaves
     * nothing to play — cleared in the same server tick — never shows up
     * in one. Animating from the event instead means every player sees
     * the dice turn, and sees the same number.
     */
    const offDice = room.onMessage(
      "diceRolled",
      (message: {
        userId: string;
        name?: string;
        value: number;
        playable?: number;
      }) => {
        playSound("diceRoll");
        boardRef.current?.throwDiceWithValue(message.value);

        const mine = message.userId === viewerUserId;
        const who = mine ? "Tu as fait" : `${message.name ?? nameOf(message.userId)} a fait`;
        push(
          message.playable === 0
            ? `${who} ${message.value} — rien à jouer`
            : `${who} ${message.value}`,
          mine ? "good" : "info",
        );
      },
    );

    const offAuto = room.onMessage(
      "autoMoved",
      (message: { userId: string }) => {
        push(
          message.userId === viewerUserId
            ? "Un seul coup possible — joué pour toi"
            : `${nameOf(message.userId)} n'avait qu'un coup`,
        );
      },
    );

    const offCaptured = room.onMessage(
      "pieceCaptured",
      (message: { userId: string; byUserId: string }) => {
        playSound("capture");
        if (message.byUserId === viewerUserId) {
          push("Capture ! Tu rejoues.", "good");
        } else if (message.userId === viewerUserId) {
          push("Un de tes pions a été capturé !", "bad");
        } else {
          push(`${nameOf(message.byUserId)} a capturé un pion`);
        }
      },
    );

    const offDropped = room.onMessage(
      "playerDisconnected",
      (message: { userId: string; name?: string }) => {
        push(
          `${message.name ?? nameOf(message.userId)} a perdu la connexion…`,
          "bad",
        );
      },
    );

    const offBack = room.onMessage(
      "playerReconnected",
      (message: { userId: string }) => {
        push(`${nameOf(message.userId)} est de retour`, "good");
      },
    );

    const offLeft = room.onMessage(
      "playerLeft",
      (message: { userId: string; name?: string }) => {
        // The name comes with the event: the player is already out of
        // the roster by the time this runs.
        push(
          `${message.name ?? nameOf(message.userId)} a quitté la partie`,
          "bad",
        );
      },
    );

    const offFinished = room.onMessage(
      "gameFinished",
      (message: { winnerUserId: string }) => {
        playSound("win");
        const mine = message.winnerUserId === viewerUserId;
        push(
          mine ? "Victoire ! 🎉" : `${nameOf(message.winnerUserId)} a gagné`,
          mine ? "good" : "info",
        );
      },
    );

    return () => {
      offDice();
      offAuto();
      offCaptured();
      offDropped();
      offBack();
      offLeft();
      offFinished();
    };
  }, [room, viewerUserId, push]);

  const isMyTurn = snapshot.currentTurn === viewerUserId;
  const dice = snapshot.diceValue;

  /*
   * Table size, clamped to what the board can actually draw.
   *
   * `targetPlayers` is the authoritative choice and is validated by the
   * base room against the registry, so a hostile client cannot ask for a
   * 99-player table. The clamp is a render-side belt-and-braces so a
   * snapshot from a future registry change cannot produce a board with
   * no seats.
   */
  const playerCount = Math.min(
    6,
    Math.max(2, Math.trunc(snapshot.targetPlayers) || DEFAULT_PLAYER_COUNT),
  );
  const finishedPosition = finishedPositionFor(playerCount);

  // Which of my pieces can legally move, according to the SERVER state.
  // This is display filtering only — the server re-validates every move.
  const movablePieceIndexes = useMemo(() => {
    if (!isMyTurn || dice < 1 || dice > 6) return new Set<number>();
    const me = snapshot.players.find((player) => player.userId === viewerUserId);
    if (!me) return new Set<number>();
    const movable = new Set<number>();
    for (const piece of me.pieces) {
      // The finished center — no piece ever moves from there.
      if (piece.position === finishedPosition) continue;
      // Leaving base requires a 6; the finish is reached by EXACT count,
      // so `position + dice === FINISHED_POSITION` is legal and must stay
      // clickable — the old `<= 56` filter made every finishing move
      // unplayable, stranding pieces on the last home-column cell.
      if (piece.position === -1) {
        if (dice === 6) movable.add(piece.index);
        continue;
      }
      if (piece.position + dice <= finishedPosition) {
        movable.add(piece.index);
      }
    }
    return movable;
  }, [isMyTurn, dice, snapshot.players, viewerUserId, finishedPosition]);

  // Mirror server state into the board's GameState shape.
  const gameState: GameState = useMemo(() => {
    const players: BoardPlayer[] = snapshot.players.map((player) => {
      // The server hands out the six palette colors and never a seventh.
      // An unknown value would mean the two repos disagree on the
      // palette, so falling back to seat 0 keeps the board drawable
      // instead of indexing `undefined` mid-render.
      const color: LudoColor = isLudoColor(player.color) ? player.color : "yellow";
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
      // The table geometry follows the size the HOST CHOSE, not the
      // number of players currently seated: a 6-player table that has
      // only received one join request is already a 6-player board, and
      // its start offsets must not move under the players as they sit.
      playerCount: playerCount,
    };
  }, [snapshot, movablePieceIndexes, viewerUserId, dice, playerCount]);

  const handleRollDice = useCallback(() => {
    if (!isMyTurn || dice !== 0) return;
    playSound("diceRoll");
    room.send("rollDice", {});
  }, [room, isMyTurn, dice]);

  /**
   * The board reports the value its own animation settled on. Ignored:
   * the server already decided, and the spin was started from its
   * `diceRolled` event.
   */
  const handleDiceResult = useCallback(() => {}, []);

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
      <Canvas camera={{ position: [0, 16, 16], fov: 60 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={1.0} />
        <pointLight position={[-10, 10, -10]} intensity={0.4} />
        {/* 3D Arena Background : grille pour la croix, plancher de bois
            pour l'hexagone, comme dans les maquettes. */}
        <LudoArena playerCount={gameState.playerCount} />

        <LudoBoard
          ref={boardRef}
          gameState={gameState}
          onPieceClick={handlePieceClick}
          onDiceResult={handleDiceResult}
          onDiceClick={handleRollDice}
        />

        {/* Table stays centred: no pan, bounded zoom, named views. */}
        <CameraRig
          view={cameraView === "free" ? "overview" : cameraView}
          autoRotate={autoRotate && !cameraLocked}
          locked={cameraLocked}
          onUserMove={() => setCameraView("free")}
        />
      </Canvas>

      {/* Camera panel — bottom-right, above the chat bubble. */}
      <div className="absolute bottom-20 right-4 z-20 sm:bottom-24">
        <CameraViewsPanel
          view={cameraView}
          onViewChange={setCameraView}
          autoRotate={autoRotate}
          onAutoRotateChange={setAutoRotate}
          locked={cameraLocked}
          onLockedChange={setCameraLocked}
          onReset={() => {
            setAutoRotate(false);
            setCameraLocked(false);
            setCameraView("overview");
          }}
        />
      </div>

      {/* What just happened — queued, animated, self-dismissing. */}
      <GameToasts toasts={toasts} />

      {/* What to do now. Steady, so it never competes with the toasts.
          While waiting, the HUD already says whose turn it is not — the
          hint stays out of the way. */}
      {snapshot.phase === "playing" || snapshot.phase === "finished" ? (
        <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur-sm">
          {snapshot.phase === "finished"
            ? `${winner?.name ?? "Quelqu'un"} a gagné !`
            : isMyTurn
              ? dice === 0
                ? "À toi ! Lance le dé (Entrée)."
                : "Choisis un pion à déplacer."
              : `Tour de ${
                  snapshot.players.find(
                    (player) => player.userId === snapshot.currentTurn,
                  )?.name ?? "l'adversaire"
                }…`}
        </div>
      ) : null}
    </div>
  );
}
