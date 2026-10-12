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
import { useSoundMute } from "@/lib/use-sound-mute";
import type { LudoPlayerView } from "@/lib/realtime/types";

import { finishedPositionFor } from "../data/boardPositions";
import { DEFAULT_PLAYER_COUNT, isLudoColor, type LudoColor } from "../data/track";
import { getTrack } from "../utils/positionUtils";
import { themeFor } from "../data/boardTheme";
import { progressForColor } from "../utils/progress";
import LudoBoard from "../components/board/LudoBoard";
import LudoScene, { LUDO_CANVAS_PROPS } from "../components/board/LudoScene";
import MoveSelector from "../components/ui/MoveSelector";
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

  // Classement replié dans le dock d'actions (la vue locale le range aussi).
  const [rankingOpen, setRankingOpen] = useState(false);
  const { muted, toggleMuted } = useSoundMute();

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

  const handlePieceIndexSelect = useCallback(
    (pieceIndex: number) => {
      if (!isMyTurn) return;
      if (!movablePieceIndexes.has(pieceIndex)) return;
      room.send("movePiece", { pieceIndex });
    },
    [room, isMyTurn, movablePieceIndexes],
  );

  const handlePieceClick = useCallback(
    (piece: GamePiece) => {
      handlePieceIndexSelect(Number(piece.id.split(":")[1]));
    },
    [handlePieceIndexSelect],
  );

  const winner = snapshot.players.find(
    (player) => player.userId === snapshot.winnerUserId,
  );

  // Classement par progression : même calcul que l'indicateur du plateau.
  const palette = themeFor(getTrack(playerCount).shape).players;
  const ranking = gameState.players
    .map((player) => ({
      player,
      progress: progressForColor(gameState, player.color),
    }))
    .sort((a, b) => b.progress - a.progress);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const matchLive =
    snapshot.phase === "playing" || snapshot.phase === "finished";

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: "#333333" }}>
      {/* R3F scene — LudoBoard renders three.js elements and MUST live
          inside a Canvas, otherwise React treats <mesh>/<boxGeometry> as
          unknown DOM tags and the whole board crashes. */}
      <Canvas {...LUDO_CANVAS_PROPS}>
        {/* Décor de jeu : table en bois, lumières, ombres, poussière. Il
            remplace les lumières ad hoc et l'ancien LudoArena (grille de
            débogage / planche coupée). */}
        <LudoScene playerCount={gameState.playerCount} />

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

      {/* Commandes caméra — haut-droite pendant le match. Une fois la
          partie lancée, cette zone est libre : le bouton de démarrage et
          l'engrenage des paramètres ne vivent que dans la salle d'attente.
          Repliées derrière une pastille pour ne pas recouvrir le plateau. */}
      {matchLive && (
        <div className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
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
      )}

      {/* What just happened — queued, animated, self-dismissing. Sous le
          HUD, centré : jamais par-dessus la barre d'identité (haut-gauche). */}
      <GameToasts toasts={toasts} />

      {/* Dock d'actions — en bas, juste au-dessus de la barre d'appel.
          Réunit l'état du tour, le lancer de dé, le choix précis du pion et
          le classement, exactement comme la vue locale. Les anciens panneaux
          dispersés (progression en haut-gauche, pilule en bas-centre,
          caméra en bas-droite) se chevauchaient les uns les autres. */}
      {matchLive && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center px-3 sm:bottom-20">
          <div className="pointer-events-auto w-full max-w-md space-y-2.5 rounded-2xl bg-black/55 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
            {/* État du tour */}
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white/40"
                style={{
                  backgroundColor: palette[currentPlayer?.color ?? "yellow"],
                }}
              />
              <span className="min-w-0 truncate text-sm font-semibold">
                {snapshot.phase === "finished"
                  ? `${winner?.name ?? "Quelqu'un"} a gagné !`
                  : isMyTurn
                    ? "À vous de jouer"
                    : `Tour de ${currentPlayer?.name ?? "l'adversaire"}`}
              </span>
              {snapshot.phase === "playing" && dice >= 1 && (
                <span className="ml-auto shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums">
                  Dé {dice}
                </span>
              )}
            </div>

            {/* Choix précis du pion — mêmes cibles larges que la vue locale. */}
            {snapshot.phase === "playing" && isMyTurn && (
              <MoveSelector
                gameState={gameState}
                onSelectPiece={handlePieceIndexSelect}
              />
            )}

            {/* Lancer le dé */}
            {snapshot.phase === "playing" && (
              <button
                type="button"
                onClick={handleRollDice}
                disabled={!isMyTurn || dice !== 0}
                className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors ${
                  isMyTurn && dice === 0
                    ? "bg-emerald-500 text-white hover:bg-emerald-400 active:scale-[0.99]"
                    : "cursor-not-allowed bg-white/10 text-white/40"
                }`}
              >
                {isMyTurn
                  ? dice === 0
                    ? "Lancer le dé"
                    : movablePieceIndexes.size > 0
                      ? "Choisis un pion à déplacer"
                      : "Aucun coup possible…"
                  : "En attente des autres joueurs…"}
              </button>
            )}

            {/* Classement, replié. */}
            <div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRankingOpen((value) => !value)}
                  aria-expanded={rankingOpen}
                  className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10"
                >
                  Classement
                  <span className="ml-1 text-[10px] text-white/60">
                    {rankingOpen ? "▲" : "▼"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={toggleMuted}
                  aria-pressed={muted}
                  aria-label={muted ? "Activer le son" : "Couper le son"}
                  title={muted ? "Activer le son" : "Couper le son"}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    muted
                      ? "bg-white/5 text-white/50 hover:bg-white/10"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  Son {muted ? "OFF" : "ON"}
                </button>
              </div>

              {rankingOpen && (
                <div className="mt-1.5 grid gap-1">
                  {ranking.map(({ player, progress }, index) => (
                    <div key={player.id} className="flex items-center gap-2">
                      <span className="w-3 text-xs text-white/50">
                        {index + 1}
                      </span>
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: palette[player.color] }}
                      />
                      <span className="max-w-[72px] truncate text-xs">
                        {player.name}
                      </span>
                      <div
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Progression de ${player.name}`}
                        className="relative ml-auto h-1.5 w-14 overflow-hidden rounded-full bg-white/20"
                      >
                        <div
                          className="h-full rounded-full transition-[width] duration-300 ease-out"
                          style={{
                            width: `${progress}%`,
                            backgroundColor: palette[player.color],
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs tabular-nums text-white/80">
                        {progress}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
