"use client";

import { Text } from "@react-three/drei";
import { getTrack } from "../../utils/positionUtils";
import { FALLBACK_NAME } from "../../data/boardTheme";
import type { ColorTheme, GameState, LudoColor } from "../../types/game";

// Une zone d'attente par siège, posée derrière le bras du joueur.
//
// Les positions viennent de la piste générée : elles suivent donc
// l'orientation de chaque bras, ce qui permet d'avoir 2 à 6 zones sans
// coordonnées écrites en dur.
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

  const getNameForColor = (color: LudoColor): string => {
    const player = gameState.players.find((p) => p.color === color);
    if (player?.name) return player.name;
    // Pendant la configuration, ou si un siège n'a pas encore de joueur.
    return FALLBACK_NAME[color];
  };

  return (
    <>
      {track.seats.map((seat) => {
        const first = seat.base[0];
        const last = seat.base[seat.base.length - 1];
        const cx = (first.x + last.x) / 2;
        const cz = (first.z + last.z) / 2;
        const color = colors.players[seat.color];

        // Le groupe est tourné sur l'axe du bras pour que le libellé reste
        // lisible depuis l'extérieur et que les emplacements des pièces
        // soient posés dans un repère local aligné.
        return (
          <group key={seat.color} position={[cx, 0, cz]} rotation={[0, -seat.angle, 0]}>
            <mesh position={[0, 0.16, 0]}>
              <boxGeometry args={[2.6, 0.02, 2.6]} />
              <meshStandardMaterial
                color={color}
                roughness={0.1}
                metalness={0}
                transparent
                opacity={0.9}
              />
            </mesh>

            <mesh position={[0, 0.17, 0]}>
              <boxGeometry args={[2, 0.01, 2]} />
              <meshStandardMaterial color="#FAFAFA" roughness={0.05} metalness={0} />
            </mesh>

            {/* Emplacements des 4 pièces, dans le repère local du bras. */}
            {[-0.55, 0.55].map((lat) =>
              [0.5, -0.5].map((along) => (
                <group key={`${lat}-${along}`} position={[lat, 0, along]}>
                  <mesh position={[0, 0.175, 0]}>
                    <cylinderGeometry args={[0.32, 0.32, 0.005]} />
                    <meshStandardMaterial color="#A0A0A0" roughness={0.1} metalness={0} />
                  </mesh>
                  <mesh position={[0, 0.177, 0]}>
                    <cylinderGeometry args={[0.24, 0.24, 0.002]} />
                    <meshStandardMaterial color="#FFFFFF" roughness={0} metalness={0} />
                  </mesh>
                </group>
              )),
            )}

            <Text
              position={[0, 0.19, 0.95]}
              fontSize={0.34}
              color="#000000"
              anchorX="center"
              anchorY="middle"
              rotation={[-Math.PI / 2, 0, 0]}
            >
              {getNameForColor(seat.color)}
            </Text>
          </group>
        );
      })}
    </>
  );
}

export default HomeAreas;
