"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { ColorTheme } from "../../types/game";
import { CENTER_TRIANGLE_RADIUS, COLOR_AXES } from "../../data/center";

/**
 * Zone d'arrivée : un diamant découpé en quatre triangles, un par couleur.
 * La géométrie (axes des triangles, rayon) vient de `data/center.ts`, la même
 * que celle qui éparpille les pièces arrivées — le dessin et le placement ne
 * peuvent pas diverger.
 */
function CenterArea({ colors }: { colors: ColorTheme }) {
  const triangleGeometries = useMemo(() => {
    const makeTriangle = (
      A: readonly [number, number],
      B: readonly [number, number],
    ) => {
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0,
        0,
        0,
        A[0] * CENTER_TRIANGLE_RADIUS,
        0,
        A[1] * CENTER_TRIANGLE_RADIUS,
        B[0] * CENTER_TRIANGLE_RADIUS,
        0,
        B[1] * CENTER_TRIANGLE_RADIUS,
      ]);
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(vertices, 3),
      );
      geometry.setAttribute(
        "normal",
        new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3),
      );
      geometry.setIndex([0, 1, 2]);
      return geometry;
    };

    return {
      yellow: makeTriangle(COLOR_AXES.yellow.A, COLOR_AXES.yellow.B),
      green: makeTriangle(COLOR_AXES.green.A, COLOR_AXES.green.B),
      blue: makeTriangle(COLOR_AXES.blue.A, COLOR_AXES.blue.B),
      red: makeTriangle(COLOR_AXES.red.A, COLOR_AXES.red.B),
    };
  }, []);

  return (
    <group>
      {(Object.keys(triangleGeometries) as Array<
        keyof typeof triangleGeometries
      >).map((color) => (
        <mesh key={color} position={[0, 0.19, 0]}>
          <primitive object={triangleGeometries[color]} />
          <meshStandardMaterial
            color={colors.players[color]}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

export default CenterArea;