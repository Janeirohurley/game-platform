"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getTrack } from "../../utils/positionUtils";
import type { ColorTheme } from "../../types/game";

// Le centre du plateau, où les pions terminés se posent.
//
// Une pointe de triangle par siège, tournée vers son bras : avec quatre
// joueurs on retrouve l'étoile à quatre branches de l'ancien rendu.
//
// Plateau hexagonal (5 et 6 joueurs) : un secteur de 60° par bras, centré
// sur l'axe du bras, ce qui dessine un hexagone complet. À 5 joueurs le
// sixième secteur, celui du bras vide, reste gris.
function CenterArea({
  colors,
  playerCount,
}: {
  colors: ColorTheme;
  playerCount: number;
}) {
  const track = getTrack(playerCount);
  const radius = 1.5;
  const isHex = track.shape === "hex";

  // Une géométrie par pointe, mémorisée : THREE ne libère pas les
  // BufferGeometry qu'on lui donne, et en recréer un par rendu fuiterait
  // la mémoire GPU sur une table qui tourne longtemps.
  const geometries = useMemo(
    () =>
      track.seats.map(() => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(
            new Float32Array([0, 0, 0, radius, 0, 0, 0, 0, -radius]),
            3,
          ),
        );
        geometry.setAttribute(
          "normal",
          new THREE.BufferAttribute(
            new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]),
            3,
          ),
        );
        geometry.setIndex([0, 1, 2]);
        return geometry;
      }),
    [track],
  );

  useEffect(
    () => () => {
      geometries.forEach((geometry) => geometry.dispose());
    },
    [geometries],
  );

  const hexSectors = useMemo(() => {
    if (!isHex) return [];
    // Les 6 bras, occupés ou non, pointent à -90° + k * 60°.
    return Array.from({ length: 6 }, (_, arm) => {
      const centre = -Math.PI / 2 + (arm * Math.PI) / 3;
      const seat = track.seats.find((s) => s.seat === arm);
      const geometry = new THREE.BufferGeometry();
      const r = 1.3;
      const a = centre - Math.PI / 6;
      const b = centre + Math.PI / 6;
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array([
            0, 0, 0,
            r * Math.cos(a), 0, r * Math.sin(a),
            r * Math.cos(b), 0, r * Math.sin(b),
          ]),
          3,
        ),
      );
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3),
      );
      geometry.setIndex([0, 1, 2]);
      return { geometry, color: seat?.color ?? null, arm };
    });
  }, [isHex, track]);

  useEffect(
    () => () => {
      hexSectors.forEach((sector) => sector.geometry.dispose());
    },
    [hexSectors],
  );

  if (isHex) {
    return (
      <group>
        {hexSectors.map((sector) => (
          <mesh key={sector.arm} position={[0, 0.19, 0]}>
            <primitive object={sector.geometry} attach="geometry" />
            <meshStandardMaterial
              color={sector.color ? colors.players[sector.color] : "#BDBDBD"}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group scale={[1.4, 1, 1.4]}>
      {track.seats.map((seat, index) => (
        <group key={seat.color} rotation={[0, -seat.angle + Math.PI / 2, 0]}>
          <mesh position={[0, 0.19, 0]}>
            <primitive object={geometries[index]} attach="geometry" />
            <meshStandardMaterial
              color={colors.players[seat.color]}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default CenterArea;
