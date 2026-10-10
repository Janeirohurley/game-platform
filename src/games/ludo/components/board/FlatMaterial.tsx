"use client";

import type { ThreeElements } from "@react-three/fiber";

/**
 * Matériau plat du plateau : la couleur de la maquette, sans éclairage.
 *
 * Les maquettes 2D (`ludo-4-joueurs.html`, `ludo-6-joueurs.html`) sont des
 * aplats. Avec un `meshStandardMaterial`, l'ambiante 0.7 + la directionnelle
 * assombrissaient chaque teinte (le blanc de l'hexagone sortait gris, le jaune
 * virait au brun) et le tone mapping ACES de R3F désaturait le reste.
 * `toneMapped={false}` + `meshBasicMaterial` restituent exactement les valeurs
 * hexadécimales du thème. `fog={false}` : le brouillard de la pièce (voir
 * `LudoScene`) ne doit pas pâlir le plateau. Les pions gardent leur matériau
 * éclairé.
 */
export function FlatMaterial(props: ThreeElements["meshBasicMaterial"]) {
  return <meshBasicMaterial toneMapped={false} fog={false} {...props} />;
}

export default FlatMaterial;
