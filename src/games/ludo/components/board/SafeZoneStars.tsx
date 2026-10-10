"use client";

import { useMemo } from "react";
import FlatMaterial from "./FlatMaterial";
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
    // Pointe vers +y de la forme, qui devient -z (le HAUT de l'écran) une fois
    // la forme couchée sur le plateau. L'ancien départ à -PI/2 renversait
    // les étoiles, pointe vers le bas.
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
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
  const shape = new THREE.Shape(starPoints(outer, outer * (filled ? 0.4 : 0.42)));
  if (!filled) {
    // Trait fin : la maquette trace l'étoile en contour de 1.2 u pour un rayon
    // de 12 u, soit environ 10 % du rayon. Un évidement à 84 % (au lieu de
    // 82 % sur un pentagone) donne ce trait ; à 82 % l'étoile sortait en tache épaisse.
    shape.holes.push(
      new THREE.Path(starPoints(outer * 0.84, outer * 0.84 * 0.42)),
    );
  }
  return new THREE.ShapeGeometry(shape);
}

/**
 * Flèche SIMPLE (hampe + pointe) pointant vers +x, dans le plan horizontal.
 *
 * Reprise du polygone de la maquette 6 joueurs `-6,-14 6,-14 6,0 14,0 0,16
 * -14,0 -6,0` (hampe de 12 u, pointe de 28 u de large, longueur 30 u), à
 * l'échelle d'une case (46.7 u = 0.84). L'ancienne forme avait deux
 * empennages et se lisait comme une double flèche « ↔ ».
 */
const ARROW_UNIT = 0.84 / 46.7;
function arrowGeometry(): THREE.ShapeGeometry {
  // Maquette : l'axe est y (de -14 à 16). On le couche sur x et on recentre.
  const model: [number, number][] = [
    [-6, -14], [6, -14], [6, 0], [14, 0], [0, 16], [-14, 0], [-6, 0],
  ];
  const shape = new THREE.Shape(
    model.map(([mx, my]) => new THREE.Vector2((my - 1) * ARROW_UNIT, mx * ARROW_UNIT)),
  );
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

  const arrowGeo = useMemo(() => arrowGeometry(), []);

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
            <FlatMaterial
              color={marker.color}
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
              <FlatMaterial
                color={marker.color}
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