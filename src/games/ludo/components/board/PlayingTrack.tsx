"use client";

import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import { getTrack } from "../../utils/positionUtils";
import { SafeZoneStars } from "./SafeZoneStars";

// Anneau de 52 cases (2 à 4 joueurs) ou de 78 cases (plateau hexagonal,
// 5 et 6 joueurs) + une colonne maison de 6 cases par bras.
//
// On parcourt `track.arms` et non `track.seats` : le plateau physique garde
// ses quatre bras même quand deux joueurs seulement jouent, et un bras vide se
// dessine en gris plutôt que de disparaître.
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
  // Le pas de la grille est 0.84, les deux plateaux compris : une tuile doit
  // donc être STRICTEMENT plus petite que ça. À 0.9 (l'ancienne valeur du
  // plateau classique) chaque tuile déborde de 0.06 sur sa voisine et
  // l'anneau se dessine comme un ruban plein, sans aucune ligne de
  // séparation. On garde 0.78 partout : 0.06 de joint, par lequel transparaît
  // le fond gris du socle, et la croix a le même rendu que l'étoile.
  const ringSize = 0.78;
  const homeSize = 0.78;
  // Contour imprimé de chaque case. Le joint laissé entre deux tuiles laisse
  // transparaître le gris du socle, mais à l'échelle de la caméra c'est un
  // filet de 0.06 qu'on perd facilement : le trait rend la grille lisible
  // d'office, comme les cases noires d'un plateau imprimé. Il est tiré du
  // noir bleuté du fond, donc il contraste sur toutes les couleurs de siège
  // (elles sont toutes claires) comme sur les cases neutres.
  const cellEdge = "#16202B";
  const cells = useMemo(
    () =>
      track.ring.map((point, index) => {
        // On cherche le BRAS, pas le siège : un bras vide possède quand même
        // sa case d'entrée, qui doit rester colorée comme une case d'entrée
        // et pas se déguiser en étoile.
        const arm = track.arms.find((a) => a.offset === index) ?? null;
        const seat = arm?.seat ?? null;
        // Une case sûre qui n'est le départ d'aucun bras est une étoile :
        // le serveur la protège aussi (voir `createTrack`), on la teinte donc
        // en neutre sombre pour la distinguer des cases d'entrée.
        const isStar = !arm && track.isSafeCell(index);
        return { point, arm, seat, isStar };
      }),
    [track],
  );

  const stars = useMemo(
    () => cells.filter((cell) => cell.isStar).map((cell) => cell.point),
    [cells],
  );

  return (
    <group>
      {cells.map(({ point, arm, seat, isStar }, index) => {
        // La case d'entrée est tournée vers son bras : le joueur repère
        // ainsi de quel côté sa sortie se fait, ce que la croix en dur
        // montrait par un alignement explicite. On tourne sur le BRAS et non
        // sur le siège, pour qu'un bras vide s'aligne aussi bien qu'un plein.
        // Plateau hexagonal : toutes les cases suivent l'axe de leur bras.
        const rotation: [number, number, number] = isHex
          ? [0, -hexArmAngleOf(point), 0]
          : arm
            ? [0, -arm.angle, 0]
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
            <Edges scale={1.001} color={cellEdge} threshold={15} lineWidth={1.5} />
          </mesh>
        );
      })}

      {/* Colonnes maison : 6 cases par bras, de la bordure vers le centre.
          Les quatre bras du plateau classique sont toujours dessinés — un
          bras sans joueur garde sa colonne en gris, comme la colonne
          d'un plateau imprimé que personne n'utilise. */}
      {track.arms.map((arm) =>
        arm.homeColumn.map((point, index) => (
          <mesh
            key={`home-${arm.offset}-${index}`}
            position={[point.x, 0.17, point.z]}
            rotation={isHex ? [0, -arm.angle, 0] : [0, 0, 0]}
          >
            <boxGeometry args={[homeSize, 0.02, homeSize]} />
            <meshStandardMaterial
              color={arm.seat ? colorOf(arm.seat.color) : neutralSafe}
            />
            <Edges scale={1.001} color={cellEdge} threshold={15} lineWidth={1.5} />
          </mesh>
        )),
      )}

      <SafeZoneStars stars={stars} />
    </group>
  );
}

export default PlayingTrack;