"use client";

import type { ColorTheme } from "../../types/game";
import SafeZoneStars from "./SafeZoneStars";

// Cross-shaped playing track with safe zones
function PlayingTrack({ colors }: { colors: ColorTheme }) {
  const squares = [];

  // Safe zone positions with dynamic colors
  const safeZones = [
    // Entry safe zones (player colors)
    { x: -6, z: -1, color: colors.players.yellow }, // Yellow entry area
    { x: 6, z: 1, color: colors.players.blue }, // Blue entry area
    { x: 1, z: -6, color: colors.players.red }, // Red entry area
    { x: -1, z: 6, color: colors.players.green }, // Green entry area

    // Corner safe zones (neutral dark)
    { x: 1, z: 5, color: "#1a1a1a" }, // Neutral
    { x: -1, z: -5, color: "#1a1a1a" }, // Neutral
    { x: -5, z: 1, color: "#1a1a1a" }, // Neutral
    { x: 5, z: -1, color: "#1a1a1a" }, // Neutral
  ];

  // Get safe zone color for position
  const getSafeZoneColor = (x: number, z: number) => {
    const safeZone = safeZones.find((safe) => safe.x === x && safe.z === z);
    return safeZone ? safeZone.color : colors.trackTiles;
  };

  // Note: safe-zone boolean helper removed as unused

  // Horizontal track
  for (let x = -7; x <= 7; x++) {
    for (let z = -1; z <= 1; z++) {
      const color = getSafeZoneColor(x, z);
      squares.push(
        <mesh key={`h-${x}-${z}`} position={[x, 0.16, z]}>
          <boxGeometry args={[0.9, 0.02, 0.9]} />
          <meshStandardMaterial color={color} />
        </mesh>,
      );
    }
  }

  // Vertical track
  for (let z = -7; z <= 7; z++) {
    for (let x = -1; x <= 1; x++) {
      if (Math.abs(z) > 1 || Math.abs(x) > 1) {
        const color = getSafeZoneColor(x, z);
        squares.push(
          <mesh key={`v-${x}-${z}`} position={[x, 0.16, z]}>
            <boxGeometry args={[0.9, 0.02, 0.9]} />
            <meshStandardMaterial color={color} />
          </mesh>,
        );
      }
    }
  }

  // Home run paths
  const homeRuns = [
    {
      color: colors.players.yellow,
      positions: [
        [-6, 0.17, 0],
        [-5, 0.17, 0],
        [-4, 0.17, 0],
        [-3, 0.17, 0],
        [-2, 0.17, 0],
      ],
    },
    {
      color: colors.players.green,
      positions: [
        [0, 0.17, 6],
        [0, 0.17, 5],
        [0, 0.17, 4],
        [0, 0.17, 3],
        [0, 0.17, 2],
      ],
    },
    {
      color: colors.players.blue,
      positions: [
        [6, 0.17, 0],
        [5, 0.17, 0],
        [4, 0.17, 0],
        [3, 0.17, 0],
        [2, 0.17, 0],
      ],
    },
    {
      color: colors.players.red,
      positions: [
        [0, 0.17, -6],
        [0, 0.17, -5],
        [0, 0.17, -4],
        [0, 0.17, -3],
        [0, 0.17, -2],
      ],
    },
  ];

  homeRuns.forEach((run, runIndex) => {
    run.positions.forEach((pos, posIndex) => {
      squares.push(
        <mesh
          key={`run-${runIndex}-${posIndex}`}
          position={pos as [number, number, number]}
        >
          <boxGeometry args={[0.8, 0.02, 0.8]} />
          <meshStandardMaterial color={run.color} />
        </mesh>,
      );
    });
  });

  return (
    <>
      {squares}
      {/* Star markers for safe zones */}
      <SafeZoneStars safeZones={safeZones} />
    </>
  );
}

export default PlayingTrack;
