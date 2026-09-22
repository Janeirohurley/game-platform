"use client";

import { forwardRef, useRef, useState, useImperativeHandle } from "react";
import * as THREE from "three";
import type { ColorTheme, GamePiece, GameState } from "../../types/game";
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
  const [currentTheme, setCurrentTheme] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [isDiceAnimating, setIsDiceAnimating] = useState(false);
  const [dicePosition] = useState<[number, number, number]>([
    0, 1.2, 0,
  ]); // Center position - dice stays here at all times
  const [diceRotation, setDiceRotation] = useState<[number, number, number]>([
    0, 0, 0,
  ]);
  // Removed unused velocity/target state kept internally in DiceComponent
  const [isDiceActive, setIsDiceActive] = useState(false); // True while a roll is in progress

  // Color themes for the board
  const colorThemes: ColorTheme[] = [
    // {
    //   name: 'Dark',
    //   boardBase: '#2F2F2F',
    //   trackTiles: '#404040',
    //   players: {
    //     yellow: '#DAA520',
    //     green: '#228B22',
    //     blue: '#4169E1',
    //     red: '#DC143C'
    //   }
    // },
    // {
    //   name: 'Classic',
    //   boardBase: '#F0F000',
    //   trackTiles: '#FFFFFF',
    //   players: {
    //     yellow: '#FFD700',
    //     green: '#00CED1',
    //     blue: '#1E90FF',
    //     red: '#FF6347'
    //   }
    // },
    {
      name: "Ocean",
      boardBase: "#737373",
      trackTiles: "#E0FFFF",
      players: {
        yellow: "#FFD700",
        green: "#00CED1",
        blue: "#1E90FF",
        red: "#FF6347",
      },
    },
  ];

  const currentColors: ColorTheme = colorThemes[currentTheme];

  const handleClick = () => {
    setCurrentTheme((prev) => (prev + 1) % colorThemes.length);
  };

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
    setDiceValue(newValue);

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

  return (
    <group>
      {/* Board base */}
      <mesh ref={meshRef} position={[0, 0, 0]} onClick={handleClick}>
        <boxGeometry args={[15, 0.3, 15]} />
        <meshStandardMaterial color={currentColors.boardBase} />
      </mesh>

      {/* Board components */}
      <BoardComponents
        colors={currentColors}
        gameState={gameState}
        onPieceClick={onPieceClick}
      />

      {/* 3D Dice - always visible on the board, spins in place when rolling */}
      <DiceComponent
        position={dicePosition}
        rotation={diceRotation}
        isAnimating={isDiceAnimating}
        onClick={onDiceClick}
      />
    </group>
  );
});

export default LudoBoard;
