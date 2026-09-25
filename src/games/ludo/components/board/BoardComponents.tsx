"use client";

import type { ColorTheme, GamePiece, GameState } from "../../types/game";
import HomeAreas from "./HomeAreas";
import PlayingTrack from "./PlayingTrack";
import CenterArea from "./CenterArea";
import GamePieces from "../pieces/GamePieces";

// All board components
function BoardComponents({
  colors,
  gameState,
  onPieceClick,
}: {
  colors: ColorTheme;
  gameState: GameState;
  onPieceClick: (piece: GamePiece) => void;
}) {
  return (
    <group>
      {/* Home areas */}
      <HomeAreas colors={colors} gameState={gameState} />

      {/* Playing track */}
      <PlayingTrack colors={colors} />

      {/* Center area */}
      <CenterArea colors={colors} />

      {/* Game pieces */}
      <GamePieces
        colors={colors}
        gameState={gameState}
        onPieceClick={onPieceClick}
      />
    </group>
  );
}

export default BoardComponents;
