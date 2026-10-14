// Cerveau de l'IA Ludo : décision pure, sans rendu ni réseau.
//
// PRINCIPE : le cerveau ne fait qu'un choix PARMI DES COUPS LÉGAUX. La
// légalité vient de `utils/rules.ts` (miroir du serveur) et le jeu
// revérifie quand même avant d'appliquer. Le cerveau ne connaît ni React
// ni le plateau 3D : on lui donne des positions, il rend un index de pion.
//
// LES TROIS NIVEAUX DIFFÈRENT DANS LA DÉCISION, pas seulement par un délai :
//   - Facile  : aléatoire, avec une préférence PARFOIS pour un coup sûr.
//   - Normal  : somme de critères transparents (finir, capturer, sortir,
//               case sûre, avancer) moins une pénalité d'exposition.
//   - Difficile : Normal + évaluation du risque (probabilité de se faire
//               capturer au tour suivant, valeur du pion perdu), du
//               sauvetage (quitter une case dangereuse), de la pression
//               (pouvoir capturer un adversaire au tour suivant) et de la
//               COURSE : un joueur en retard ose davantage, un joueur en
//               tête sécurise (voir `raceRiskFactor`).

import { getTrack } from "../utils/positionUtils";
import type { LudoColor } from "../data/track";
import type { ResolvedMove, RulePiece, SeatedPlayer } from "../utils/rules";
import type { BotContext, BotDifficulty, ScoredMove, RandomFn } from "./types.js";

/** Poids des critères. Regroupés ici pour pouvoir les régler d'un bloc. */
const WEIGHTS = {
  finish: 1000,
  captureBase: 550,
  capturePerStep: 6,
  release: 260,
  safe: 90,
  enterHome: 70,
  advancePerStep: 12,
  /** Normal : pénalité par pion adverse menaçant la case d'arrivée. */
  threaten: 55,
  /** Difficile : coefficient de la perte espérée (probabilité × valeur). */
  expectedLoss: 8,
  /** Difficile : prime pour quitter une case menacée. */
  rescue: 45,
  /** Difficile : prime par adversaire que l'on pourra capturer au tour suivant. */
  chase: 30,
} as const;

interface CapturedPiece {
  color: LudoColor;
  index: number;
  position: number;
}

function isOnRing(track: ReturnType<typeof getTrack>, position: number): boolean {
  return position >= 0 && position < track.homeColumnStart;
}

/** Progression approximative d'un pion (0 en base, +1 par case). */
function pieceSteps(position: number): number {
  return position < 0 ? 0 : position + 1;
}

/**
 * Pions adverses que ce coup capture, avec leur position d'origine — pour
 * valoriser la prise d'un pion avancé plutôt que d'un pion au départ.
 */
function capturesAt(
  playerCount: number,
  color: LudoColor,
  destination: number,
  opponents: readonly SeatedPlayer[],
): CapturedPiece[] {
  const track = getTrack(playerCount);
  if (!isOnRing(track, destination)) return [];

  const ringIndex = track.ringIndexOf(color, destination);
  if (track.isSafeCell(ringIndex)) return [];

  const captured: CapturedPiece[] = [];
  for (const opponent of opponents) {
    if (opponent.color === color) continue;
    for (const piece of opponent.pieces) {
      if (!isOnRing(track, piece.position)) continue;
      if (track.ringIndexOf(opponent.color, piece.position) === ringIndex) {
        captured.push({ color: opponent.color, index: piece.index, position: piece.position });
      }
    }
  }
  return captured;
}

/**
 * Nombre de pions adverses qui pourraient atterrir sur la case occupée par
 * un pion `color` situé en `pathPosition` au prochain lancer. 0 si la case
 * est sûre ou hors anneau. C'est la « menace » lue par le niveau Difficile.
 */
function ringThreatCount(
  playerCount: number,
  color: LudoColor,
  opponents: readonly SeatedPlayer[],
  pathPosition: number,
): number {
  const track = getTrack(playerCount);
  if (!isOnRing(track, pathPosition)) return 0;
  const ring = track.ringIndexOf(color, pathPosition);
  if (track.isSafeCell(ring)) return 0;

  let count = 0;
  for (const opponent of opponents) {
    if (opponent.color === color) continue;
    for (const piece of opponent.pieces) {
      if (!isOnRing(track, piece.position)) continue;
      const theirRing = track.ringIndexOf(opponent.color, piece.position);
      const distance = (ring - theirRing + track.ringLength) % track.ringLength;
      if (distance >= 1 && distance <= 6) count++;
    }
  }
  return count;
}

/**
 * Nombre de pions adverses que `color` pourra capturer au prochain lancer
 * depuis `pathPosition` (pression). Ne compte pas les cases sûres.
 */
function chaseTargets(
  playerCount: number,
  color: LudoColor,
  opponents: readonly SeatedPlayer[],
  pathPosition: number,
): number {
  const track = getTrack(playerCount);
  if (!isOnRing(track, pathPosition)) return 0;
  const ring = track.ringIndexOf(color, pathPosition);

  let count = 0;
  for (const opponent of opponents) {
    if (opponent.color === color) continue;
    for (const piece of opponent.pieces) {
      if (!isOnRing(track, piece.position)) continue;
      const theirRing = track.ringIndexOf(opponent.color, piece.position);
      if (track.isSafeCell(theirRing)) continue;
      const distance = (theirRing - ring + track.ringLength) % track.ringLength;
      if (distance >= 1 && distance <= 6) count++;
    }
  }
  return count;
}

