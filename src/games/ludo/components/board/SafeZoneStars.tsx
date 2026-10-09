"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { BoardPoint } from "../../data/track";

// Marqueurs posés sur les cases sûres : étoile (classique : contour clair ou
// blanc sur case noire ; hexagonale : pleine et colorée sur case blanche) et
// flèche d'entrée (hexagonal). Ces glyphes sont des polygones THREE, pas des
// emojis : la maquette 2D les dessine comme des polygones à 5 branches, et
// un contour pixel n'aurait pas la même taille, la même couleur ni la même
// rotation que la référence.

export type BoardMarker =
  | { point: BoardPoint; kind: "star"; color: string; filled: boolean }
  | { point: BoardPoint; kind: "arrow"; color: string; angle: number };

/** Rayon extérieur commun aux étoiles, dans l'échelle du monde. */
const STAR_RADIUS = 0.27;

/**
 * Pointe les 10 sommets alternés (grand/creux) d'une étoile à 5 branches,
 * à partir du sommet du haut. Même alternance que les polygones de maquette.
 */
function starPoints(outer: number, inner: number): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle)));
  }
  return points;
}

/**
 * Géométrie d'une étoile. `filled` : disque plein (hexagonal, l'intérieur
 * creux est à 35 % du rayon). Sinon : anneau étoilé (classique, le trou colle
 * à 82 % du rayon pour se lire comme un trait).
 */
function starGeometry(outer: number, filled: boolean): THREE.ShapeGeometry {
  const shape = new THREE.Shape(starPoints(outer, outer * (filled ? 0.35 : 0.82)));
  if (!filled) {
    shape.holes.push(
      new THREE.Path(starPoints(outer * 0.82, outer * 0.82 * 0.35)),
    );
  }
  return new THREE.ShapeGeometry(shape);
}

/** Flèche pointant vers +x, dans le plan horizontal du plateau. */
function arrowGeometry(width: number): THREE.ShapeGeometry {
  const h = Math.min(width * 0.18, 0.11);
  const wing = width * 0.54;
  const shape = new THREE.Shape([
    // Pointe
    new THREE.Vector2(width * 0.5, 0),
    // Cran arrière droit
    new THREE.Vector2(h, h),
    new THREE.Vector2(h, wing),
    new THREE.Vector2(-h, wing),
    new THREE.Vector2(-h, h),
    // Empennage gauche
    new THREE.Vector2(-width * 0.5, 0),
    new THREE.Vector2(-h, -h),
    new THREE.Vector2(-h, -wing),
    new THREE.Vector2(h, -wing),
    new THREE.Vector2(h, -h),
  ]);
  return new THREE.ShapeGeometry(shape);
}

export function SafeZoneStars({ markers }: { markers: readonly BoardMarker[] }) {
  const starGeos = useMemo(() => {
    const cache = new Map<string, THREE.ShapeGeometry>();
    markers.forEach((marker) => {
      if (marker.kind !== "star") return;
      const key = marker.filled ? "filled" : "outline";
      if (!cache.has(key)) cache.set(key, starGeometry(STAR_RADIUS, marker.filled));
    });
    return cache;
  }, [markers]);

  const arrowGeo = useMemo(() => arrowGeometry(0.5), []);

  return (
    <group>
      {markers.map((marker, index) =>
        marker.kind === "star" ? (
          <mesh
            key={`star-${index}`}
            geometry={starGeos.get(marker.filled ? "filled" : "outline")}
            position={[marker.point.x, 0.175, marker.point.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <meshStandardMaterial
              color={marker.color}
              roughness={0.55}
              metalness={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        ) : (
          <group
            key={`arrow-${index}`}
            position={[marker.point.x, 0.175, marker.point.z]}
            rotation={[0, marker.angle, 0]}
          >
            <mesh geometry={arrowGeo} rotation={[-Math.PI / 2, 0, 0]}>
              <meshStandardMaterial
                color={marker.color}
                roughness={0.6}
                metalness={0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ),
      )}
    </group>
  );
}

export default SafeZoneStars;