// Client mirror of the server's Ludo track geometry.
//
// COPIE VOLONTAIRE ET MANUELLE. Les deux dépôts sont séparés (pas de
// monorepo, pas de submodules), donc `track.ts` reproduit
// `server-games/src/games/ludo/ludo-state.ts`. Toute modification de la
// géométrie doit être faite dans les DEUX fichiers, sinon le client
// afficherait une case que le serveur ne compte pas, ou l'inverse.
//
// Le serveur reste seul juge de la partie : ce fichier ne fait que
// dessiner la table pour que le joueur voie où sont ses pions.

// DEUX PLATEAUX, choisis une fois par table d'après le nombre de joueurs :
//   - classique (2 à 4 joueurs) : anneau de 52 cases, maison 51-56, arrivée 57.
//   - hexagonal (5 et 6 joueurs) : étoile à six bras de 3 cases de large,
//     13 cases d'anneau par bras donc 78 en tout. Un pion parcourt 77 cases
//     d'anneau (0-76), puis la colonne maison (77-82), puis l'arrivée (83).
// Les valeurs propres à une table se lisent sur `LudoTrack` (ringLength,
// homeColumnStart, finishedPosition), jamais sur ces constantes : deux
// tables de tailles différentes coexistent.

/** Anneau du plateau classique (2 à 4 joueurs). */
export const RING_LENGTH = 52;
/** 0-50 : anneau partagé. 51-56 : colonne maison privée de 6 cases. */
export const HOME_COLUMN_START = 51;
export const FINISHED_POSITION = 57;

/** Plateau hexagonal (5 et 6 joueurs). */
export const HEX_ARM_COUNT = 6;
export const HEX_ARM_LENGTH = 13;
export const HEX_RING_LENGTH = HEX_ARM_COUNT * HEX_ARM_LENGTH; // 78
export const HEX_HOME_COLUMN_START = HEX_RING_LENGTH - 1; // 77
export const HEX_FINISHED_POSITION = HEX_HOME_COLUMN_START + 6; // 83
/** L'étoile se trouve à cette distance (en cases) après une case de départ. */
export const HEX_STAR_OFFSET = 8;
/** Première taille de table qui joue sur le plateau hexagonal. */
export const HEX_MIN_PLAYER_COUNT = 5;
export const PIECES_PER_PLAYER = 4;
export const MIN_PLAYER_COUNT = 2;
/**
 * Taille de repli tant que la table n'est pas configurée. Le plateau est
 * dessiné avant le premier coup, donc il lui faut une forme même quand
 * `players` est vide.
 */
export const DEFAULT_PLAYER_COUNT = 4;

/**
 * Les six sièges, dans l'ordre de jeu. Une table de N joueurs utilise
 * les PREMIERS N : une table à quatre conserve donc exactement
 * yellow/red/blue/green, et une table à deux est jaune contre rouge.
 *
 * Cet ordre est celui du serveur — le seat 0 du salon doit correspondre
 * au seat 0 du plateau, sinon le tour affiché ne correspond plus au tour
 * joué.
 */
export const LUDO_PALETTE = [
  "yellow",
  "red",
  "blue",
  "green",
  "orange",
  "purple",
] as const;

export type LudoColor = (typeof LUDO_PALETTE)[number];
export const MAX_PLAYER_COUNT = LUDO_PALETTE.length;

export function isLudoColor(value: string): value is LudoColor {
  return (LUDO_PALETTE as readonly string[]).includes(value);
}

/** Un point du plan du plateau. `y` est geré par le rendu 3D. */
export type BoardPoint = { x: number; z: number };

export interface LudoSeat {
  /** Rang du siège, de 0 à `playerCount - 1`. */
  readonly seat: number;
  readonly color: LudoColor;
  /** Indice de la case d'entrée dans l'anneau. */
  readonly offset: number;
  /** Direction du bras, en radians (0 = +x, sens trigonométrique). */
  readonly angle: number;
  /** Les 6 cases de la colonne maison, de la bordure vers le centre. */
  readonly homeColumn: readonly BoardPoint[];
  /** Les 4 emplacements d'attente, dans l'ordre des pièces. */
  readonly base: readonly BoardPoint[];
  /** Case de l'anneau où ce joueur entre. */
  readonly start: BoardPoint;
}

