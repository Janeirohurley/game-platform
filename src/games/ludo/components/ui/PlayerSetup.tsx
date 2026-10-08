"use client";

import { useState } from "react";
import { LUDO_PALETTE, MIN_PLAYER_COUNT, MAX_PLAYER_COUNT } from "../../data/track";
import { COLOR_LABELS, BOARD_THEME } from "../../data/boardTheme";
import type { LudoColor, Player } from "../../types/game";
import { playSound } from "@/lib/sounds";

const SIZES = Array.from(
  { length: MAX_PLAYER_COUNT - MIN_PLAYER_COUNT + 1 },
  (_, i) => MIN_PLAYER_COUNT + i,
);

// Configuration de la partie locale.
//
// La couleur N'EST PAS choisie librement : elle est imposée par le rang
// du joueur. La géométrie de la piste attribue les départs à des sièges
// numérotés dans l'ordre de jeu, donc un joueur qui choisirait une autre
// couleur verrait son chemin et sa zone d'attente appartenir à quelqu'un
// d'autre. Assigner la couleur, c'est garantir que ce qu'on voit
// correspond à ce que les règles calculent.
function PlayerSetup({
  onGameStart,
}: {
  onGameStart: (players: Player[]) => void;
}) {
  const [numPlayers, setNumPlayers] = useState<number | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [currentPlayerSetup, setCurrentPlayerSetup] = useState(0);

  const handleNumPlayersSelect = (num: number) => {
    playSound("buttonClick");
    setNumPlayers(num);
    setNames(Array(num).fill(""));
    setCurrentPlayerSetup(0);
  };

  const handleNameChange = (name: string) => {
    setNames((previous) =>
      previous.map((value, index) => (index === currentPlayerSetup ? name : value)),
    );
  };

  const handleNextPlayer = () => {
    playSound("buttonClick");
    if (currentPlayerSetup < numPlayers! - 1) {
      setCurrentPlayerSetup((previous) => previous + 1);
      return;
    }

    const completePlayers: Player[] = names.map((name, seat) => {
      const color: LudoColor = LUDO_PALETTE[seat];
      const id = `player_${seat}`;
      return {
        id,
        name: name.trim() || COLOR_LABELS[color],
        color,
        pieces: Array.from({ length: 4 }, (_, pieceIndex) => ({
          id: `${color}_piece_${pieceIndex}`,
          playerId: id,
          // -1 = zone d'attente.
          position: -1,
          isSelected: false,
          canMove: false,
        })),
        isActive: seat === 0,
      };
    });

    onGameStart(completePlayers);
  };

  const currentName = names[currentPlayerSetup] ?? "";
  const canProceed = currentName.trim().length > 0;
  const currentColor: LudoColor | undefined =
    numPlayers === null ? undefined : LUDO_PALETTE[currentPlayerSetup];

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-center mb-6">Ludo Game Setup</h2>

        {numPlayers === null ? (
          <div>
            <h3 className="text-lg font-semibold mb-4">
              How many players? ({MIN_PLAYER_COUNT}-{MAX_PLAYER_COUNT})
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {SIZES.map((num) => (
                <button
                  key={num}
                  onClick={() => handleNumPlayersSelect(num)}
                  className="py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
                >
                  {num} Players
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
                <label className="block text-sm font-medium mb-2">Player Name:</label>
                <input
                  type="text"
                  value={currentName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter player name"
                  maxLength={20}
                />
              </div>

              {/* La couleur est imposée par le rang de jeu. */}
              {currentColor && (
                <div>
                  <label className="block text-sm font-medium mb-2">Your color:</label>
                  <div
                    className="py-3 px-4 rounded-lg font-semibold text-center"
                    style={{
                      backgroundColor: BOARD_THEME.players[currentColor],
                      color: currentColor === "yellow" ? "#000" : "#fff",
                    }}
                  >
                    {COLOR_LABELS[currentColor]}
                  </div>
                </div>
              )}

              <button
                onClick={handleNextPlayer}
                disabled={!canProceed}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  canProceed
                    ? "bg-green-500 hover:bg-green-600 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {currentPlayerSetup < numPlayers - 1 ? "Next Player" : "Start Game"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlayerSetup;
