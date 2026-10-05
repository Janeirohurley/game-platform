// Position d'un pion, en coordonnées 3D.
//
// Miroir client de `server-games/src/games/ludo/ludo-state.ts` pour la
// convention d'index, et de `track.ts` pour la géométrie. Voir le fichier
// de piste pour l'explication de la duplication entre dépôts.
//
// Convention d'index (DOUBLE SOURCE DE VÉRITÉ AVEC LE SERVEUR) :
//   -1      → dans la zone d'attente
//   0–50    → anneau partagé, indexé via le décalage du siège
//   51–56   → colonne maison privée du joueur (6 cases)
//   57      → terminé — le centre du plateau ; ce n'est pas une case
//
// Chaque chemin fait 57 entrées (0–56). Le centre s'atteint avec un
// lancer EXACT depuis la dernière case de la colonne (56 + 1).
//
// Tables de 5 et 6 joueurs (plateau hexagonal) : les mêmes règles avec un
// parcours plus long : anneau 0–76, colonne maison 77–82, centre 83. Les
// valeurs viennent de la piste de la table (`track.finishedPosition`).

import {
  createTrack,
  DEFAULT_PLAYER_COUNT,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT,
  type BoardPoint,
  type LudoColor,
} from "../data/track";

/** Hauteur du plateau : les cases sont posées à plat, la pièce dessus. */
const TILE_Y = 0.2;

const CACHE = new Map<number, ReturnType<typeof createTrack>>();

/**
 * Une piste par taille de table, mémoïsée.
 *
 * Les tables de tailles différentes coexistent (deux parties en cours),
 * donc la géométrie est reconstruite depuis `playerCount` et non stockée
 * dans un module à l'échelle du jeu. `createTrack` est pur : le cache
 * n'est qu'un gain de rendu.
 */
export function getTrack(playerCount: number) {
  // Unusable input (NaN, 0, undefined from a snapshot that has not
  // arrived yet) falls back to the default table rather than to the
  // minimum: a board with four seats is the shape the product has
  // always shipped, so an early render never flashes a 2-player board.
  // A real but out-of-range count is clamped, because that can only come
  // from a registry that moved ahead of this component.
  const usable = Number.isFinite(playerCount) ? Math.trunc(playerCount) : 0;
  const size =
    usable < MIN_PLAYER_COUNT
      ? usable === 0
        ? DEFAULT_PLAYER_COUNT
        : MIN_PLAYER_COUNT
      : Math.min(MAX_PLAYER_COUNT, usable);

  let track = CACHE.get(size);
  if (!track) {
    track = createTrack(size);
    CACHE.set(size, track);
  }
  return track;
}

function toPoint3D(point: BoardPoint): [number, number, number] {
  return [point.x, TILE_Y, point.z];
}

/**
 * Traduit une position logique de pion en coordonnées 3D.
 *
 * `pieceIndex` sert à répartir les 4 pièces d'un joueur dans sa zone
 * d'attente, où aucune position logique ne les distingue (-1 pour
 * toutes).
 */
export function getPositionCoordinates(
  position: number,
  color: LudoColor,
  pieceIndex: number = 0,
  playerCount: number = 4,
): [number, number, number] {
  const track = getTrack(playerCount);

  if (position === -1) {
    // Réparties dans les emplacements de la zone d'attente du joueur.
    return toPoint3D(track.seatOf(color).base[pieceIndex % 4]);
  }

  if (position === track.finishedPosition) {
    // Terminé : le centre du plateau.
    return [0, TILE_Y, 0];
  }

  if (position >= 0 && position < track.finishedPosition) {
    return toPoint3D(track.pathOf(color)[position]);
  }

  // Position hors contrat : on ramène au centre plutôt que d'afficher
  // une pièce flottante.
  return [0, TILE_Y, 0];
}

/**
 * Cellule d'occupation d'un pion, pour décaler visuellement les pièces
 * qui partagent la même case. Renvoie `null` pour la zone d'attente et le
 * centre, qui gèrent déjà leur propre répartition.
 *
 * On renvoie la case GÉOMÉTRIQUE et non l'index logique : deux joueurs
 * d'offsets différents sont sur la même case du plateau en exactement
 * le même point, et c'est ce point qui doit servir de clé de regroupement.
 */
export function getTileKey(
  position: number,
  color: LudoColor,
  playerCount: number = 4,
): string | null {
  const track = getTrack(playerCount);
  if (position === -1 || position === track.finishedPosition) return null;
  if (position < 0 || position >= track.finishedPosition) return null;
  const point = track.pathOf(color)[position];
  // Arrondi : deux pions à 1e-15 près doivent être considérés comme
  // étant sur la même case.
  return `${point.x.toFixed(3)}:${point.z.toFixed(3)}`;
}
