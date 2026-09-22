"use client";

import { Text } from "@react-three/drei";
import type { ColorTheme, GameState } from "../../types/game";

// Modern minimalist home areas
function HomeAreas({
  colors,
  gameState,
}: {
  colors: ColorTheme;
  gameState: GameState;
}) {
  const getNameForColor = (color: "yellow" | "green" | "blue" | "red") => {
    const player = gameState.players.find((p) => p.color === color);
    if (player?.name) return player.name;
    // Fallbacks during setup or if not selected yet
    switch (color) {
      case "yellow":
        return "Yellow";
      case "green":
        return "Green";
      case "blue":
        return "Blue";
      case "red":
        return "Red";
    }
  };

  const homes = [
    {
      color: colors.players.yellow,
      x: -4.5,
      z: -4.5,
      name: getNameForColor("yellow"),
    }, // Yellow
    {
      color: colors.players.green,
      x: -4.5,
      z: 4.5,
      name: getNameForColor("green"),
    }, // Green
    {
      color: colors.players.blue,
      x: 4.5,
      z: 4.5,
      name: getNameForColor("blue"),
    }, // Blue
    {
      color: colors.players.red,
      x: 4.5,
      z: -4.5,
      name: getNameForColor("red"),
    }, // Red
  ];

  return (
    <>
      {homes.map((home, index) => (
        <group key={index}>
          {/* Modern flat base with subtle gradient */}
          <mesh position={[home.x, 0.16, home.z]}>
            <boxGeometry args={[6, 0.02, 6]} />
            <meshStandardMaterial
              color={home.color}
              roughness={0.1}
              metalness={0.0}
              transparent
              opacity={0.9}
            />
          </mesh>

          {/* Clean white center area */}
          <mesh position={[home.x, 0.17, home.z]}>
            <boxGeometry args={[4.5, 0.01, 4.5]} />
            <meshStandardMaterial
              color="#FAFAFA"
              roughness={0.05}
              metalness={0.0}
            />
          </mesh>

          {/* Modern circular slots */}
          {[
            [-1.1, -1.1],
            [1.1, -1.1],
            [1.1, 1.1],
            [-1.1, 1.1],
          ].map((offset, i) => (
            <group key={i}>
              {/* Slot base */}
              <mesh position={[home.x + offset[0], 0.175, home.z + offset[1]]}>
                <cylinderGeometry args={[0.4, 0.4, 0.005]} />
                <meshStandardMaterial
                  color="#A0A0A0"
                  roughness={0.1}
                  metalness={0.0}
                />
              </mesh>

              {/* Inner circle for contrast */}
              <mesh position={[home.x + offset[0], 0.177, home.z + offset[1]]}>
                <cylinderGeometry args={[0.3, 0.3, 0.002]} />
                <meshStandardMaterial
                  color="#FFFFFF"
                  roughness={0.0}
                  metalness={0.0}
                />
              </mesh>
            </group>
          ))}

          {/* Modern typography label */}
          <Text
            position={[home.x, 0.19, home.z]}
            fontSize={0.4}
            color="#000000"
            anchorX="center"
            anchorY="middle"
            rotation={[-Math.PI / 2, 0, 0]}
          >
            {home.name}
          </Text>
        </group>
      ))}
    </>
  );
}

export default HomeAreas;
