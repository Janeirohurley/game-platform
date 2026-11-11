"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

import { ChessScene } from "../three/chess-scene";
import type {
  ChessMode,
  ChessPromotionPiece,
  ChessSnapshot,
} from "../types";
import { ChessHud } from "./chess-hud";
import { ChessMenu } from "./chess-menu";
import { PromotionDialog } from "./promotion-dialog";
import { ResultBanner } from "./result-banner";

/**
 * Owns the React <-> Three.js bridge. The scene is created once on mount and
 * disposed on unmount; all game state arrives through snapshots, so React
 * never reaches into the board.
 */
export function LocalChess() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<ChessScene | null>(null);

  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<ChessMode | null>(null);
  const [snapshot, setSnapshot] = useState<ChessSnapshot | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [showMenu, setShowMenu] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new ChessScene(container, {
      onProgress: (value) => setProgress(value),
      onReady: () => setReady(true),
      onSnapshot: (value) => setSnapshot(value),
      onPromotion: (from, to) => setPromotion({ from, to }),
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
  }, []);

  const startGame = (nextMode: ChessMode) => {
    setMode(nextMode);
    setShowMenu(false);
    setPromotion(null);
    setError(null);
    sceneRef.current?.startGame(nextMode);
  };

  const restart = () => {
    setPromotion(null);
    if (mode) {
      sceneRef.current?.resetGame();
      return;
    }
    setShowMenu(true);
  };

  const openMenu = () => {
    sceneRef.current?.stopGame();
    setMode(null);
    setPromotion(null);
    setShowMenu(true);
  };

  const pickPromotion = (piece: ChessPromotionPiece) => {
    setPromotion(null);
    sceneRef.current?.resolvePromotion(piece);
  };

  const cancelPromotion = () => {
    setPromotion(null);
    sceneRef.current?.cancelPromotion();
  };

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="relative h-[74dvh] min-h-[440px] w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-[#07101f] shadow-2xl dark:border-white/10 sm:h-[calc(100dvh-15rem)]"
      >
        {!ready && (
          <div
            className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#07101f] px-6 text-center text-white"
            role="status"
            aria-live="polite"
          >
            <div className="w-full max-w-xs">
              <p className="text-sm font-semibold">
                Chargement de l&apos;échiquier 3D
              </p>
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

            {error && (
              <p className="max-w-sm text-xs leading-5 text-rose-300">{error}</p>
            )}
          </div>
        )}

        {ready && showMenu && <ChessMenu onStart={startGame} />}

        {ready && !showMenu && snapshot && (
          <ChessHud
            snapshot={snapshot}
            mode={mode}
            onMenu={openMenu}
            onRestart={restart}
            onFlip={() => sceneRef.current?.flipView()}
          />
        )}

        {ready && !showMenu && snapshot?.isGameOver && !promotion && (
          <ResultBanner
            snapshot={snapshot}
            onRestart={restart}
            onMenu={openMenu}
          />
        )}

        {ready && promotion && snapshot && (
          <PromotionDialog
            color={snapshot.turn}
            onPick={pickPromotion}
            onCancel={cancelPromotion}
          />
        )}

        {ready && error && (
          <div className="absolute inset-x-3 bottom-3 z-40 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-950/80 p-3 text-xs text-rose-100 shadow-lg backdrop-blur-md sm:inset-x-auto sm:right-3 sm:max-w-sm">
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

      <p className="mt-3 text-center text-xs text-slate-400 dark:text-white/30">
        Glisse pour tourner la caméra · molette pour zoomer · clique une pièce
        pour voir ses coups légaux.
      </p>
    </div>
  );
}