export interface LudoTrack {
  readonly playerCount: number;
  /** Plateau de cette table. */
  readonly shape: "classic" | "hex";
  /** Cases d'anneau partagées : 52 (classique) ou 78 (hexagonal). */
  readonly ringLength: number;
  /** Première case de la colonne maison : 51 ou 77. */
  readonly homeColumnStart: number;
  /** Position du centre : 57 ou 83. */
  readonly finishedPosition: number;
  readonly colors: readonly LudoColor[];
  readonly seats: readonly LudoSeat[];
  /** Les cases de l'anneau (52 ou 78), indexées par indice d'anneau. */
  readonly ring: readonly BoardPoint[];
  /** Cellules de l'anneau où l'on ne peut pas être capturé. */
  readonly safeCells: ReadonlySet<number>;
  /**
   * Chemin complet d'un siège : anneau puis colonne maison, dans l'ordre
   * de parcours (57 entrées en classique, 83 en hexagonal). Indexé par la
   * position logique du pion, donc directement exploitable par le rendu.
   */
  pathOf(color: LudoColor): readonly BoardPoint[];
  ringIndexOf(color: LudoColor, pathIndex: number): number;
  isSafeCell(ringIndex: number): boolean;
  seatOf(color: LudoColor): LudoSeat;
}

// --- Constantes de dessin -----------------------------------------------
// L'anneau est un cercle de 52 cases. Le pas entre deux cases voisines
// vaut 2 * rayon * sin(pi / 52) ≈ 0.845, et la colonne maison descend avec
// exactement ce pas : la transition anneau → maison est donc visuellement
// continue, ce qui n'était pas le cas avec les coordonnées entières de
// l'ancien plateau en croix.
const RING_RADIUS = 7;
// Le premier siège pointe vers -z pour que la table à quatre conserve
// l'orientation historique (jaune en haut, rouge à droite du jaune…).
const FIRST_SEAT_ANGLE_DEG = -90;
const HOME_STEP = 0.84;
/** Rayons des 6 cases de la colonne maison, de la bordure vers le centre. */
const HOME_RADII = Array.from(
  { length: 6 },
  (_, i) => RING_RADIUS - 1.3 - i * HOME_STEP,
);
/** Les 4 emplacements d'attente : 2 rangées de 2, derrière le bras. */
const BASE_RADII = [9.2, 10.6];
const BASE_LATERAL = [-0.62, 0.62];

function polar(angleDeg: number, radius: number): BoardPoint {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.cos(rad), z: radius * Math.sin(rad) };
}

/**
 * Décale un point le long du bras et vers son côté.
 * `along` avance vers le centre, `lateral` se décale orthogonalement.
 */
function onArm(
  angleRad: number,
  along: number,
  lateral: number,
): BoardPoint {
  const ux = Math.cos(angleRad);
  const uz = Math.sin(angleRad);
  return { x: along * ux - lateral * uz, z: along * uz + lateral * ux };
}

/**
 * Construit la géométrie d'une table de `playerCount` joueurs.
 *
 * Lève sur une taille non supportée plutôt que de borner : un appelant
 * qui passe 7 ou 0 a un bug, et l'accepter silencieusement afficherait un
 * plateau presque correct qui masque l'erreur.
 */
export function createTrack(playerCount: number): LudoTrack {
  if (
    !Number.isInteger(playerCount) ||
    playerCount < MIN_PLAYER_COUNT ||
    playerCount > MAX_PLAYER_COUNT
  ) {
    throw new Error(
      `Unsupported Ludo table size ${playerCount} (expected ${MIN_PLAYER_COUNT}-${MAX_PLAYER_COUNT})`,
    );
  }
  return playerCount >= HEX_MIN_PLAYER_COUNT
    ? createHexTrack(playerCount)
    : createClassicTrack(playerCount);
}

