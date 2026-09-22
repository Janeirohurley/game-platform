"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { ColorTheme } from "../../types/game";

// Center finish area with 4 colored triangles
function CenterArea({ colors }: { colors: ColorTheme }) {
  // Create triangle geometries using BufferGeometry
  const triangleGeometries = useMemo(() => {
    // Yellow triangle (top-right quadrant)
    const yellowGeometry = new THREE.BufferGeometry();
    const yellowVertices = new Float32Array([
      0,
      0,
      0, // Center
      1.5,
      0,
      0, // Right
      0,
      0,
      -1.5, // Top
    ]);
    const yellowNormals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    yellowGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(yellowVertices, 3),
    );
    yellowGeometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(yellowNormals, 3),
    );
    yellowGeometry.setIndex([0, 1, 2]);

    // Green triangle (top-left quadrant)
    const greenGeometry = new THREE.BufferGeometry();
    const greenVertices = new Float32Array([
      0,
      0,
      0, // Center
      0,
      0,
      -1.5, // Top
      -1.5,
      0,
      0, // Left
    ]);
    const greenNormals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    greenGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(greenVertices, 3),
    );
    greenGeometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(greenNormals, 3),
    );
    greenGeometry.setIndex([0, 1, 2]);

    // Blue triangle (bottom-left quadrant)
    const blueGeometry = new THREE.BufferGeometry();
    const blueVertices = new Float32Array([
      0,
      0,
      0, // Center
      -1.5,
      0,
      0, // Left
      0,
      0,
      1.5, // Bottom
    ]);
    const blueNormals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    blueGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(blueVertices, 3),
    );
    blueGeometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(blueNormals, 3),
    );
    blueGeometry.setIndex([0, 1, 2]);

    // Red triangle (bottom-right quadrant)
    const redGeometry = new THREE.BufferGeometry();
    const redVertices = new Float32Array([
      0,
      0,
      0, // Center
      0,
      0,
      1.5, // Bottom
      1.5,
      0,
      0, // Right
    ]);
    const redNormals = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    redGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(redVertices, 3),
    );
    redGeometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(redNormals, 3),
    );
    redGeometry.setIndex([0, 1, 2]);

    return { yellowGeometry, greenGeometry, blueGeometry, redGeometry };
  }, []);

  return (
    <group rotation={[0, Math.PI / 4 + Math.PI / 2, 0]} scale={[1.4, 1, 1.4]}>
      {/* Yellow triangle (top-right quadrant) */}
      <mesh position={[0, 0.19, 0]}>
        <primitive object={triangleGeometries.yellowGeometry} />
        <meshStandardMaterial
          color={colors.players.yellow}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Green triangle (top-left quadrant) */}
      <mesh position={[0, 0.19, 0]}>
        <primitive object={triangleGeometries.greenGeometry} />
        <meshStandardMaterial
          color={colors.players.green}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Blue triangle (bottom-left quadrant) */}
      <mesh position={[0, 0.19, 0]}>
        <primitive object={triangleGeometries.blueGeometry} />
        <meshStandardMaterial
          color={colors.players.blue}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Red triangle (bottom-right quadrant) */}
      <mesh position={[0, 0.19, 0]}>
        <primitive object={triangleGeometries.redGeometry} />
        <meshStandardMaterial
          color={colors.players.red}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default CenterArea;
