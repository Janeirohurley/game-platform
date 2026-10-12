// Progression d'un joueur, en pourcentage.
//
// Purement dérivée de l'état déjà présent sur le plateau : la position
// logique des quatre pièces. Aucune règle n'est recalculée ici, aucune
// donnée du serveur n'est dupliquée — c'est un indicateur, pas un juge.
//
// Convention d'index (identique à `positionUtils` / `ludo-state.ts`) :
//   -1                → dans la zone d'attente, à 0 case parcourue
//   0 .. finished-1   → cases parcourues, `position + 1` pas effectués
//   finished          → terminé, `finishedPosition + 1` pas effectués
//
// Le total est donc `finishedPosition + 1` pas par pièce : une pièce
// terminée a parcouru tout le chemin (elle compte `finished + 1`, et non
// `finished`, parce que la sortie de base est elle-même un pas).

import { finishedPositionFor } from "../data/boardPositions";
import { LUDO_PALETTE, type LudoColor } from "../data/track";
import type { GameState } from "../types/game";

/**
 * Nombre de pas parcourus par une pièce.
 *
 * La zone d'attente vaut 0 (rien n'a bougé) ; toute position sur le
 * chemin vaut `position + 1` parce que sortir de la base est le premier
 * pas. Une pièce terminée vaut donc `finishedPosition + 1`.
 */
export function pieceSteps(
  position: number,
  finishedPosition: number,
): number {
  if (position < 0) return 0;
  if (position >= finishedPosition) return finishedPosition + 1;
  return position + 1;
}

/** Pas totaux d'un joueur : sa pièce la plus aboutie en fin de partie. */
export function maxStepsFor(playerCount: number): number {
  return finishedPositionFor(playerCount) + 1;
}

/**
 * Progression d'un lot de pièces, en pourcentage entier.
 *
 * `sum(steps) / (pieces * maxSteps)`, ramené à 100 et arrondi vers le bas.
 * Un joueur dont toutes les pièces sont en base vaut 0 ; 100 n'est rendu
 * que si toutes sont arrivées (une seule pièce encore au repos plafonne
 * donc à 99). Une capture fait retomber une pièce en base : le résultat
 * baisse, et l'animation doit pouvoir le suivre dans les deux sens.
 */
export function progressForPositions(
  positions: readonly number[],
  playerCount: number,
): number {
  if (positions.length === 0) return 0;
  const finishedPosition = finishedPositionFor(playerCount);
  const maxSteps = maxStepsFor(playerCount);
  if (maxSteps <= 0) return 0;

  const total = positions.reduce(
    (sum, position) => sum + pieceSteps(position, finishedPosition),
    0,
  );

  return Math.floor((total / (positions.length * maxSteps)) * 100);
}

/** Même calcul, depuis les pièces du plateau. */
export function progressForPieces(
  pieces: readonly { position: number }[],
  playerCount: number,
): number {
  return progressForPositions(
    pieces.map((piece) => piece.position),
    playerCount,
  );
}

/**
 * Progression du siège d'une couleur donnée.
 *
 * Les couleurs sans joueur (bras vacant d'une croix à 2 ou 3) valent 0 :
 * l'appelant ne dessine d'ailleurs aucun indicateur pour elles.
 */
export function progressForColor(
  gameState: GameState,
  color: LudoColor,
): number {
  const player = gameState.players.find((p) => p.color === color);
  if (!player) return 0;
  return progressForPieces(player.pieces, gameState.playerCount);
}

/** Les couleurs effectivement assises, dans l'ordre de la partie. */
export function seatedColors(gameState: GameState): LudoColor[] {
  const order = new Map<LudoColor, number>(
    LUDO_PALETTE.map((color, index) => [color, index]),
  );
  return gameState.players
    .map((player) => player.color)
    .filter((color): color is LudoColor => order.has(color))
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}
