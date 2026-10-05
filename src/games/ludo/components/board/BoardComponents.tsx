"use client";

import type { ColorTheme, GamePiece, GameState } from "../../types/game";
import HomeAreas from "./HomeAreas";
import PlayingTrack from "./PlayingTrack";
import CenterArea from "./CenterArea";
import GamePieces from "../pieces/GamePieces";

// Teinte des cases sûres neutres (les étoiles).
const NEUTRAL_SAFE = "#1a1a1a";

// Tous les composants du plateau.
//
// `playerCount` traverse toute la chaîne : c'est lui qui décide de la
// forme du plateau. Le nombre de joueurs vient de l'état de jeu en mode
// local et de `targetPlayers` en mode en ligne.
function BoardComponents({
  colors,
  gameState,
  playerCount,
  onPieceClick,
}: {
  colors: ColorTheme;
  gameState: GameState;
  playerCount: number;
  onPieceClick: (piece: GamePiece) => void;
}) {
  return (
    <group>
      <HomeAreas colors={colors} gameState={gameState} playerCount={playerCount} />

      <PlayingTrack
        playerCount={playerCount}
        trackTiles={colors.trackTiles}
        neutralSafe={NEUTRAL_SAFE}
        colorOf={(color) => colors.players[color as keyof typeof colors.players]}
      />

      <CenterArea colors={colors} playerCount={playerCount} />

      <GamePieces
        colors={colors}
        gameState={gameState}
        playerCount={playerCount}
        onPieceClick={onPieceClick}
      />
    </group>
  );
}

export default BoardComponents;
