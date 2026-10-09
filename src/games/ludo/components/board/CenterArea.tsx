"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getTrack } from "../../utils/positionUtils";
import { centerColorFor } from "../../data/boardTheme";

// Le centre du plateau, subdivisé sous forme de X : un triangle par bras,
// tous réunis au centre, la base de chacun tournée vers SA colonne maison.
// Le X occupe TOUT l'espace du milieu : chaque base est posée à l'endroit
// exact où commencent les colonnes, donc le grand carré cerné par les bras
// est entièrement recouvert, sans liseré neutre entre le X et les colonnes.
//
// Quatre triangles pour la croix (2 à 4 joueurs), six pour le plateau
// hexagonal : c'est le nombre de bras qui décide, il n'y a aucun cas séparé.
// Chaque triangle porte la couleur du joueur qui occupe ce bras, et un bras
// sans joueur garde son triangle GRIS — l'imprimé du plateau. Les pions
// arrivés se posent DANS le triangle de leur couleur (voir positionUtils),
// étalés du centre jusqu'au bord : on sait d'un coup d'œil qui a fini.
const VACANT_SIDE = "#8C8C94";

// Couvercle central du plateau HEXAGONAL, repris de la maquette 6 joueurs :
// un disque blanc translucide (anneau à contour blanc) puis un disque
// bordeaux (#a0104a), le trophée posé dessus. Les pions arrivés se posent
// DANS leur triangle (positionUtils), donc au-dessus de ce couvercle.
//
// Dimensions au prorata de la maquette : fan des 6 triangles d'apothème 1.9
// (l'apothème joue le rôle du rayon 181 du hub), le disque blanc fait
// 100/181 * 1.9 et le disque bordeaux 72/181 * 1.9.
const HUB_WHITE_RADIUS = 1.05;
const HUB_BORDEAUX_RADIUS = 0.756;

// Apothème du X = tout le grand carré central, pas seulement le petit
// milieu : c'est la surface que délimitent les bras et l'anneau, et elle
// doit être entièrement recouverte.
//
// Classique : les 4 bras et les 8 cases de coins de l'anneau le plus intérieur
// (centres à r = 1.878, en (±1.68, ±0.84) etc.) bornent la jonction. Le plus
// grand X carré possible sans mordre sur ces cases a ses coins à ±1.29 du
// centre (r = 1.29 * sqrt(2) = 1.82, juste à l'intérieur) : ses côtés
// rejoignent les coins internes des cases, donc la jonction est pleine et la
// piste reste entière.
// Hexagonal : mêmes calculs sur la jonction hexagonale, dont les cases
// intérieures sont à r = 2.444 — apothème 1.9, sommets à 2.19.
const CENTRE_APOTHEM = { classic: 1.29, hex: 1.9 };

/**
 * Triangle d'un bras, dans SON repère local (l'axe du bras est le x local).
 * Pointe au centre, base à l'apothème, à `apothem * tan(pi / côtés)` de
 * chaque côté de l'axe : pour un carré (4 côtés) la base court de coin en
 * coin et les triangles pavent exactement le grand carré ; pour l'hexagone
 * ils pavent l'hexagone. C'est division "en X" dont les frontières sont les
 * diagonales entre le centre et les coins.
 */
function sectorTriangleGeometry(apothem: number, sides: number) {
  const geometry = new THREE.BufferGeometry();
  const halfBase = apothem * Math.tan(Math.PI / sides);
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([0, 0, 0, apothem, 0, halfBase, apothem, 0, -halfBase]),
      3,
    ),
  );
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3),
  );
  geometry.setIndex([0, 1, 2]);
  return geometry;
}

function CenterArea({ playerCount }: { playerCount: number }) {
  const track = getTrack(playerCount);
  const isHex = track.shape === "hex";
  const sides = track.arms.length;
  const apothem = isHex ? CENTRE_APOTHEM.hex : CENTRE_APOTHEM.classic;

  // Une géométrie par bras, mémorisée : THREE ne libère pas les
  // BufferGeometry qu'on lui donne, et en recréer un par rendu fuiterait la
  // mémoire GPU sur une table qui tourne longtemps. Les triangles sont
  // identiques (même apothème, même secteur), seule leur TEINTE varie : on
  // pourrait en partager un seul, mais on les garde séparés pour que chaque
  // bras garde son mesh indépendant.
  const sectorGeometries = useMemo(
    () => track.arms.map(() => sectorTriangleGeometry(apothem, sides)),
    [apothem, sides, track],
  );

  useEffect(
    () => () => {
      sectorGeometries.forEach((geometry) => geometry.dispose());
    },
    [sectorGeometries],
  );

  return (
    <group>
      {/* Le X du centre : un triangle coloré par bras, tourné vers sa
          colonne, la base collée au départ des colonnes. */}
      {track.arms.map((arm, index) => (
        <group key={arm.offset} rotation={[0, -arm.angle, 0]}>
          <mesh position={[0, 0.185, 0]}>
            <primitive object={sectorGeometries[index]} attach="geometry" />
            <meshStandardMaterial
              color={arm.seat ? centerColorFor(track.shape, arm.seat.color) : VACANT_SIDE}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* Couvercle central, uniquement sur l'hexagone (la croix garde son X
          nu, comme la maquette 4 joueurs). */}
      {isHex ? (
        <group position={[0, 0, 0]}>
          <mesh position={[0, 0.187, 0]}>
            <cylinderGeometry args={[HUB_WHITE_RADIUS, HUB_WHITE_RADIUS, 0.015, 48]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.55} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.19, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[HUB_WHITE_RADIUS, 0.05, 12, 48]} />
            <meshStandardMaterial color="#FFFFFF" transparent opacity={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.192, 0]}>
            <cylinderGeometry args={[HUB_BORDEAUX_RADIUS, HUB_BORDEAUX_RADIUS, 0.012, 48]} />
            <meshStandardMaterial color="#a0104a" roughness={0.5} />
          </mesh>

          {/* Trophée doré : la maquette dessine l'emoji 🏆 au centre, il
              est redressé en une petite coupe posée sur le disque. */}
          <mesh position={[0, 0.205, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 0.025, 24]} />
            <meshStandardMaterial color="#d4a437" roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.035, 0.05, 0.06, 16]} />
            <meshStandardMaterial color="#d4a437" roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.31, 0]} scale={[1, 0.8, 1]}>
            <sphereGeometry args={[0.085, 24, 16]} />
            <meshStandardMaterial color="#d4a437" roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.335, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.06, 0.02, 12, 24]} />
            <meshStandardMaterial color="#e8c25a" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

export default CenterArea;