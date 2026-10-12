"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

import FlatMaterial from "./FlatMaterial";

// Indicateur de progression d'une base : une barre à plat, fond neutre et
// remplissage à la couleur du joueur, posée dans une zone LIBRE de la base.
//
// Il n'y a que deux formes de base et chacune a sa zone libre :
//   - croix : la base est un grand carré ; le nom occupe le centre et les
//     quatre anneaux sont sur les diagonales. Le seul espace franc est la
//     bande du bord extérieur (/ +z), entre le nom et le bord de la plaque.
//   - hexagone : la plaque est un disque coloré percé de quatre trous à mi-
//     rayon ; le centre (rayon libre ~0,56) ne porte ni nom ni trou, on y
//     pose la barre et le pourcentage juste au-dessus.
//
// Toutes les pièces sont des aplats (`FlatMaterial`), sans arête ni ligne
// GL ; les mesures sont posées pour rester dans le motif libre de chaque
// forme et ne recouvrir ni les anneaux, ni les emplacements, ni le nom.

/** Durée d'un balayage complet 0 → 100 % (les changements partiels sont plus courts). */
const SWEEP_SECONDS = 0.4;

type Shape = "classic" | "hex";

interface IndicatorLayout {
  /** Décalage local de la barre le long de +z. */
  barZ: number;
  /** Largeur totale de la barre. */
  width: number;
  /** Profondeur (axe z) de la barre. */
  depth: number;
  /** Hauteur de la barre au-dessus de la plaque. */
  y: number;
  /** Décalage local du pourcentage. */
  textZ: number;
  /** Taille de police du pourcentage. */
  textSize: number;
}

const LAYOUT: Record<Shape, IndicatorLayout> = {
  // Bande extérieure de la plaque carrée : à 1,85 du centre, entre les
  // anneaux (≤ 1,28) et le bord (2,52). Largeur 3, limitée par la plaque
  // (3,9 de côté intérieur) : elle ne mord pas sur les anneaux.
  classic: {
    barZ: 1.85,
    width: 3,
    depth: 0.3,
    y: 0.185,
    textZ: 2.2,
    textSize: 0.24,
  },
  // Centre libre du disque : la barre tient dans le rayon libre (~0,56),
  // le pourcentage se pose juste au-dessus, encore dans ce rayon.
  hex: {
    barZ: -0.15,
    width: 0.94,
    depth: 0.18,
    y: 0.181,
    textZ: 0.16,
    textSize: 0.19,
  },
};

function BaseProgressIndicator({
  ratio,
  color,
  shape,
}: {
  ratio: number;
  color: string;
  shape: Shape;
}) {
  const fillRef = useRef<THREE.Mesh>(null);
  const current = useRef(Math.min(Math.max(ratio, 0), 1));
  const reduceMotion = useRef<boolean | null>(null);
  const layout = LAYOUT[shape];

  useFrame((_, delta) => {
    const mesh = fillRef.current;
    if (!mesh) return;

    if (reduceMotion.current === null) {
      reduceMotion.current =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    const target = Math.min(Math.max(ratio, 0), 1);
    if (reduceMotion.current) {
      current.current = target;
    } else {
      const step = delta / SWEEP_SECONDS;
      const gap = target - current.current;
      if (Math.abs(gap) <= step) {
        current.current = target;
      } else {
        current.current += Math.sign(gap) * step;
      }
    }

    const value = Math.max(current.current, 0.0001);
    mesh.scale.x = value;
    mesh.position.x = -(layout.width / 2) * (1 - current.current);
  });

  return (
    <group position={[0, layout.y, layout.barZ]}>
      {/* Contour sombre (géométrie, pas d'arête) puis fond neutre : la barre
          se détache aussi bien sur la plaque grise que sur le disque coloré. */}
      <mesh position={[0, -0.003, 0]}>
        <boxGeometry args={[layout.width + 0.06, 0.006, layout.depth + 0.06]} />
        <FlatMaterial color="#4a4a4f" />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[layout.width, 0.006, layout.depth]} />
        <FlatMaterial color="#e7e7ea" />
      </mesh>
      {/* Remplissage couleur joueur, ancré à gauche : on ne change que son
          échelle et son décalage en x, jamais la géométrie. */}
      <mesh ref={fillRef} position={[0, 0.003, 0]}>
        <boxGeometry args={[layout.width, 0.006, layout.depth]} />
        <FlatMaterial color={color} />
      </mesh>
    </group>
  );
}

/**
 * Le pourcentage lui-même, séparé de la barre animée : il se pose sur le
 * fond (neutre, non animé) et n'a donc que faire de l'échelle du
 * remplissage. Il lit la valeur cible, pas la valeur animée, pour rester
 * exact même quand la barre est encore en train de glisser.
 */
function ProgressLabel({
  ratio,
  shape,
}: {
  ratio: number;
  shape: Shape;
}) {
  const layout = LAYOUT[shape];
  const percent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
  return (
    <Text
      position={[0, layout.y + 0.006, layout.textZ]}
      fontSize={layout.textSize}
      color="#ffffff"
      outlineWidth={0.006}
      outlineColor="#111111"
      anchorX="center"
      anchorY="middle"
      rotation={[-Math.PI / 2, 0, 0]}
    >
      {`${percent} %`}
    </Text>
  );
}

export { ProgressLabel };
export default BaseProgressIndicator;
