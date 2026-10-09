"use client";

import { Text } from "@react-three/drei";
import { getTrack } from "../../utils/positionUtils";
import { BASE_FRAME, FALLBACK_NAME } from "../../data/boardTheme";
import {
  CLASSIC_BASE_HALF_SIZE,
  HEX_BASE_SLOT_SPAN,
} from "../../data/track";
import type { BoardPoint, LudoColor } from "../../data/track";
import type { ColorTheme, GameState } from "../../types/game";

// Une zone d'attente par BRAS du plateau.
//
// Les emplacements viennent du même `arm.base` que les pions (voir
// `positionUtils`) : une pièce atterrit donc EXACTEMENT dans l'emplacement
// dessiné. Il n'y a plus qu'une source de vérité pour la zone d'attente.
//
// Croix (2 à 4 joueurs) : la zone est une grande plaque grise, cadre coloré
// et quatre ANNEAUX, posée DANS LE COIN du plateau, alignée sur la grille —
// la maquette 4 joueurs. Hexagone (5 et 6 joueurs) : pas de coin libre pour
// une plaque carrée, la zone se pose donc entre deux bras et suit la
// maquette 6 joueurs en disque coloré percé de quatre trous blancs.

/** Rayon du disque d'une base hexagonale, sur la maquette 100/64 du trou. */
const HEX_PLATE_RADIUS = HEX_BASE_SLOT_SPAN * (100 / 64);
/** Rayon d'un trou de base hexagonale, sur la maquette 27/64 du trou. */
const HEX_HOLE_RADIUS = HEX_BASE_SLOT_SPAN * (27 / 64);

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

  // Teinte d'un bras vide : le plateau garde ses zones d'attente, mais une
  // zone sans joueur est grise — elle fait partie de l'imprimé, pas de la
  // partie.
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
        const frame = arm.seat ? BASE_FRAME[arm.seat.color] : vacantArm;
        const label = arm.seat ? getNameForColor(arm.seat.color) : "";

        // Repasse un emplacement du monde dans le repère local du groupe.
        const toLocal = (p: BoardPoint): { x: number; z: number } => {
          const dx = p.x - centroid.x;
          const dz = p.z - centroid.z;
          return { x: dx, z: dz };
        };

        return (
          <group key={arm.offset} position={[centroid.x, 0, centroid.z]}>
            {isHex ? (
              <>
                {/* Disque coloré entre deux bras, comme sur la maquette 6
                    joueurs : pas de nom, seulement les trous des pions. */}
                <mesh position={[0, 0.16, 0]}>
                  <cylinderGeometry args={[HEX_PLATE_RADIUS, HEX_PLATE_RADIUS, 0.02]} />
                  <meshStandardMaterial color={color} roughness={0.55} metalness={0} />
                </mesh>
                {arm.base.map((p, i) => {
                  const local = toLocal(p);
                  return (
                    <group key={i} position={[local.x, 0, local.z]}>
                      {/* Liséré sombre puis trou blanc. */}
                      <mesh position={[0, 0.176, 0]}>
                        <cylinderGeometry args={[HEX_HOLE_RADIUS * 1.18, HEX_HOLE_RADIUS * 1.18, 0.005]} />
                        <meshStandardMaterial color="#1b1b1b" roughness={0.6} metalness={0} />
                      </mesh>
                      <mesh position={[0, 0.179, 0]}>
                        <cylinderGeometry args={[HEX_HOLE_RADIUS, HEX_HOLE_RADIUS, 0.003]} />
                        <meshStandardMaterial color="#FFFFFF" roughness={0.3} metalness={0} />
                      </mesh>
                    </group>
                  );
                })}
              </>
            ) : (
              <>
                {/* Cadre coloré du coin, puis panneau gris : la base de la
                    maquette 4 joueurs. */}
                <mesh position={[0, 0.16, 0]}>
                  <boxGeometry args={[CLASSIC_BASE_HALF_SIZE * 2, 0.02, CLASSIC_BASE_HALF_SIZE * 2]} />
                  <meshStandardMaterial color={frame} roughness={0.55} metalness={0} />
                </mesh>
                <mesh position={[0, 0.164, 0]}>
                  <boxGeometry args={[1.95 * 2, 0.012, 1.95 * 2]} />
                  <meshStandardMaterial color="#c3c3c3" roughness={0.7} metalness={0} />
                </mesh>

                {/* ANNEAUX gris (#7b7b7b, r 13 u de maquette) aux emplacements
                    exacts de `arm.base`, le centre laissant voir le panneau. */}
                {arm.base.map((p, i) => {
                  const local = toLocal(p);
                  return (
                    <group key={i} position={[local.x, 0, local.z]}>
                      <mesh position={[0, 0.175, 0]}>
                        <cylinderGeometry args={[0.303, 0.303, 0.006]} />
                        <meshStandardMaterial color="#7b7b7b" roughness={0.6} metalness={0} />
                      </mesh>
                      <mesh position={[0, 0.178, 0]}>
                        <cylinderGeometry args={[0.257, 0.257, 0.004]} />
                        <meshStandardMaterial color="#c3c3c3" roughness={0.7} metalness={0} />
                      </mesh>
                    </group>
                  );
                })}

                {/* Nom du joueur, sombre au centre du panneau — la maquette
                    imprime aussi le nom sur les bases de la croix. */}
                {label ? (
                  <Text
                    position={[0, 0.19, 0]}
                    fontSize={Math.min(0.3, 2.8 / Math.max(label.length * 0.52, 1))}
                    color="#111111"
                    anchorX="center"
                    anchorY="middle"
                    rotation={[-Math.PI / 2, 0, 0]}
                  >
                    {label}
                  </Text>
                ) : null}
              </>
            )}
          </group>
        );
      })}
    </>
  );
}

export default HomeAreas;