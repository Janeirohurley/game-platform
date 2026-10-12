// Types du cerveau de l'IA Ludo.
//
// Aucun import React, aucun import du moteur de rendu : le cerveau est un
// calcul pur (positions -> coup choisi) pour rester testable et
// déterministe avec un générateur aléatoire injecté.

import type { LudoColor } from "../data/track";
import type { ResolvedMove, RulePiece, SeatedPlayer } from "../utils/rules";

/** Les trois niveaux demandés. */
export type BotDifficulty = "easy" | "normal" | "hard";

/** Libellés français, alignés sur les niveaux. */
export const BOT_DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  easy: "Facile",
  normal: "Normal",
  hard: "Difficile",
};

/** Ordre d'affichage (du plus simple au plus fort). */
export const BOT_DIFFICULTIES: readonly BotDifficulty[] = [
  "easy",
  "normal",
  "hard",
];

/** Ce que l'IA voit de sa propre situation. */
export interface BotContext {
  playerCount: number;
  /** Couleur du siège piloté par l'IA. */
  color: LudoColor;
  /** Valeur du dé déjà lancé. */
  dice: number;
  /** Les quatre pions de l'IA. */
  pieces: readonly RulePiece[];
  /** Les autres sièges assis (adversaires), avec leurs pions. */
  opponents: readonly SeatedPlayer[];
}

/**
 * Un coup évalué. `score` et `reason` servent à la transparence et aux
 * tests : ce n'est PAS du machine learning, juste une somme de critères.
 */
export interface ScoredMove {
  move: ResolvedMove;
  score: number;
  /** Raisons lisibles, du plus déterminant au moins déterminant. */
  reasons: string[];
}

/** Signature du générateur aléatoire, injectable pour les tests. */
export type RandomFn = () => number;
