// Palette du plateau, séparée des règles.
//
// Les deux formes de plateau ont chacune la palette de leur maquette 2D :
//  - classique (2 à 4 joueurs) : les teintes mates de `ludo-4-joueurs.html`
//    (fond #454545, cases #b0c2c2, cases sûres noires, plaques grises à
//    anneaux).
//  - hexagonal (5 et 6 joueurs) : les six couleurs vives de
//    `ludo-6-joueurs.html` posées sur des cases blanches.
//
// `ColorTheme.players` reste typé sur les six couleurs de la palette (et
// `LUDO_PALETTE` reste l'ordre des sièges côté serveur) : seule la MANIÈRE
// de les peindre change selon le plateau. L'ordre site→bras n'est pas
// modifiable — c'est un contrat de partie — la palette vives ne fait donc
// que renommer les valeurs hexadécimales.

import type { ColorTheme, LudoColor } from "../types/game";

/** Palette du plateau classique, reprise de la maquette 4 joueurs. */
export const CLASSIC_THEME: ColorTheme = {
  name: "Classique (maquette 4 joueurs)",
  // Plateau et cases BLANCS (demande de design) : les joints de la maquette
  // sont dessinés en contour de case (`PlayingTrack`), pas par un fond gris.
  boardBase: "#ffffff",
  trackTiles: "#ffffff",
  players: {
    yellow: "#c6a617",
    red: "#d44630",
    blue: "#0b65c4",
    green: "#0aa39f",
    orange: "#fb9c1d",
    purple: "#d526d0",
  },
};

/** Palette du plateau hexagonal, reprise de la maquette 6 joueurs. */
export const HEX_THEME: ColorTheme = {
  name: "Hexagonal (maquette 6 joueurs)",
  // Le plateau hexagonal EST l'hexagone blanc de la maquette (`<polygon
  // fill="#fff">`) : contrairement à la croix, il n'y a pas de fond sombre.
  boardBase: "#ffffff",
  trackTiles: "#ffffff",
  players: {
    yellow: "#f7dc2a",
    red: "#e8321f",
    blue: "#2b9bf0",
    green: "#08c75a",
    orange: "#fb9c1d",
    purple: "#d526d0",
  },
};

/** Le thème "d'exposition", conservé pour les composants d'interface. */
export const BOARD_THEME: ColorTheme = CLASSIC_THEME;

export function themeFor(shape: "classic" | "hex"): ColorTheme {
  return shape === "hex" ? HEX_THEME : CLASSIC_THEME;
}

/**
 * Teinte du CADRE d'une plaque classique, plus sombre que la case.
 *
 * La maquette imprime chaque base comme un cadre (base) entourant le
 * panneau gris, la case du couloir étant la version plus claire (case).
 */
export const BASE_FRAME: Record<LudoColor, string> = {
  yellow: "#b79a14",
  red: "#b93a28",
  blue: "#0a5aa8",
  green: "#04969a",
  orange: "#b97e14",
  purple: "#a3348f",
};

/**
 * Teinte claire de l'étoile d'un départ classique, sur une case colorée.
 */
export const STAR_LIGHT: Record<LudoColor, string> = {
  yellow: "#fff3a8",
  red: "#ffc0b4",
  blue: "#b4d8ff",
  green: "#c8fffb",
  orange: "#ffe0a3",
  purple: "#f0c6ff",
};

/**
 * Teinte de l'étoile PLEINE d'un bras hexagonal.
 *
 * La maquette 6 joueurs ne met pas la couleur du bras sous l'étoile mais
 * celle du bras SUIVANT dans la rotation des couleurs (jaune → vert,
 * orange → jaune, rouge → jaune, magenta → rouge, bleu → magenta,
 * vert → bleu). C'est la rotation écrite dans le HTML : jaune, orange,
 * rouge, magenta, bleu, vert.
 */
export const HEX_STAR_FILL: Record<LudoColor, string> = {
  yellow: "#08c75a", // vert
  red: "#f7dc2a", // jaune
  blue: "#d526d0", // magenta
  green: "#2b9bf0", // bleu
  orange: "#f7dc2a", // jaune
  purple: "#e8321f", // rouge
};

/**
 * Teinte des triangles du centre.
 *
 * Classique : les quatre teintes plus sombres que les cases, comme sur la
 * maquette (centre rouge #c8442d contre case #d44630…). Hexagonal : les
 * mêmes teintes que les bras, comme sur la maquette 6 joueurs.
 */
export const CENTER_TONE: Record<"classic" | "hex", Record<LudoColor, string>> = {
  classic: {
    yellow: "#c6a617",
    red: "#c8442d",
    blue: "#0b62c0",
    green: "#08a09f",
    orange: "#c28516",
    purple: "#9c3388",
  },
  hex: { ...HEX_THEME.players },
};

export function centerColorFor(shape: "classic" | "hex", color: LudoColor): string {
  return CENTER_TONE[shape][color];
}

/** Libellés français des sièges, alignés sur `LUDO_PALETTE`. */
export const COLOR_LABELS: Record<LudoColor, string> = {
  yellow: "Jaune",
  red: "Rouge",
  blue: "Bleu",
  green: "Vert",
  orange: "Orange",
  purple: "Violet",
};

/** Repli quand un siège n'a pas encore de joueur nommé. */
export const FALLBACK_NAME: Record<LudoColor, string> = COLOR_LABELS;