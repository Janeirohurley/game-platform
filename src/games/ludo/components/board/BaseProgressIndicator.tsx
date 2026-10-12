"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

import FlatMaterial from "./FlatMaterial";

// Progression d'une base, posée DANS la surface de la base.
//
// Ce n'est pas un contrôle de formulaire : pas de cadre, pas de pastille
// rapportée, pas de libellé flottant. C'est une jauge encastrée, comme une
// règle imprimée sur le plateau — un creux neutre, un trait à la couleur du
// joueur, et le pourcentage en petit sous le trait. La longueur du trait
// (et non la seule couleur) porte l'information, le nombre la confirme.
//
// Il n'y a que deux formes de base, et chacune a UNE zone franche :
//   - croix : le centre du panneau porte le nom, les quatre anneaux sont sur
//     les diagonales. La colonne centrale, entre le nom et le bord, est la
//     seule bande continue : la jauge s'y glisse en sous-titre du nom.
//   - hexagone : la plaque est un disque percé de quatre trous à mi-rayon ;
//     le centre (rayon libre ~0,56) ne porte ni nom ni trou. La jauge s'y
//     pose, centrée.
// Dans les deux cas, les valeurs (z, largeur, rayon) restent en deçà des
// anneaux/trous : aucun chevauchement avec les emplacements, le nom ou les
// pions.

/** Durée d'un balayage complet 0 → 100 % (les variations partielles sont plus courtes). */
const SWEEP_SECONDS = 0.4;

/** Retrait du trait par rapport au creux : le creux encadre le trait. */
const INSET_X = 0.06;
const INSET_Z = 0.018;

/** Épaisseurs : creux 0,006 puis trait à +0,002 au-dessus, sous le nom à 0.19. */
const SLAB = 0.006;

type Shape = "classic" | "hex";

interface Layout {
  /** Décalage local de la jauge le long de +z. */
  meterZ: number;
  /** Largeur du creux. */
  width: number;
  /** Profondeur (axe z) du creux. */
  depth: number;
  /** Hauteur du dessus du creux. */
  grooveY: number;
  /** Hauteur du dessus du trait de remplissage. */
  fillY: number;
  /** Décalage local du pourcentage. */
  textZ: number;
  textSize: number;
}

const LAYOUT: Record<Shape, Layout> = {
  // Sous le nom (z = 0), avant la rangée d'anneaux (z ≈ 0,67 au plus près) :
  // la jauge tient dans la bande centrale libre du panneau carré.
  classic: {
    meterZ: 0.3,
    width: 2.3,
    depth: 0.13,
    grooveY: 0.176,
    fillY: 0.184,
    textZ: 0.56,
    textSize: 0.23,
  },
  // Centre du disque : la jauge et le nombre tiennent dans le rayon libre
  // (≈ 0,56) sans atteindre les trous (rayon ≈ 0,97).
  hex: {
    meterZ: -0.1,
    width: 0.92,
    depth: 0.12,
    grooveY: 0.17,
    fillY: 0.178,
    textZ: 0.15,
    textSize: 0.2,
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

  const fillWidth = layout.width - INSET_X * 2;
  const fillDepth = layout.depth - INSET_Z * 2;

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

    // Le trait est ancré à gauche : seule son échelle en x bouge, jamais la
    // géométrie — aucune allocation par image.
    const value = Math.max(current.current, 0.0001);
    mesh.scale.x = value;
    mesh.position.x = (fillWidth / 2) * (value - 1);
  });

  const percent = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);

  return (
    <group>
      {/* Creux neutre : le seul fond, il sert de rail aussi bien sur le
          panneau gris que sur le disque coloré. Pas de contour ajouté. */}
      <mesh position={[0, layout.grooveY - SLAB / 2, layout.meterZ]}>
        <boxGeometry args={[layout.width, SLAB, layout.depth]} />
        <FlatMaterial color="#5b5b62" />
      </mesh>

      {/* Trait de progression, à la couleur du joueur, encastré dans le creux. */}
      <mesh ref={fillRef} position={[0, layout.fillY - SLAB / 2, layout.meterZ]}>
        <boxGeometry args={[fillWidth, SLAB, fillDepth]} />
        <FlatMaterial color={color} />
      </mesh>

      {/* Pourcentage : petit, sous la jauge. Texte sombre à liseré clair pour
          rester lisible sur le panneau gris comme sur les plaques colorées
          (jaune comme bleu), sans dépendre de la seule couleur. */}
      <Text
        position={[0, layout.fillY + 0.006, layout.textZ]}
        fontSize={layout.textSize}
        color="#1b1b20"
        outlineWidth={0.08}
        outlineColor="#ffffff"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {`${percent} %`}
      </Text>
    </group>
  );
}

export default BaseProgressIndicator;
