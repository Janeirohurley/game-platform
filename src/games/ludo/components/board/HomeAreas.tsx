"use client";

import { Text } from "@react-three/drei";
import { getTrack } from "../../utils/positionUtils";
import { FALLBACK_NAME } from "../../data/boardTheme";
import {
  BASE_HALF_SIZE,
  CLASSIC_BASE_HALF_SIZE,
} from "../../data/track";
import type { BoardPoint } from "../../data/track";
import type { ColorTheme, GameState, LudoColor } from "../../types/game";

// Une zone d'attente par BRAS du plateau.
//
// Les emplacements viennent du même `arm.base` que les pions (voir
// `positionUtils`) : une pièce atterrit donc EXACTEMENT dans l'emplacement
// dessiné. Il n'y a plus qu'une source de vérité pour la zone d'attente.
//
// Croix (2 à 4 joueurs) : la zone est une grande plaque posée DANS LE COIN
// du plateau, alignée sur la grille — l'ancien rendu d'origine. Hexagone
// (5 et 6 joueurs) : il n'y a pas de coin libre pour y loger une plaque,
// un pod se pose donc derrière son bras, orienté sur l'axe de celui-ci.
function HomeAreas({
  colors,
  gameState,
  playerCount,
}: {
  colors: ColorTheme;
  gameState: GameState;
  playerCount: number;
}) {
  const track = getTrack(playerCount);
  const isHex = track.shape === "hex";

  const getNameForColor = (color: LudoColor): string => {
    const player = gameState.players.find((p) => p.color === color);
    if (player?.name) return player.name;
    // Pendant la configuration, ou si un siège n'a pas encore de joueur.
    return FALLBACK_NAME[color];
  };

  // Teinte d'un bras vide : le plateau garde ses quatre zones d'attente,
  // mais une zone sans joueur est grise — elle fait partie de l'imprimé, pas
  // de la partie. On reprend le gris des emplacements de pièces pour que la
  // zone vide et ses emplacements se lisent comme un seul ensemble neutre.
  const vacantArm = "#8C8C94";

  return (
    <>
      {/* `track.arms` et non `track.seats` : à deux ou trois joueurs, les
          bras inoccupés gardent leur zone d'attente sur la croix. */}
      {track.arms.map((arm) => {
        const centroid = arm.base.reduce(
          (acc, p) => ({
            x: acc.x + p.x / arm.base.length,
            z: acc.z + p.z / arm.base.length,
          }),
          { x: 0, z: 0 },
        );
        const color = arm.seat ? colors.players[arm.seat.color] : vacantArm;
        // Un bras vide n'affiche aucun nom de joueur : la zone reste muette.
        const label = arm.seat ? getNameForColor(arm.seat.color) : "";

        // Toutes les plaques gardent le même style carré que l'original,
        // quelle que soit la forme du plateau. Leur centre est déjà placé
        // dans le secteur entre deux bras par `track.ts`.
        const half = isHex ? BASE_HALF_SIZE : CLASSIC_BASE_HALF_SIZE;
        const innerHalf = isHex ? 1.6 : 1.98;

        // Repasse un emplacement du monde dans le repère local du groupe.
        // Axe local +x = vers l'extérieur du plateau (le long du bras sur
        // l'hexagone), +z = perpendiculaire.
        const toLocal = (p: BoardPoint): { x: number; z: number } => {
          const dx = p.x - centroid.x;
          const dz = p.z - centroid.z;
          return { x: dx, z: dz };
        };

        const labelPosition: [number, number, number] = [0, 0.19, 0];
        const labelFontSize = Math.min(
          0.3,
          2.8 / Math.max(label.length * 0.52, 1),
        );

        return (
          <group
            key={arm.offset}
            position={[centroid.x, 0, centroid.z]}
          >
            <mesh position={[0, 0.16, 0]}>
              <boxGeometry args={[half * 2, 0.02, half * 2]} />
              <meshStandardMaterial
                color={color}
                roughness={0.55}
                metalness={0}
              />
            </mesh>

            <mesh position={[0, 0.17, 0]}>
              <boxGeometry args={[innerHalf * 2, 0.01, innerHalf * 2]} />
              <meshStandardMaterial color="#BDBDBD" roughness={0.7} metalness={0} />
            </mesh>

            {/* Emplacements des 4 pièces, aux coordonnées exactes de
                `arm.base`. */}
            {arm.base.map((p, i) => {
              const local = toLocal(p);
              return (
                <group key={i} position={[local.x, 0, local.z]}>
                  <mesh position={[0, 0.18, 0]}>
                    <cylinderGeometry args={[0.32, 0.32, 0.005]} />
                    <meshStandardMaterial color="#69757A" roughness={0.65} metalness={0} />
                  </mesh>
                  <mesh position={[0, 0.183, 0]}>
                    <cylinderGeometry args={[0.24, 0.24, 0.002]} />
                    <meshStandardMaterial color="#D6DDDE" roughness={0.45} metalness={0} />
                  </mesh>
                </group>
              );
            })}

            {/* Un bras vide n'a pas de joueur : pas de libellé non plus. */}
            {label ? (
              <Text
                position={labelPosition}
                fontSize={labelFontSize}
                color="#000000"
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
              >
                {label}
              </Text>
            ) : null}
          </group>
        );
      })}
    </>
  );
}

export default HomeAreas;
