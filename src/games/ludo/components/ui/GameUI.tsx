"use client";

import type { GamePiece, GameState } from "../../types/game";
import AutoPlayTimer from "./AutoPlayTimer";
import { playSound } from "@/lib/sounds";
import { getTrack } from "../../utils/positionUtils";
import { themeFor } from "../../data/boardTheme";
import { progressForColor } from "../../utils/progress";

// Game UI Component
function GameUI({
  gameState,
  onRollDice,
  onPieceClick,
  onAutoPlay,
  onToggleAutoPlay,
}: {
  gameState: GameState;
  onRollDice: () => void;
  onPieceClick: (piece: GamePiece) => void;
  onAutoPlay: () => void;
  onToggleAutoPlay: () => void;
}) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  // Classement par progression : même calcul que l'indicateur posé sur le
  // plateau, pour que les deux affichages ne puissent pas diverger.
  const palette = themeFor(getTrack(gameState.playerCount).shape).players;
  const ranking = gameState.players
    .map((player) => ({
      player,
      progress: progressForColor(gameState, player.color),
    }))
    .sort((a, b) => b.progress - a.progress);

  return (
    <div className="absolute bottom-4 left-4 z-10 bg-black/40 backdrop-blur-sm rounded-lg p-4 text-white min-w-[300px]">
      {/* Current Player */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{
              backgroundColor:
                currentPlayer.color === "yellow"
                  ? "#FFD700"
                  : currentPlayer.color === "green"
                    ? "#228B22"
                    : currentPlayer.color === "blue"
                      ? "#4169E1"
                      : "#DC143C",
            }}
          />
          <span className="font-semibold">
            {currentPlayer.name}&apos;s Turn
          </span>
        </div>

        {gameState.diceValue && (
          <div className="text-sm">Last Roll: {gameState.diceValue}</div>
        )}
      </div>

      {/* Roll Dice Button */}
      <button
        onClick={onRollDice}
        disabled={gameState.diceValue !== null && !gameState.canRollAgain}
        className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors mb-3 ${
          gameState.diceValue === null || gameState.canRollAgain
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-gray-500 text-gray-300 cursor-not-allowed"
        }`}
      >
        {gameState.diceValue === null
          ? "Roll Dice"
          : gameState.canRollAgain
            ? "Roll Again (6 or Finish)"
            : "Dice Rolled - Select Piece"}
      </button>

      {/* Turn Status */}
      {gameState.diceValue && (
        <div className="text-xs mb-2 p-2 bg-white/10 rounded">
          <div>Dice: {gameState.diceValue}</div>
          <div>
            Moveable pieces: {currentPlayer.pieces.filter((p) => p.canMove).length}
          </div>
        </div>
      )}

      {/* Classement par progression, du premier au dernier. */}
      <div className="mb-3 grid gap-1 text-xs">
        {ranking.map(({ player, progress }, index) => (
          <div
            key={player.id}
            className={`flex items-center gap-2 rounded px-1 py-0.5 ${
              player.id === currentPlayer?.id ? "bg-white/20" : ""
            }`}
          >
            <span className="w-4 text-white/50">{index + 1}.</span>
            <div
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: palette[player.color] }}
            />
            <span className="max-w-[80px] truncate">{player.name}</span>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progression de ${player.name}`}
              className="relative ml-auto h-2 w-16 shrink-0 overflow-hidden rounded-full bg-white/20"
            >
              <div
                className="h-full rounded-full duration-300 ease-out"
                style={{
                  width: `${progress}%`,
                  backgroundColor: palette[player.color],
                }}
              />
            </div>
            <span className="w-9 shrink-0 text-right tabular-nums">
              {progress} %
            </span>
          </div>
        ))}
      </div>

      {/* Auto-play Timer */}
      {gameState.autoPlayEnabled && gameState.turnStartTime && (
        <AutoPlayTimer
          startTime={gameState.turnStartTime}
          onAutoPlay={onAutoPlay}
          gameState={gameState}
        />
      )}

      {/* Auto-play Toggle */}
      <div className="mb-3">
        <button
          onClick={() => {
            playSound("buttonClick");
            onToggleAutoPlay();
          }}
          className={`w-full py-1 px-2 rounded text-xs font-semibold transition-colors ${
            gameState.autoPlayEnabled
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-gray-600 hover:bg-gray-700 text-white"
          }`}
        >
          Auto-play: {gameState.autoPlayEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {/* Instructions */}
      <div className="mt-3 text-xs text-gray-300">
        {gameState.diceValue &&
          !currentPlayer.pieces.some((p) => p.canMove) && (
            <div className="text-yellow-400 font-semibold mt-2">
              {currentPlayer.pieces.every((p) => p.position === -1) &&
              gameState.diceValue !== 6 ? (
                <>⚠️ Need 6 to start - next player...</>
              ) : (
                <>⚠️ No valid moves - switching turns...</>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

export default GameUI;
