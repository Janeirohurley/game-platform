"use client";

import { useMemo } from "react";
import FlatMaterial from "./FlatMaterial";
import { Text } from "@react-three/drei";
import { getTrack } from "../../utils/positionUtils";
import { HEX_STAR_FILL, STAR_LIGHT } from "../../data/boardTheme";
import { SafeZoneStars, type BoardMarker } from "./SafeZoneStars";
import type { LudoColor } from "../../data/track";

// Anneau de 52 cases (2 à 4 joueurs) ou de 78 cases (plateau hexagonal,
// 5 et 6 joueurs) + une colonne maison de 6 cases par bras.
//
// On parcourt `track.arms` et non `track.seats` : le plateau physique garde
// ses quatre bras même quand deux joueurs seulement jouent, et un bras vide se
// dessine en gris plutôt que de disparaître.
//
// Le rendu reprend les MESURES des deux maquettes 2D :
//  - classique : cases carrées de 33/36 du pas (0.77 pour un pas de 0.84),
//    joint gris du fond, départs pleins colorés, cases sûres noires, couloirs
//    maison gris à carré coloré en retrait.
//  - hexagonal : cases jointives (0.84 = le pas), contour #222, corridor
//    coloré numéroté de 1 à 6, entrée colorée à flèche, étoiles pleines sur
//    fond blanc.

/** Case de l'hexagone : les cellules de la maquette, jointives. */
const HEX_CELL = 0.84;
/**
 * Case classique : pleine largeur du pas. Le joint de la maquette (3/36 du
 * pas) n'est plus le fond sombre vu entre deux cases, mais le CONTOUR de
 * chaque case : le plateau est blanc, les cases blanches.
 */
const CLASSIC_CELL = 0.84;
/** Carré coloré d'un couloir classique : 25.8/33 de la case intérieure. */
const CLASSIC_INSET = 0.6;
const VACANT = "#8C8C94";

/**
 * Contours des cases, en GÉOMÉTRIE et non en lignes GL.
 *
 * `<Edges>` trace des lignes de 1 px quelle que soit la résolution : sur un
 * écran 4K elles deviennent invisibles, et en mouvement elles scintillent
 * (les « flux » que l'on voyait sur l'hexagone). Un contour fait de deux
 * boîtes empilées est dessiné comme n'importe quelle surface : net, lissé
 * par le multi-échantillonnage et stable.
 */
const HEX_BORDER = { color: "#222222", width: 0.02 };
const CLASSIC_BORDER = { color: "#454545", width: 0.035 };
/** Dessus de la boîte de contour. L'intérieur dépasse de 0.0025. */
const TILE_Y = 0.16;

function Tile({
  position,
  rotation = [0, 0, 0],
  size,
  color,
  border,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: number;
  color: string;
  border: { color: string; width: number };
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, TILE_Y, 0]}>
        <boxGeometry args={[size, 0.02, size]} />
        <FlatMaterial color={border.color} />
      </mesh>
      <mesh position={[0, TILE_Y + 0.0105, 0]}>
        <boxGeometry args={[size - 2 * border.width, 0.005, size - 2 * border.width]} />
        <FlatMaterial color={color} />
      </mesh>
    </group>
  );
}
/** Les numéros se posent au-dessus des cases du couloir (dessus à 0.175). */
const NUMBER_Y = 0.182;

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

/**
 * Rotation à donner à un texte posé à plat pour que son haut regarde vers
 * l'extérieur du plateau, dans l'axe du bras d'angle `armAngle`. C'est la
 * lecture de la maquette 6 joueurs : chaque numéro se lit droit lorsqu'on
 * regarde le plateau depuis le bord opposé, le long de la colonne.
 */
