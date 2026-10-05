"use client";

import { useMemo } from "react";
import { getTrack } from "../../utils/positionUtils";
import { SafeZoneStars } from "./SafeZoneStars";

// Anneau de 52 cases (2 à 4 joueurs) ou de 78 cases (plateau hexagonal,
// 5 et 6 joueurs) + une colonne maison de 6 cases par bras, le tout
// généré depuis `playerCount` (voir `data/track.ts`).
//
// Avant, la piste était écrite en dur pour quatre joueurs sous forme de
// croix ; à six joueurs il n'y avait tout simplement pas la place pour
// deux colonnes maison de plus. La géométrie vient maintenant du même
// modèle que le serveur, donc le plateau ne peut plus mentir sur le
// nombre de cases.
const SIXTY_DEG = Math.PI / 3;

/**
 * Orientation d'une case de l'anneau hexagonal : celle du bras qui la porte.
 *
 * Les cases d'un bras sont alignées sur son axe ; on retrouve le bras en
 * arrondissant la direction de la case au multiple de 60° le plus proche
 * (les bras pointent à -90° + k * 60°). Une case d'angle est à 20° de son
 * axe et à 40° de l'axe voisin, donc l'arrondi ne se trompe jamais.
 */
function hexArmAngleOf(point: { x: number; z: number }): number {
  const base = -Math.PI / 2;
  const direction = Math.atan2(point.z, point.x);
  return base + Math.round((direction - base) / SIXTY_DEG) * SIXTY_DEG;
}

function PlayingTrack({
  playerCount,
  trackTiles,
  neutralSafe,
  colorOf,
}: {
  playerCount: number;
  /** Teinte des cases ordinaires de l'anneau. */
  trackTiles: string;
  /** Teinte des cases sûres neutres (les étoiles). */
  neutralSafe: string;
  /** Couleur d'un siège, injectée pour que ce composant ignore le thème. */
  colorOf: (color: string) => string;
}) {
  const track = getTrack(playerCount);
  const isHex = track.shape === "hex";
  // Sur le plateau hexagonal les cases sont tournées : un côté de 0.9
  // ferait se chevaucher les coins de deux bras voisins (scintillement
  // entre deux couleurs), on les réduit donc un peu.
  const ringSize = isHex ? 0.78 : 0.9;
  const homeSize = isHex ? 0.78 : 0.8;

  // Une case d'anneau est à 0.845 de pas : on garde 0.9 de côté, comme
  // l'ancien rendu, pour que le joint entre deux cases reste visible.
  const cells = useMemo(
    () =>
      track.ring.map((point, index) => {
        const seat = track.seats.find((s) => s.offset === index);
        // Une case sûre qui n'appartient à aucun siège est une étoile :
        // le serveur la protège aussi (voir `createTrack`), on la teinte
        // donc en neutre sombre pour la distinguer des cases d'entrée.
        const isStar = !seat && track.isSafeCell(index);
        return { point, seat, isStar };
      }),
    [track],
  );

  const stars = useMemo(
    () => cells.filter((cell) => cell.isStar).map((cell) => cell.point),
    [cells],
  );

  return (
    <group>
      {cells.map(({ point, seat, isStar }, index) => {
        // La case d'entrée est tournée vers son bras : le joueur repère
        // ainsi de quel côté sa sortie se fait, ce que la croix en dur
        // montrait par un alignement explicite.
        // Plateau hexagonal : toutes les cases suivent l'axe de leur bras.
        const rotation: [number, number, number] = isHex
          ? [0, -hexArmAngleOf(point), 0]
          : seat
            ? [0, -seat.angle, 0]
            : [0, 0, 0];
        const color = seat
          ? colorOf(seat.color)
          : isStar
            ? neutralSafe
            : trackTiles;

        return (
          <mesh key={`ring-${index}`} position={[point.x, 0.16, point.z]} rotation={rotation}>
            <boxGeometry args={[ringSize, 0.02, ringSize]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}

      {/* Colonnes maison : 6 cases par bras, de la bordure vers le centre. */}
      {track.seats.map((seat) =>
        seat.homeColumn.map((point, index) => (
          <mesh
            key={`home-${seat.color}-${index}`}
            position={[point.x, 0.17, point.z]}
            rotation={isHex ? [0, -seat.angle, 0] : [0, 0, 0]}
          >
            <boxGeometry args={[homeSize, 0.02, homeSize]} />
            <meshStandardMaterial color={colorOf(seat.color)} />
          </mesh>
        )),
      )}

      <SafeZoneStars stars={stars} />
    </group>
  );
}

export default PlayingTrack;