/** Plateau classique : 2 à 4 joueurs, exactement comme avant. */
function createClassicTrack(playerCount: number): LudoTrack {
  const ring: BoardPoint[] = Array.from({ length: RING_LENGTH }, (_, i) =>
    polar(FIRST_SEAT_ANGLE_DEG + (i * 360) / RING_LENGTH, RING_RADIUS),
  );

  const segment = RING_LENGTH / playerCount;
  const safeCells = new Set<number>();
  const seats: LudoSeat[] = [];
  const byColor = new Map<LudoColor, LudoSeat>();

  for (let seat = 0; seat < playerCount; seat += 1) {
    const color = LUDO_PALETTE[seat];
    // Même arrondi que le serveur : l'erreur se répartit sur tout
    // l'anneau au lieu de s'accumuler (6 joueurs => 9/8/9/9/8/9).
    const offset = Math.round(seat * segment) % RING_LENGTH;
    const angleDeg = FIRST_SEAT_ANGLE_DEG + (seat * 360) / playerCount;
    const angleRad = (angleDeg * Math.PI) / 180;

    safeCells.add(offset);
    safeCells.add((offset + Math.round(segment / 2)) % RING_LENGTH);

    const homeColumn = HOME_RADII.map((r) => onArm(angleRad, r, 0));
    const base: BoardPoint[] = [];
    for (const radius of BASE_RADII) {
      for (const lateral of BASE_LATERAL) {
        base.push(onArm(angleRad, radius, lateral));
      }
    }

    const entry: LudoSeat = {
      seat,
      color,
      offset,
      angle: angleRad,
      homeColumn,
      base,
      start: ring[offset],
    };
    seats.push(entry);
    byColor.set(color, entry);
  }

  const colors = seats.map((s) => s.color);

  function seatOf(color: LudoColor): LudoSeat {
    const found = byColor.get(color);
    if (!found) throw new Error(`Color ${color} is not seated on this table`);
    return found;
  }

  return {
    playerCount,
    shape: "classic",
    ringLength: RING_LENGTH,
    homeColumnStart: HOME_COLUMN_START,
    finishedPosition: FINISHED_POSITION,
    colors,
    seats,
    ring,
    safeCells,
    seatOf,

    pathOf(color: LudoColor): readonly BoardPoint[] {
      const entry = seatOf(color);
      // 51 cases d'anneau puis 6 cases de colonne maison = 57 positions,
      // exactement la longueur du chemin logique. Le centre (57) n'est
      // PAS une case de chemin : on l'atteint par un lancer exact depuis
      // la dernière case de la colonne.
      const path: BoardPoint[] = [];
      for (let i = 0; i <= 50; i += 1) {
        path.push(ring[(entry.offset + i) % RING_LENGTH]);
      }
      return [...path, ...entry.homeColumn];
    },

    ringIndexOf(color: LudoColor, pathIndex: number): number {
      return (seatOf(color).offset + pathIndex) % RING_LENGTH;
    },

    isSafeCell(ringIndex: number): boolean {
      return safeCells.has(ringIndex);
    },
  };
}

// --- Plateau hexagonal (5 et 6 joueurs) ---------------------------------
//
// Repère local d'un bras : `y` s'éloigne du centre, `x` traverse le bras.
// Un bras fait 3 cases de large et 6 de profondeur :
//   - colonne gauche   (x = -1, y = 1..6)  : 6 cases d'anneau, vers l'extérieur
//   - bout             (x =  0, y = 6)     : 1 case d'anneau
//   - colonne droite   (x = +1, y = 6..1)  : 6 cases d'anneau, vers le centre
//   - colonne du milieu (x = 0, y = 5..1, puis 0) : la colonne maison
// soit 13 cases d'anneau par bras.
//
// Le siège k entre sur l'anneau à la case 13 * k, qui est la case (x = +1,
// y = 5) de son propre bras, juste à côté de sa colonne maison. Son dernier
// pas d'anneau est le bout de son bras (case 13 * k - 2), d'où il entre dans
// la colonne maison. La case 13 * k - 1 n'est jamais empruntée par sa propre
// couleur : c'est le raccourci vers la maison, comme sur le plateau classique.

/**
 * Éloignement de l'origine d'un bras. sqrt(3) place la dernière case d'un bras
 * à exactement une case de la première du bras suivant : l'anneau se referme
 * sans trou ni chevauchement.
 */
const HEX_ARM_RADIUS = Math.sqrt(3);
/** Décalage entre l'indice d'anneau global et l'indice local d'un bras. */
const HEX_RING_SHIFT = 8;
/** Une case du plateau hexagonal : même pas que la colonne maison classique. */
const HEX_SCALE = HOME_STEP;

function hexArmAngleRad(arm: number): number {
  return ((FIRST_SEAT_ANGLE_DEG + (arm * 360) / HEX_ARM_COUNT) * Math.PI) / 180;
}

