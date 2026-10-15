"use client";

import { useState, useEffect, useRef } from "react";
import { useDocumentVisible } from "@/hooks/use-document-visible";
import type { GameState } from "../../types/game";

// Auto-play Timer Component
function AutoPlayTimer({
  startTime,
  onAutoPlay,
  gameState,
}: {
  startTime: number;
  onAutoPlay: () => void;
  gameState: GameState;
}) {
  const [timeLeft, setTimeLeft] = useState(30);
  const visible = useDocumentVisible();

  // Temps passé onglet masqué : on le retranche du décompte, sinon le retour
  // sur l'onglet ferait expirer le délai d'un coup et l'auto-play jouerait le
  // tour du joueur sans qu'il l'ait vu.
  const hiddenAt = useRef<number | null>(null);
  const pausedMs = useRef(0);

  useEffect(() => {
    if (!visible) {
      if (hiddenAt.current === null) hiddenAt.current = Date.now();
      return;
    }
    if (hiddenAt.current !== null) {
      pausedMs.current += Date.now() - hiddenAt.current;
      hiddenAt.current = null;
    }
  }, [visible]);

  // Un nouveau tour remet le compteur du tour à zéro.
  useEffect(() => {
    pausedMs.current = 0;
  }, [startTime]);

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - pausedMs.current - startTime) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0 && visible && gameState.gamePhase === "playing") {
        onAutoPlay();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, onAutoPlay, gameState.gamePhase, visible]);

  if (timeLeft > 25) return null; // Only show when close to auto-play

  return (
    <div className="text-xs mb-2 p-2 bg-orange-500/20 rounded border border-orange-500/50">
      <div className="flex items-center justify-between">
        <span>Auto-play in:</span>
        <span className="font-bold text-orange-400">{timeLeft}s</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
        <div
          className="bg-orange-500 h-1 rounded-full transition-all duration-1000"
          style={{ width: `${((30 - timeLeft) / 30) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default AutoPlayTimer;
