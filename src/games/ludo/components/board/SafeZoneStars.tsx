"use client";

import { Text } from "@react-three/drei";
import type { BoardPoint } from "../../data/track";

// Marqueur d'étoile posé sur chaque case sûre neutre.
//
// Composant nommé exporté, importé par `PlayingTrack` : les étoiles
// découlent de la piste générée, elles ne sont plus listées à la main
// comme dans l'ancien plateau en croix (où elles ne pouvaient pas
// suivre un nombre de joueurs variable).
export function SafeZoneStars({ stars }: { stars: readonly BoardPoint[] }) {
  return (
    <>
      {stars.map((point, index) => (
        <Text
          key={`star-${index}`}
          position={[point.x, 0.18, point.z]}
          fontSize={0.5}
          color="#FFFFFF"
          anchorX="center"
          anchorY="middle"
          rotation={[-Math.PI / 2, 0, 0]}
        >
          ⭐
        </Text>
      ))}
    </>
  );
}

export default SafeZoneStars;