function hexLocalToWorld(arm: number, localX: number, localY: number): BoardPoint {
  const theta = hexArmAngleRad(arm);
  const ux = Math.cos(theta);
  const uz = Math.sin(theta);
  const radial = HEX_ARM_RADIUS + localY;
  return {
    x: (radial * ux - localX * uz) * HEX_SCALE,
    z: (radial * uz + localX * ux) * HEX_SCALE,
  };
}

/** Point d'une case d'anneau du plateau hexagonal, par indice global (0-77). */
function hexRingPoint(globalCell: number): BoardPoint {
  const shifted =
    (((globalCell + HEX_RING_SHIFT) % HEX_RING_LENGTH) + HEX_RING_LENGTH) %
    HEX_RING_LENGTH;
  const arm = Math.floor(shifted / HEX_ARM_LENGTH);
  const j = shifted % HEX_ARM_LENGTH;
  if (j <= 5) return hexLocalToWorld(arm, -1, j + 1);
  if (j === 6) return hexLocalToWorld(arm, 0, 6);
  return hexLocalToWorld(arm, 1, HEX_ARM_LENGTH - j);
}

/** Plateau hexagonal : 5 et 6 joueurs. Six bras, un siège par bras. */
function createHexTrack(playerCount: number): LudoTrack {
  const ring: BoardPoint[] = Array.from({ length: HEX_RING_LENGTH }, (_, i) =>
    hexRingPoint(i),
  );

  // Les cases sûres appartiennent au PLATEAU, pas aux joueurs assis : le
  // bras vide d'une table à cinq garde son départ et son étoile.
  const safeCells = new Set<number>();
  for (let arm = 0; arm < HEX_ARM_COUNT; arm += 1) {
    safeCells.add(arm * HEX_ARM_LENGTH);
    safeCells.add(arm * HEX_ARM_LENGTH + HEX_STAR_OFFSET);
  }

  const seats: LudoSeat[] = [];
  const byColor = new Map<LudoColor, LudoSeat>();
  for (let seat = 0; seat < playerCount; seat += 1) {
    const color = LUDO_PALETTE[seat];
    const offset = seat * HEX_ARM_LENGTH;
    const angleRad = hexArmAngleRad(seat);

    // 6 cases : de y = 5 jusqu'à y = 1, puis y = 0, juste avant le centre.
    const homeColumn: BoardPoint[] = [5, 4, 3, 2, 1, 0].map((y) =>
      hexLocalToWorld(seat, 0, y),
    );
    const base: BoardPoint[] = [];
    for (const radius of BASE_RADII) {
      for (const lateral of BASE_LATERAL) {
        base.push(onArm(angleRad, radius, lateral));
      }
    }

    const entry: LudoSeat = {
      seat,
      color,
      offset,
      angle: angleRad,
      homeColumn,
      base,
      start: ring[offset],
    };
    seats.push(entry);
    byColor.set(color, entry);
  }

  function seatOf(color: LudoColor): LudoSeat {
    const found = byColor.get(color);
    if (!found) throw new Error(`Color ${color} is not seated on this table`);
    return found;
  }

  return {
    playerCount,
    shape: "hex",
    ringLength: HEX_RING_LENGTH,
    homeColumnStart: HEX_HOME_COLUMN_START,
    finishedPosition: HEX_FINISHED_POSITION,
    colors: seats.map((s) => s.color),
    seats,
    ring,
    safeCells,
    seatOf,

    pathOf(color: LudoColor): readonly BoardPoint[] {
      const entry = seatOf(color);
      // 77 cases d'anneau puis 6 de colonne maison = 83 positions. Le centre
      // (83) n'est PAS une case de chemin : on l'atteint par un lancer exact.
      const path: BoardPoint[] = [];
      for (let i = 0; i < HEX_HOME_COLUMN_START; i += 1) {
        path.push(ring[(entry.offset + i) % HEX_RING_LENGTH]);
      }
      return [...path, ...entry.homeColumn];
    },

    ringIndexOf(color: LudoColor, pathIndex: number): number {
      return (seatOf(color).offset + pathIndex) % HEX_RING_LENGTH;
    },

    isSafeCell(ringIndex: number): boolean {
      return safeCells.has(ringIndex);
    },
  };
}