function corridorAngleOf(armAngle: number): number {
  return Math.atan2(-Math.cos(armAngle), -Math.sin(armAngle));
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
  const ringSize = isHex ? HEX_CELL : CLASSIC_CELL;

  const cells = useMemo(
    () =>
      track.ring.map((point, index) => {
        if (isHex) {
          // Repère local d'un bras : x traverse le bras, y s'éloigne du
          // centre. Le couloir est la colonne du milieu (y = 1..6), le bout
          // en est la case finale, l'entrée est la case 13*k (j = 8).
          const shifted = (index + 8) % track.ringLength;
          const arm = track.arms[Math.floor(shifted / 13)];
          const j = shifted % 13;
          return {
            point,
            arm,
            seat: arm?.seat ?? null,
            safe: track.isSafeCell(index),
            isTip: j === 6,
            isEntry: j === 8,
          };
        }
        const arm = track.arms.find((a) => a.offset === index) ?? null;
        return {
          point,
          arm,
          seat: arm?.seat ?? null,
          safe: track.isSafeCell(index),
          isTip: false,
          isEntry: !!arm,
        };
      }),
    [track, isHex],
  );

  // Marqueurs des cases sûres : étoiles (les deux plateaux) et flèche
  // d'entrée (hexagonal uniquement). Classique : étoile claire sur les
  // départs occupés, étoile blanche sur les cases noires. Hexagonal : seule
  // la case de l'entrée porte une flèche, les étoiles sont pleines.
  const markers = useMemo<readonly BoardMarker[]>(() => {
    const list: BoardMarker[] = [];
    for (const cell of cells) {
      if (isHex) {
        if (cell.isEntry) {
          if (cell.seat) {
            list.push({
              point: cell.point,
              kind: "arrow",
              color: "#111111",
              // La pièce poursuit vers le centre après son entrée : la
              // flèche pointe donc à l'opposé de la direction du bras.
              angle: Math.PI - (cell.arm?.angle ?? 0),
            });
          }
        } else if (cell.safe) {
          list.push({
            point: cell.point,
            kind: "star",
            color: cell.seat
              ? HEX_STAR_FILL[cell.seat.color]
              : VACANT,
            filled: true,
          });
        }
      } else if (cell.safe) {
        list.push({
          point: cell.point,
          kind: "star",
          color: cell.seat ? STAR_LIGHT[cell.seat.color as LudoColor] : "#FFFFFF",
          filled: false,
        });
      }
    }
    return list;
  }, [cells, isHex]);

  const rotationOf = (point: { x: number; z: number }): [number, number, number] =>
    isHex ? [0, -hexArmAngleOf(point), 0] : [0, 0, 0];

  return (
    <group>
      {cells.map(({ point, seat, safe, isEntry, isTip }, index) => {
        // Case d'entrée et bout de couloir (hexagonal) portent la couleur
        // du bras ; un bras vide reste gris. Les autres cases de l'hexagone
        // sont blanches. Classique : départ coloré, étoile neutre noire,
        // anneau clair.
        const color = (() => {
          if (!isHex) {
            if (seat) return colorOf(seat.color);
            if (safe) return neutralSafe;
            return trackTiles;
          }
          if ((isEntry || isTip) && seat) return colorOf(seat.color);
          return trackTiles;
        })();
        return (
          <Tile
            key={`ring-${index}`}
            position={[point.x, 0, point.z]}
            rotation={rotationOf(point)}
            size={ringSize}
            color={color}
            border={isHex ? HEX_BORDER : CLASSIC_BORDER}
          />
        );
      })}

      {/* Colonnes maison : 6 cases par bras, de la bordure vers le centre.
          Classique : la case de la grille reste grise, un CARRE coloré est
          posé en retrait (maquette : 78 % de la case, liseré 0.4). Hexagonal :
          le couloir est plein, numéroté visuellement par le bandeau
          ci-dessous. Un bras sans joueur reste gris. */}
      {track.arms.map((arm) =>
        arm.homeColumn.map((point, index) => {
          const color = isHex
            ? arm.seat
              ? colorOf(arm.seat.color)
              : trackTiles
            : arm.seat
              ? colorOf(arm.seat.color)
              : VACANT;
          if (isHex) {
            return (
              <Tile
                key={`home-${arm.offset}-${index}`}
                position={[point.x, 0, point.z]}
                rotation={rotationOf(point)}
                size={HEX_CELL}
                color={color}
                border={HEX_BORDER}
              />
            );
          }
          // Classique : case blanche à contour, carré coloré posé en retrait
          // (dessus à 0.1775, au-dessus de l'intérieur de la case à 0.1725).
          return (
            <group
              key={`home-${arm.offset}-${index}`}
              position={[point.x, 0, point.z]}
            >
              <Tile
                position={[0, 0, 0]}
                size={CLASSIC_CELL}
                color={trackTiles}
                border={CLASSIC_BORDER}
              />
              <mesh position={[0, TILE_Y + 0.016, 0]}>
                <boxGeometry args={[CLASSIC_INSET, 0.004, CLASSIC_INSET]} />
                <FlatMaterial color={color} />
              </mesh>
            </group>
          );
        }),
      )}

      {/* Numéros 1 à 6 du corridor hexagonal : le bout du bras porte le 1,
          la colonne maison poursuit vers le centre. Reposés sur le couloir
          et tournés avec le bras pour rester lisibles. */}
      {isHex
        ? track.arms.map((arm) => {
            // Un bras inoccupé n'a ni numéros ni jeu à montrer : son couloir
            // reste vierge.
            if (!arm.seat) return null;
            // Le bout du bras est la dernière case d'anneau du siège
            // (13k - 2, où k est le bras) : c'est elle qui porte le 1.
            const tipIndex = (arm.offset + track.ringLength - 2) % track.ringLength;
            const tip = track.ring[tipIndex];
            const corridor: { point: { x: number; z: number }; number: string }[] = [
              { point: tip, number: "1" },
              ...arm.homeColumn.slice(0, 5).map((point, i) => ({
                point,
                number: String(i + 2),
              })),
            ];
            return corridor.map(({ point, number }) => (
              <group
                key={`corridor-${arm.offset}-${number}`}
                position={[point.x, NUMBER_Y, point.z]}
                rotation={[0, corridorAngleOf(arm.angle), 0]}
              >
                <Text
                  position={[0, 0, 0]}
                  fontSize={0.34}
                  color="#FFFFFF"
                  anchorX="center"
                  anchorY="middle"
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  {number}
                </Text>
              </group>
            ));
          })
        : null}

      <SafeZoneStars markers={markers} />
    </group>
  );
}

export default PlayingTrack;
