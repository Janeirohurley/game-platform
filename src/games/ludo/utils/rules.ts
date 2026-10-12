// Règles de déplacement, côté client, en fonctions PURES.
//
// MIROIR de `server-games/src/games/ludo/ludo-rules.ts`. Les deux dépôts
// sont séparés (voir l'en-tête de `track.ts`), donc cette copie est
// volontaire et manuelle : toute modification des règles doit être faite
// des deux côtés.
//
// À quoi ça sert ici, alors que le serveur est seul juge en ligne ?
//   - le mode LOCAL n'a pas de serveur : ces fonctions décrivent ce qu'un
//     coup légal signifie pour l'IA et pour les tests ;
//   - l'IA ne décide que parmi des coups LÉGAUX produits par ces règles,
//     et le jeu revérifie quand même avant d'appliquer (double sécurité).
//
// Aucune dépendance à React ni au rendu : un pion est `{ index, position }`.

import { getTrack } from "./positionUtils";
import type { LudoColor } from "../data/track";

/** Instantané minimal d'un pion, comme le serveur. */
export interface RulePiece {
  index: number;
  position: number;
}

/** Un joueur assis et ses pions, pour résoudre les captures. */
export interface SeatedPlayer {
  color: LudoColor;
  pieces: readonly RulePiece[];
}

/** Un coup validé. */
export interface ResolvedMove {
  pieceIndex: number;
  fromPosition: number;
  toPosition: number;
  /** Indice d'anneau de l'arrivée si elle touche l'anneau partagé, sinon -1. */
  destinationRing: number;
  /** Indices des pions adverses capturés par ce coup. */
  captures: number[];
  /** Vrai quand le pion atteint le centre. */
  finishes: boolean;
  /** Vrai quand un 6 fait sortir le pion de la base. */
  releaseFromBase: boolean;
  /** Vrai quand l'arrivée est sur une case sûre de l'anneau (ou hors anneau). */
  safe: boolean;
  /** Vrai quand l'arrivée entre dans la colonne maison privée. */
  entersHome: boolean;
}

/**
 * Case d'arrivée d'un pion pour un lancer, ou null si le coup est illégal
 * (il faut un 6 pour sortir de base, ou le lancer doit être exact pour
 * atteindre le centre).
 *
 * Arithmétique pure sur le chemin du pion : identique au serveur.
 */
export function destinationOf(
  piece: RulePiece,
  dice: number,
  finishedPosition: number,
): number | null {
  if (dice < 1 || dice > 6) return null;

  if (piece.position === -1) {
    return dice === 6 ? 0 : null;
  }
  if (piece.position === finishedPosition) return null;

  const target = piece.position + dice;
  if (target > finishedPosition) return null;
  return target;
}

/** Tous les coups légaux d'une couleur, pour un lancer et une table donnés. */
export function legalMoves(
  playerCount: number,
  color: LudoColor,
  pieces: readonly RulePiece[],
  dice: number,
): ResolvedMove[] {
  const track = getTrack(playerCount);
  const moves: ResolvedMove[] = [];

  for (const piece of pieces) {
    if (piece.position === track.finishedPosition) continue;
    const destination = destinationOf(piece, dice, track.finishedPosition);
    if (destination === null) continue;

    const onRing = destination < track.homeColumnStart;
    const destinationRing = onRing
      ? track.ringIndexOf(color, destination)
      : -1;

    moves.push({
      pieceIndex: piece.index,
      fromPosition: piece.position,
      toPosition: destination,
      destinationRing,
      captures: [],
      finishes: destination === track.finishedPosition,
      releaseFromBase: piece.position === -1,
      safe: !onRing || track.isSafeCell(destinationRing),
      entersHome: !onRing && !(destination === track.finishedPosition),
    });
  }

  return moves;
}

/**
 * Indices des pions adverses capturés si `color` arrive en `destination`.
 *
 * Miroir de `resolveCaptures` du serveur : seules les cases de l'anneau
 * partagé capturent, jamais une case sûre, jamais la colonne maison.
 */
export function resolveCaptures(
  playerCount: number,
  moverColor: LudoColor,
  destination: number,
  opponents: readonly SeatedPlayer[],
): number[] {
  const track = getTrack(playerCount);
  if (destination < 0 || destination >= track.homeColumnStart) return [];

  const ringIndex = track.ringIndexOf(moverColor, destination);
  if (track.isSafeCell(ringIndex)) return [];

  const captured: number[] = [];
  for (const opponent of opponents) {
    if (opponent.color === moverColor) continue;
    for (const piece of opponent.pieces) {
      if (piece.position < 0 || piece.position >= track.homeColumnStart) continue;
      if (track.ringIndexOf(opponent.color, piece.position) === ringIndex) {
        captured.push(piece.index);
      }
    }
  }
  return captured;
}

/**
 * Un lancer de 6, une capture ou un pion arrivé donnent un tour
 * supplémentaire (règle classique). Miroir du serveur, et de ce que fait
 * le mode local dans `movePiece`.
 */
export function grantsExtraTurn(
  dice: number,
  move: Pick<ResolvedMove, "captures" | "finishes">,
): boolean {
  return dice === 6 || move.captures.length > 0 || move.finishes;
}

/** Un joueur gagne quand tous ses pions sont arrivés. */
export function hasWon(
  pieces: readonly RulePiece[],
  finishedPosition: number,
): boolean {
  return (
    pieces.length > 0 &&
    pieces.every((piece) => piece.position === finishedPosition)
  );
}