/** Critères communs à Normal et Difficile, du plus lourd au plus léger. */
function baseScore(move: ResolvedMove, context: BotContext): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (move.finishes) {
    score += WEIGHTS.finish;
    reasons.push("arrive au centre");
  }

  const captured = capturesAt(context.playerCount, context.color, move.toPosition, context.opponents);
  for (const piece of captured) {
    score += WEIGHTS.captureBase + pieceSteps(piece.position) * WEIGHTS.capturePerStep;
  }
  if (captured.length > 0) {
    reasons.push(`capture ${captured.length} pion(s)`);
  }

  if (move.releaseFromBase) {
    score += WEIGHTS.release;
    reasons.push("sort de la base");
  }
  if (move.safe && !move.releaseFromBase) {
    score += WEIGHTS.safe;
    reasons.push("arrive sur une case sûre");
  }
  if (move.entersHome) {
    score += WEIGHTS.enterHome;
    reasons.push("entre dans la colonne maison");
  }

  const advance = move.releaseFromBase ? 1 : move.toPosition - move.fromPosition;
  score += Math.max(advance, 0) * WEIGHTS.advancePerStep;

  return { score, reasons };
}

/** Progression totale (en cases) d'un lot de pions. */
function totalSteps(pieces: readonly RulePiece[]): number {
  return pieces.reduce((sum, piece) => sum + pieceSteps(piece.position), 0);
}

/**
 * Tolérance au risque selon la COURSE. Un joueur en retard doit oser pour
 * revenir ; un joueur en tête joue la sécurité. C'est le seul calcul qui
 * regarde l'état GLOBAL de la table et pas seulement le pion déplacé — d'où
 * le niveau Difficile uniquement.
 *
 *   - en retard  → 0.7 (on accepte plus d'exposition pour ne pas se laisser
 *                       distancer) ;
 *   - en tête    → 1.3 (on surestime le danger, on protège l'avance) ;
 *   - à égalité  : 1.
 */
export function raceRiskFactor(context: BotContext): number {
  const own = totalSteps(context.pieces);
  const bestOpponent = context.opponents.reduce(
    (best, opponent) => Math.max(best, totalSteps(opponent.pieces)),
    0,
  );
  if (own < bestOpponent) return 0.7;
  if (own > bestOpponent) return 1.3;
  return 1;
}

function scoreHard(move: ResolvedMove, context: BotContext): ScoredMove {
  const base = baseScore(move, context);
  const reasons = [...base.reasons];
  const score = base.score;

  const destThreats = ringThreatCount(context.playerCount, context.color, context.opponents, move.toPosition);
  // Probabilité de se faire capturer au prochain tour (au moins un adversaire
  // atteint la case) : 1 - (5/6)^menaces si chaque adversaire a une chance
  // sur six de tomber pile dessus.
  const captureChance = 1 - Math.pow(5 / 6, destThreats);
  const lostValue = pieceSteps(move.toPosition);
  const risk = raceRiskFactor(context);
  const expectedLoss = captureChance * lostValue * WEIGHTS.expectedLoss * risk;
  if (expectedLoss > 0) reasons.push(`risque de perte ${expectedLoss.toFixed(0)}`);

  const originThreats = ringThreatCount(context.playerCount, context.color, context.opponents, move.fromPosition);
  const rescue = originThreats > destThreats ? (originThreats - destThreats) * WEIGHTS.rescue : 0;
  if (rescue > 0) reasons.push("échappe à une menace");

  const chases = chaseTargets(context.playerCount, context.color, context.opponents, move.toPosition);
  if (chases > 0) reasons.push(`met la pression sur ${chases} pion(s)`);

  return {
    move,
    score: score - expectedLoss + rescue + chases * WEIGHTS.chase,
    reasons,
  };
}

function scoreNormal(move: ResolvedMove, context: BotContext): ScoredMove {
  const { score, reasons } = baseScore(move, context);
  const threats = ringThreatCount(context.playerCount, context.color, context.opponents, move.toPosition);
  if (threats > 0) reasons.push(`exposé à ${threats} pion(s)`);
  return { move, score: score - threats * WEIGHTS.threaten, reasons };
}

function chooseEasy(
  legal: readonly ResolvedMove[],
  context: BotContext,
  random: RandomFn,
): ScoredMove {
  const obvious = legal.filter(
    (move) =>
      move.finishes ||
      move.releaseFromBase ||
      move.safe ||
      capturesAt(context.playerCount, context.color, move.toPosition, context.opponents).length > 0,
  );

  // Une fois sur deux, l'IA facile prend un coup « qui ne peut pas être
  // mauvais » (sortir, capturer, arriver, se poser sur une case sûre), sans
  // chercher l'optimum. Sinon elle joue complètement au hasard. Elle reste
  // donc toujours légale, mais pas fiable — le propre d'un niveau facile.
  const pool = random() < 0.5 && obvious.length > 0 ? obvious : legal;
  const choice = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return { move: choice, score: 0, reasons: ["choix facile"] };
}

/**
 * Choisit un coup parmi des coups DÉJÀ LÉGAUX. Rend `null` s'il n'y a rien
 * à jouer (le tour revient alors au jeu, qui gère le passage).
 */
export function chooseMove(
  difficulty: BotDifficulty,
  legal: readonly ResolvedMove[],
  context: BotContext,
  random: RandomFn = Math.random,
): ScoredMove | null {
  if (legal.length === 0) return null;
  if (difficulty === "easy") return chooseEasy(legal, context, random);

  const scored = legal.map((move) =>
    difficulty === "hard" ? scoreHard(move, context) : scoreNormal(move, context),
  );
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.move.toPosition - a.move.toPosition ||
      a.move.pieceIndex - b.move.pieceIndex,
  );
  return scored[0];
}
