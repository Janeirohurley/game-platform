"use client";

import { useState } from "react";
import type { Player } from "../../types/game";
import { playSound } from "@/lib/sounds";

// Player Setup Component
function PlayerSetup({
  onGameStart,
}: {
  onGameStart: (players: Player[]) => void;
}) {
  const [numPlayers, setNumPlayers] = useState<number | null>(null);
  const [players, setPlayers] = useState<Partial<Player>[]>([]);
  const [currentPlayerSetup, setCurrentPlayerSetup] = useState(0);

  const availableColors: Array<"yellow" | "green" | "blue" | "red"> = [
    "yellow",
    "green",
    "blue",
    "red",
  ];
  const usedColors = players.map((p) => p.color).filter(Boolean);
  const availableColorsForSelection = availableColors.filter(
    (color) => !usedColors.includes(color),
  );

  const handleNumPlayersSelect = (num: number) => {
    playSound("buttonClick");
    setNumPlayers(num);
    setPlayers(
      Array(num)
        .fill(null)
        .map(() => ({ name: "", color: undefined })),
    );
    setCurrentPlayerSetup(0);
  };

  const handlePlayerNameChange = (name: string) => {
    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerSetup] = {
      ...updatedPlayers[currentPlayerSetup],
      name,
    };
    setPlayers(updatedPlayers);
  };

  const handleColorSelect = (color: "yellow" | "green" | "blue" | "red") => {
    playSound("buttonClick");
    const updatedPlayers = [...players];
    updatedPlayers[currentPlayerSetup] = {
      ...updatedPlayers[currentPlayerSetup],
      color,
    };
    setPlayers(updatedPlayers);
  };

  const handleNextPlayer = () => {
    playSound("buttonClick");
    if (currentPlayerSetup < players.length - 1) {
      setCurrentPlayerSetup(currentPlayerSetup + 1);
    } else {
      // All players set up, start the game
      const completePlayers: Player[] = players.map((player, index) => ({
        id: `player_${index}`,
        name: player.name!,
        color: player.color!,
        pieces: Array(4)
          .fill(null)
          .map((_, pieceIndex) => ({
            id: `${player.color}_piece_${pieceIndex}`,
            playerId: `player_${index}`,
            position: -1, // Start at home
            isSelected: false,
            canMove: false,
          })),
        isActive: index === 0, // First player starts
      }));
      onGameStart(completePlayers);
    }
  };

  const currentPlayer = players[currentPlayerSetup];
  const canProceed = currentPlayer?.name && currentPlayer?.color;

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-center mb-6">Ludo Game Setup</h2>

        {numPlayers === null ? (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              How many players? (1-4)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumPlayersSelect(num)}
                  className="py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
                >
                  {num} Player{num > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Player {currentPlayerSetup + 1} of {numPlayers}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Player Name:
                </label>
                <input
                  type="text"
                  value={currentPlayer?.name || ""}
                  onChange={(e) => handlePlayerNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter player name"
                  maxLength={20}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Choose Color:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableColorsForSelection.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className={`py-3 px-4 rounded-lg font-semibold transition-colors capitalize ${
                        currentPlayer?.color === color
                          ? "ring-2 ring-black"
                          : "hover:opacity-80"
                      }`}
                      style={{
                        backgroundColor:
                          color === "yellow"
                            ? "#FFD700"
                            : color === "green"
                              ? "#228B22"
                              : color === "blue"
                                ? "#4169E1"
                                : "#DC143C",
                        color: color === "yellow" ? "#000" : "#fff",
                      }}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleNextPlayer}
                disabled={!canProceed}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  canProceed
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {currentPlayerSetup < players.length - 1
                  ? "Next Player"
                  : "Start Game"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerSetup;
