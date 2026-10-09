// Palette du plateau, séparée des règles.
//
// Le rendu ne connaît pas le jeu : il lui faut juste une couleur par
// siège. Centraliser ici évite de dupliquer six littéraux hexadécimaux
// dans chaque composant 3D, et évite surtout qu'un joueur soit orange
// sur un bras et rouge sur un autre.
//
// `ColorTheme.players` reste typé sur les six couleurs de la palette
// (voir `types/game.ts`) même quand la table n'en utilise que quatre :
// les cases neutres et le centre se teintent à partir de la même liste.

import type { ColorTheme, LudoColor } from "../types/game";

export const BOARD_THEME: ColorTheme = {
  name: "Ocean",
  boardBase: "#4C565A",
  trackTiles: "#A9BCBC",
  players: {
    yellow: "#FFD700",
    red: "#FF6347",
    blue: "#1E90FF",
    green: "#00CED1",
    orange: "#FF8C1A",
    purple: "#A855F7",
  },
};

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
