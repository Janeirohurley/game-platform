"use client";

import {
  forwardRef,
  useRef,
  useState,
  useImperativeHandle,
  useMemo,
} from "react";
import FlatMaterial from "./FlatMaterial";
import * as THREE from "three";
import type { ColorTheme, GamePiece, GameState } from "../../types/game";
import { themeFor } from "../../data/boardTheme";
import { getBaseCenter, getTrack } from "../../utils/positionUtils";
import { CLASSIC_BASE_HALF_SIZE, HEX_BOARD_RADIUS } from "../../data/track";
import BoardComponents from "./BoardComponents";
import DiceComponent from "../dice/DiceComponent";

// Simple working Ludo board with color themes
const LudoBoard = forwardRef<
  {
    throwDice: () => void;
    throwDiceWithValue: (value?: number) => void;
    isDiceAnimating: boolean;
  },
  {
    gameState: GameState;
    onPieceClick: (piece: GamePiece) => void;
    onDiceResult: (value: number) => void;
    onDiceClick?: () => void;
  }
>(function LudoBoard({ gameState, onPieceClick, onDiceResult, onDiceClick }, ref) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDiceAnimating, setIsDiceAnimating] = useState(false);
  const [diceRotation, setDiceRotation] = useState<[number, number, number]>([
    0, 0, 0,
  ]);
  // Removed unused velocity/target state kept internally in DiceComponent
  const [isDiceActive, setIsDiceActive] = useState(false); // True while a roll is in progress

  const boardShape = getTrack(gameState.playerCount).shape;
  const currentColors: ColorTheme = themeFor(boardShape);

  // Le dé se pose dans un espace LIBRE de la base du joueur dont c'est le
  // tour ; hors partie il reste au centre.
  //
  // Hors `playing`, `currentPlayerIndex` peut valoir 0 sans que personne ne
  // joue (salle d'attente en ligne, écran de configuration en local) : on
  // ne se fie donc PAS à l'index seul, on exige la phase de jeu. Une reprise
  // (dé 6, capture) garde le même joueur, donc la même cible : le dé ne
  // bouge pas.
  const diceTarget = useMemo<[number, number, number]>(() => {
    const activeColor =
      gameState.gamePhase === "playing"
        ? gameState.players[gameState.currentPlayerIndex]?.color
        : undefined;
    if (!activeColor) return [0, 1.2, 0];

    const center = getBaseCenter(gameState.playerCount, activeColor);
    const surfaceY = boardShape === "hex" ? 0.175 : 0.18;
    // Croix : le centre de la plaque imprime le nom, on décale le dé vers le
    // bord extérieur (bande libre entre les anneaux et le bord). Hexagone :
    // le centre du disque est libre (ni nom, ni trou), le dé s'y pose.
    const z =
      boardShape === "hex"
        ? center.z
        : center.z + CLASSIC_BASE_HALF_SIZE * 0.72;

    return [center.x, surfaceY, z];
  }, [
    gameState.gamePhase,
    gameState.currentPlayerIndex,
    gameState.players,
    gameState.playerCount,
    boardShape,
  ]);

  // Get the exact rotation to show a specific dice value
  const getDiceRotationForValue = (value: number): [number, number, number] => {
    switch (value) {
      case 1:
        return [Math.PI / 2, 0, 0]; // This rotation shows face 1 (confirmed by key 4)
      case 2:
        return [Math.PI, 0, 0]; // Try different rotation for face 2
      case 3:
        return [(3 * Math.PI) / 2, Math.PI / 2, 0]; // Try different rotation
      case 4:
        return [(3 * Math.PI) / 2, -Math.PI / 2, 0]; // Opposite of face 1
      case 5:
        return [0, 0, 0]; // This was showing for keys 1,5,6 - assign to 5
      case 6:
        return [-Math.PI / 2, 0, 0]; // This rotation shows face 6 (confirmed by key 3)
      default:
        return [0, 0, 0];
    }
  };

  // Dice stays on the board at all times and spins in place to reveal a value
  const throwDiceWithValue = (specificValue?: number) => {
    if (isDiceActive) {
      // Prevent multiple throws - blocked message is handled in main component
      return;
    }

    setIsDiceActive(true); // Mark dice as active for the whole roll
    setIsDiceAnimating(true); // Start spinning in place

    // Use specific value or generate random
    const newValue = specificValue || Math.floor(Math.random() * 6) + 1;

    // Spin in place for a bit, then settle on the exact value
    setTimeout(() => {
      setIsDiceAnimating(false);
      setDiceRotation(getDiceRotationForValue(newValue));

      console.log(`Dice showing exact value: ${newValue}`);

      // Notify parent of dice result
      onDiceResult(newValue);

      // Ready for the next throw right away - dice remains visible
      setIsDiceActive(false);
    }, 1500); // 1.5 seconds of spinning
  };

  // Legacy function for random throws
  const throwDice = () => throwDiceWithValue();

  // Expose dice functions to parent
  useImperativeHandle(ref, () => ({
    throwDice,
    throwDiceWithValue,
    isDiceAnimating: isDiceActive, // Use isDiceActive instead of isDiceAnimating
  }));

  const isHex = getTrack(gameState.playerCount).shape === "hex";

  return (
    <group>
      {/* Socle : carré pour l'original à quatre bras, hexagone pour les six
          secteurs. Deux pièces : un corps sombre un peu plus large (le bord
          et l'épaisseur visibles, donc un contour net en GÉOMÉTRIE — plus de
          lignes GL de 1 px qui scintillent) et une plaque supérieure de la
          couleur du plateau (blanc). */}
      <mesh
        ref={meshRef}
        position={[0, 0, 0]}
        // Un cylindre à 6 faces a un sommet vers +z (pointes en haut et en
        // bas) ; la maquette a les pointes à gauche et à droite, côtés plats
        // en haut et en bas : rotation de 30°.
        rotation={isHex ? [0, Math.PI / 6, 0] : [0, 0, 0]}
      >
        {isHex ? (
          <cylinderGeometry
            args={[HEX_BOARD_RADIUS + 0.06, HEX_BOARD_RADIUS + 0.06, 0.3, 6]}
          />
        ) : (
          <boxGeometry args={[12.6 + 0.08, 0.3, 12.6 + 0.08]} />
        )}
        <FlatMaterial color="#1d1d1d" />
      </mesh>
      <mesh
        position={[0, 0.1515, 0]}
        rotation={isHex ? [0, Math.PI / 6, 0] : [0, 0, 0]}
      >
        {isHex ? (
          <cylinderGeometry args={[HEX_BOARD_RADIUS, HEX_BOARD_RADIUS, 0.003, 6]} />
        ) : (
          <boxGeometry args={[12.6, 0.003, 12.6]} />
        )}
        <FlatMaterial color={currentColors.boardBase} />
      </mesh>

      {/* Board components */}
      <BoardComponents
        colors={currentColors}
        gameState={gameState}
        playerCount={gameState.playerCount}
        onPieceClick={onPieceClick}
      />

      {/* 3D Dice - always visible, spins in place when rolling and glides
          to the active player's base between turns. */}
      <DiceComponent
        position={diceTarget}
        rotation={diceRotation}
        isAnimating={isDiceAnimating}
        onClick={onDiceClick}
      />
    </group>
  );
});

export default LudoBoard;
