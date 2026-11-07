"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  Cancel01Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";
import type { Room } from "@colyseus/sdk";

import { ChessScene } from "../three/chess-scene";
import type { ChessColor, ChessPromotionPiece } from "../types";
import { PromotionDialog } from "../local/promotion-dialog";
import { ChessOnlineHud } from "./chess-online-hud";
import {
  CHESS_START_FEN,
  useOnlineChess,
  type OnlineChessOutcome,
} from "./use-online-chess";

interface ChessRoomViewProps {
  room: Room;
  viewerUserId: string;
}

const REASON_LABELS: Record<string, string> = {
  checkmate: "Échec et mat.",
  timeout: "Temps écoulé.",
  forfeit: "L'adversaire a quitté la partie.",
  stalemate: "Pat : plus aucun coup légal.",
  "fifty-move": "Nulle par la règle des 50 coups.",
  threefold: "Nulle par répétition triple de la position.",
  "insufficient-material": "Nulle : matériel insuffisant pour mater.",
  draw: "La partie se termine par un match nul.",
};

/**
 * Online 3D board. The room owns the game: this view mirrors its FEN,
 * forwards move intents and animates only the moves the server accepted.
 * Local chess.js calls exist to highlight squares, never to decide.
 */
export function ChessRoomView({ room, viewerUserId }: ChessRoomViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ChessScene | null>(null);
  const startedRef = useRef(false);
  const sendMoveRef = useRef<(move: {
    from: string;
    to: string;
    promotion?: ChessPromotionPiece;
  }) => void>(() => {});

  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const {
    fen,
    started,
    turnColor,
    viewerColor,
    canPlay,
    labels,
    history,
    turnSecondsLeft,
    outcome,
    outcomeReason,
    winnerColor,
    lastMoveEvent,
    sendMove,
  } = useOnlineChess(room, viewerUserId);

  useEffect(() => {
    sendMoveRef.current = sendMove;
  }, [sendMove]);

  // The 3D scene is created only once the match is live. Waiting rooms stay
  // light, and a reconnect rebuilds the scene from the room's FEN.
  useEffect(() => {
    if (!started) return;
    const container = containerRef.current;
    if (!container) return;

    setReady(false);
    startedRef.current = false;

    const scene = new ChessScene(container, {
      onProgress: (value) => setProgress(value),
      onReady: () => setReady(true),
      onPromotion: (from, to) => setPromotion({ from, to }),
      onMoveIntent: (move) => sendMoveRef.current(move),
      onError: (message) => {
        setError(message);
        console.warn("[chess]", message);
      },
      onContextRestored: () => setError(null),
    });

    sceneRef.current = scene;
    void scene.mount();

    return () => {
      scene.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
    };
  }, [room, started]);

  // Seed the mirror with the room's position, then keep the controllable
  // side in sync if the seat is assigned after the first frame.
  useEffect(() => {
    if (!ready || !started) return;
    if (!startedRef.current) {
      startedRef.current = true;
      sceneRef.current?.startOnline(viewerColor, fen || CHESS_START_FEN);
    } else {
      sceneRef.current?.setOnlineColor(viewerColor);
    }
  }, [ready, started, viewerColor, fen]);

  useEffect(() => {
    if (!ready || !started) return;
    sceneRef.current?.setOnlineFinished(outcome !== "playing");
  }, [outcome, ready, started]);

  // Only the server's `moveApplied` drives animation: applying an intent
  // locally would show a move the room might still refuse.
  useEffect(() => {
    if (!lastMoveEvent) return;
    sceneRef.current?.applyRemoteMove(lastMoveEvent.move);
  }, [lastMoveEvent]);

  // Safety net: if a frame was missed, adopt the authoritative FEN once
  // things settle. Normal moves already match, so this is a no-op.
  useEffect(() => {
    if (!ready || !started || !fen) return;
    const timer = window.setTimeout(() => {
      const scene = sceneRef.current;
      if (scene && scene.getFen() !== fen) scene.applyPosition(fen);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [fen, ready, started]);

  useEffect(() => {
    const off = room.onMessage("moveRejected", () => {
      sceneRef.current?.clearPendingIntent();
    });
    return off;
  }, [room]);

  const pickPromotion = (piece: ChessPromotionPiece) => {
    setPromotion(null);
    sceneRef.current?.resolvePromotion(piece);
  };

  const cancelPromotion = () => {
    setPromotion(null);
    sceneRef.current?.cancelPromotion();
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#07101f]">
      {started && <div ref={containerRef} className="absolute inset-0" />}

      {!started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/60">
          <p className="text-sm font-medium">En attente du début de la partie…</p>
          <p className="max-w-xs text-xs leading-5 text-white/35">
            Le créateur lance la partie quand les deux sièges sont prêts.
          </p>
        </div>
      )}

      {started && !ready && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#07101f] px-6 text-center text-white"
          role="status"
          aria-live="polite"
        >
          <HugeiconsIcon
            icon={Loading03Icon}
            size={22}
            strokeWidth={1.8}
            className="animate-spin text-amber-300"
          />
          <div className="w-full max-w-xs">
            <p className="text-sm font-semibold">Chargement de l&apos;échiquier 3D</p>
            <p className="mt-1 text-xs text-white/40">
              Modèle, textures et éclairage…
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-amber-300 transition-[width] duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] tabular-nums text-white/30">
              {Math.round(progress * 100)} %
            </p>
          </div>
        </div>
      )}

      {started && ready && (
        <ChessOnlineHud
          labels={labels}
          turnColor={turnColor}
          viewerColor={viewerColor}
          canPlay={canPlay}
          turnSecondsLeft={turnSecondsLeft}
          history={history}
          outcome={outcome}
          onFlip={() => sceneRef.current?.flipView()}
        />
      )}

      {started && ready && promotion && (
        <PromotionDialog
          color={viewerColor ?? turnColor}
          onPick={pickPromotion}
          onCancel={cancelPromotion}
        />
      )}

      {started && ready && outcome !== "playing" && (
        <OnlineResult
          outcome={outcome}
          reason={outcomeReason}
          labels={labels}
          winnerColor={winnerColor}
          viewerColor={viewerColor}
        />
      )}

      {error && (
        <div className="absolute inset-x-3 bottom-20 z-40 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-950/85 p-3 text-xs text-rose-100 shadow-lg backdrop-blur-md sm:inset-x-auto sm:right-3 sm:max-w-sm">
          <HugeiconsIcon
            icon={Alert02Icon}
            size={16}
            strokeWidth={1.8}
            className="mt-0.5 shrink-0"
          />
          <p className="flex-1 leading-5">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 rounded-md border border-rose-300/30 px-2 py-1 font-semibold text-rose-100 transition hover:bg-white/10"
          >
            Recharger
          </button>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Masquer l'avertissement"
            className="shrink-0 rounded-md p-1 text-rose-200/70 transition hover:bg-white/10 hover:text-white"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

interface OnlineResultProps {
  outcome: OnlineChessOutcome;
  reason: string;
  labels: Record<ChessColor, string>;
  winnerColor: ChessColor | null;
  viewerColor: ChessColor | null;
}

function OnlineResult({
  outcome,
  reason,
  labels,
  winnerColor,
  viewerColor,
}: OnlineResultProps) {
  let title = "Partie nulle";
  if (outcome === "win") {
    if (viewerColor && winnerColor === viewerColor) title = "Tu gagnes";
    else if (viewerColor && winnerColor) title = "Tu perds";
    else if (winnerColor) title = `${labels[winnerColor]} gagnent`;
    else title = "Partie terminée";
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex justify-center px-3">
      <div className="rounded-2xl border border-white/15 bg-[#080d15]/92 px-5 py-3 text-center text-white shadow-2xl backdrop-blur-md">
        <p className="text-sm font-semibold" role="status">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-white/45">
          {REASON_LABELS[reason] ?? "La partie est terminée."}
        </p>
      </div>
    </div>
  );
}
