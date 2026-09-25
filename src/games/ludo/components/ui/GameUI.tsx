"use client";

import type { GamePiece, GameState } from "../../types/game";
import AutoPlayTimer from "./AutoPlayTimer";
import { playSound } from "@/lib/sounds";

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
            Moveable pieces:{" "}
            {currentPlayer.pieces.filter((p) => p.canMove).length}
          </div>
        </div>
      )}

      {/* Auto-play Timer */}
      {gameState.autoPlayEnabled && gameState.turnStartTime && (
        <AutoPlayTimer
          startTime={gameState.turnStartTime}
          onAutoPlay={onAutoPlay}
          gameState={gameState}
        />
      )}

      {/* Player Status */}
      <div className="space-y-1 text-xs">
        {gameState.players.map((player, index) => (
          <div
            key={player.id}
            className={`flex items-center gap-2 p-1 rounded ${
              index === gameState.currentPlayerIndex ? "bg-white/20" : ""
            }`}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{
                backgroundColor:
                  player.color === "yellow"
                    ? "#FFD700"
                    : player.color === "green"
                      ? "#228B22"
                      : player.color === "blue"
                        ? "#4169E1"
                        : "#DC143C",
              }}
            />
            <span>{player.name}</span>
            <span className="ml-auto">
              {player.pieces.filter((p) => p.position === 57).length}/4 finished
            </span>
          </div>
        ))}
      </div>

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
