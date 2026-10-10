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
//   57      → terminé — le secteur du centre qui fait face au bras du joueur ;
//             ce n'est pas une case, et ce n'est plus un point unique
//             commun aux quatre couleurs
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

/**
 * Emplacements des pions arrivés, en (distance le long du bras, décalage
 * orthogonal). Un lot par forme de plateau : la croix et l'hexagone n'ont
 * pas la même place libre au centre, voir le commentaire juste au-dessus
 * de chaque lot. Dans tous les cas `|lateral| <= along` : un pion reste
 * dans le triangle de son bras, il ne déborde jamais dans le secteur d'un
 * autre.
 *
 * Les quatre emplacements sont étalés du centre JUSQU'AU BORD du triangle,
 * pas empilés au milieu : on lit d'un coup d'œil quel joueur a terminé
 * parce que ses pions couvrent le triangle de sa couleur.
 */
const FINISH_SLOTS: Record<"classic" | "hex", readonly (readonly [number, number])[]> = {
  // Croix : le X remplit TOUT le grand carré central (apothème 1.29 — ses
  // coins sont pile au coin interne des huit cases de l'anneau intérieur,
  // donc la base de chaque triangle touche ces cases). Les pions s'étalent
  // dans leur triangle jusqu'à 1.2, à 0.09 du bord : on couvre toute la
  // surface sans que le centre d'un pion dépasse dans la case de coin.
  // Écart minimal entre emplacements 0.66, pions rayon 0.23 : lisibles.
  classic: [
    [0.15, 0],
    [0.6, 0.5],
    [0.6, -0.5],
    [1.2, 0],
  ],
  // Hexagonal : X d'apothème HEX_HUB_APOTHEM (2.82, comme la maquette).
  // Même étalement que sur l'ancien centre d'apothème 1.9, ramené à
  // l'échelle (x 1.49) : dernier emplacement à 2.7 soit 0.12 du bord. Le
  // décalage latéral reste sous ~24° de l'axe du bras (le secteur en fait
  // 30) : jamais collés à la frontière du voisin.
  hex: [
    [0.3, 0],
    [1.5, 0.67],
    [1.5, -0.67],
    [2.7, 0],
  ],
};

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
 * `pieceIndex` sert à répartir les 4 pièces d'un joueur aux deux endroits
 * où la position logique ne les distingue pas : la zone d'attente (-1 pour
 * toutes) et le point d'arrivée (57 ou 83 pour toutes).
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
    // Terminé : le centre est partagé entre les quatre bras, chaque joueur
    // occupe LE SIEN — le jaune finit à gauche, le rouge en haut, et ainsi
    // de suite, comme les triangles colorés du centre d'un plateau imprimé.
    // Les quatre emplacements sont distincts : sans ça, tous les pions
    // finis tomberaient sur le même point et se superposeraient.
    const [along, lateral] = FINISH_SLOTS[track.shape][
      pieceIndex % FINISH_SLOTS[track.shape].length
    ];
    const ux = Math.cos(track.seatOf(color).angle);
    const uz = Math.sin(track.seatOf(color).angle);
    return [along * ux - lateral * uz, TILE_Y, along * uz + lateral * ux];
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
 * qui partagent la même case. Renvoie `null` pour la zone d'attente et
 * pour les pions terminés : les deux possèdent déjà chacun leur propre
 * emplacement, ils n'ont pas de regroupement à calculer.
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
