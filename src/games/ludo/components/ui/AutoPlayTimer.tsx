"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0 && gameState.gamePhase === "playing") {
        onAutoPlay();
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, onAutoPlay, gameState.gamePhase]);

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
