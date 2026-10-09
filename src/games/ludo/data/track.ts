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
//   - classique (2 à 4 joueurs) : une CROIX de quatre bras, anneau de 52
//     cases, maison 51-56, arrivée 57.
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

/**
 * Un bras du plateau, avec ou sans joueur.
 *
 * Le plateau physique a TOUJOURS ses quatre bras : une table à deux joueurs
 * garde les quatre zones, deux sont simplement inoccupées. On sépare donc le
 * bras (structure du plateau, toujours dessiné) du siège (un joueur qui
 * l'occupe). `seat` vaut `null` pour un bras libre, que le rendu dessine
 * alors en gris.
 */
export interface LudoArm {
  /** Indice de la case d'entrée du bras dans l'anneau. */
  readonly offset: number;
  /** Direction du bras, en radians (0 = +x, sens trigonométrique). */
  readonly angle: number;
  /** Les 6 cases de la colonne maison, de la bordure vers le centre. */
  readonly homeColumn: readonly BoardPoint[];
  /** Les 4 emplacements d'attente, dans l'ordre des pièces. */
  readonly base: readonly BoardPoint[];
  /** Case de l'anneau où ce bras entre. */
  readonly start: BoardPoint;
  /** Le joueur qui occupe ce bras, `null` si le bras est libre. */
  readonly seat: LudoSeat | null;
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
  /**
   * Tous les bras du plateau, occupés ou non : 4 en classique, 6 en
   * hexagonal. C'est ce que le rendu parcourt — un plateau de Ludo physique
   * garde ses quatre zones même quand deux joueurs seulement y jouent.
   */
  readonly arms: readonly LudoArm[];
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

// --- Géométrie du plateau classique ---------------------------------------
//
// Le plateau classique EST une croix, comme sur un plateau de Ludo
// physique : quatre bras de trois cases de large. La colonne du milieu de
// chaque bras est la colonne maison d'un joueur, les deux colonnes
// latérales sont l'anneau partagé, et le centre 3x3 reste vide pour
// accueillir les pions arrivés.
//
// L'anneau fait 4 x 13 = 52 cases : six cases le long d'un côté de bras, la
// case du bout de bras, puis six cases le long de l'autre côté. La jonction
// entre deux bras est un pas en diagonale — ce sont les quatre coins, et
// c'est eux qui donnent 52 plutôt que 48.
//
// LE PLATEAU EST FIXE, LE NOMBRE DE JOUEURS NE FAIT QUE REMPLIR DES SIÈGES.
// Un plateau de Ludo physique est imprimé une fois pour toutes : quatre bras,
// quatre cases de départ, quatre colonnes maison, quatre zones d'attente. Une
// partie à deux ou trois joueurs n'enlève rien — elle laisse des bras vides.
// C'est pour ça que la géométrie classique ignore `playerCount` : elle décrit
// la table, pas la partie.
//
// L'ordre de parcours est calé pour que la case 0 soit le COIN de départ du
// bras de gauche, comme sur le plateau d'origine : les quatre coins d'entrée
// tombent alors en 0, 13, 26 et 39, à deux cases du bout de leur bras. Chaque
// départ est sur le côté de son bras qui fait face au centre, à hauteur de la
// case la plus à l'extérieur — pas au milieu du bras, ce qui était le défaut
// de la version précédente pour les tables à deux et trois joueurs.

/** Le premier siège du plateau hexagonal pointe vers -z. */
const FIRST_SEAT_ANGLE_DEG = -90;
/**
 * Pas d'une case. Voluntaryment le même que sur le plateau hexagonal :
 * les tuiles font la même taille sur les deux plateaux.
 */
const HOME_STEP = 0.84;
/** Rayons (en cases) des 6 cases de colonne maison, du bord vers le centre. */
const CLASSIC_LANE_RADII = [6, 5, 4, 3, 2, 1];
/**
 * Les quatre coins de départ, dans l'ordre des bras : gauche, haut, droite,
 * bas. Ces indices appartiennent au PLATEAU — ils ne dépendent pas du nombre
 * de joueurs, c'est tout l'intérêt d'une croix fixe.
 */
const CLASSIC_ARM_OFFSETS = [0, 13, 26, 39] as const;
/**
 * Direction de chaque bras, alignée sur sa colonne maison. Ce sont les axes du
 * plateau d'origine : le bras de gauche tire vers -x (colonne -6..-1 en z=0),
 * celui du haut vers -z, celui de la droite vers +x, celui du bas vers +z.
 */
const CLASSIC_ARM_ANGLE_DEG = [180, -90, 0, 90] as const;
/**
 * Distance d'un coin de départ à son étoile, en cases d'anneau. Huit cases
 * après 0/13/26/39 donnent 8/21/34/47 — exactement les étoiles du plateau à
 * quatre joueurs livré (cases sûres [8, 21, 34, 47]), donc une par bras à
 * peu près en son milieu et un contrat logique inchangé par rapport à
 * l'original.
 */
const CLASSIC_STAR_OFFSET = 8;
/**
 * Bras occupés selon la taille de la table. Les coins 0 et 26 sont opposés
 * (gauche et droite) : c'est le duel que fait un plateau à deux joueurs, dont
 * les deux chemins se font face. À trois joueurs, c'est le bras du bas qui
 * reste vide.
 */
const CLASSIC_OCCUPIED_ARMS: Readonly<Record<number, readonly number[]>> = {
  2: [0, 26],
  3: [0, 13, 26],
  4: [0, 13, 26, 39],
};
/** Largeur visuelle commune des plaques de base, en unités de case. */
export const BASE_HALF_SIZE = 2.15;
/** Écart entre les quatre anneaux d'une plaque 2 × 2. */
export const BASE_SLOT_SPAN = 1.05;
/** Distance des centres de base au centre du plateau, selon sa forme. */
const CLASSIC_BASE_RADIUS = 4.15 * Math.SQRT2;
const HEX_BASE_RADIUS = 7.15;

/**
 * Place une base dans le secteur entre deux bras voisins.
 *
 * Le demi-pas angulaire (`π / armCount`) est la règle commune aux plateaux :
 * 45° pour la croix, 30° pour l'hexagone. Les plaques restent alignées sur
 * les axes du monde afin que les noms restent horizontaux et lisibles.
 */
function sectorBase(
  armAngle: number,
  armCount: number,
  radius: number,
): BoardPoint[] {
  const center = polar(
    ((armAngle + Math.PI / armCount) * 180) / Math.PI,
    radius,
  );

  return [-BASE_SLOT_SPAN, BASE_SLOT_SPAN].flatMap((x) =>
    [-BASE_SLOT_SPAN, BASE_SLOT_SPAN].map((z) => ({
      x: center.x + x,
      z: center.z + z,
    })),
  );
}

/**
 * Les 52 cases de la croix, dans l'ordre de parcours. Les coordonnées sont
 * en cases entières : un pas, c'est une unité.
 */
const CLASSIC_RING_GRID: readonly (readonly [number, number])[] = [
  // Coin du bras de gauche : la case de départ de la première couleur, posée
  // sur la rangée la plus à l'extérieur, puis les six cases qui montent vers
  // le coin suivant.
  [-6, -1], [-5, -1], [-4, -1], [-3, -1], [-2, -1],
  [-1, -2], [-1, -3], [-1, -4], [-1, -5], [-1, -6], [-1, -7],
  // Bout du bras du haut, puis son côté droit jusqu'au centre.
  [0, -7], [1, -7],
  // Coin du bras du haut : case de départ, puis les six cases vers le centre.
  [1, -6], [1, -5], [1, -4], [1, -3], [1, -2],
  // Coin, puis le côté haut du bras de droite jusqu'à son bout.
  [2, -1], [3, -1], [4, -1], [5, -1], [6, -1], [7, -1],
  [7, 0],
  // Côté bas du bras de droite, jusqu'à son coin de départ.
  [7, 1], [6, 1], [5, 1], [4, 1], [3, 1], [2, 1],
  // Coin, puis le côté droit du bras du bas.
  [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7],
  [0, 7],
  // Côté gauche du bras du bas, jusqu'à son coin de départ.
  [-1, 7], [-1, 6], [-1, 5], [-1, 4], [-1, 3], [-1, 2],
  // Coin, puis le côté bas du bras de gauche jusqu'à son bout.
  [-2, 1], [-3, 1], [-4, 1], [-5, 1], [-6, 1], [-7, 1],
  [-7, 0],
  // Côté haut du bras de gauche : la fermeture de l'anneau, une case avant
  // de retomber sur le départ.
  [-7, -1],
];

const CLASSIC_RING: readonly BoardPoint[] = CLASSIC_RING_GRID.map(
  ([gridX, gridZ]) => ({ x: gridX * HOME_STEP, z: gridZ * HOME_STEP }),
);

function polar(angleDeg: number, radius: number): BoardPoint {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.cos(rad), z: radius * Math.sin(rad) };
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

/** Plateau classique : 2 à 4 joueurs, une croix fixe à quatre bras. */
function createClassicTrack(playerCount: number): LudoTrack {
  const ring = CLASSIC_RING;

  // Les cases sûres appartiennent au PLATEAU, pas aux joueurs assis : un bras
  // vide garde son départ et son étoile, comme sur un plateau imprimé. C'est
  // la différence entre une croix de Ludo physique et un anneau recalculé à
  // chaque partie. À quatre joueurs on retrouve exactement les huit cases
  // d'avant : 0/7, 13/20, 26/33 et 39/46.
  const safeCells = new Set<number>();
  for (const armOffset of CLASSIC_ARM_OFFSETS) {
    safeCells.add(armOffset);
    safeCells.add((armOffset + CLASSIC_STAR_OFFSET) % RING_LENGTH);
  }

  const occupiedArms = CLASSIC_OCCUPIED_ARMS[playerCount];
  if (!occupiedArms) {
    throw new Error(`Unsupported classic Ludo table size ${playerCount}`);
  }

  const arms: LudoArm[] = [];
  const seats: LudoSeat[] = [];
  const byColor = new Map<LudoColor, LudoSeat>();

  // On parcourt les quatre bras du plateau, pas les joueurs : c'est ce qui
  // garantit qu'un bras vide existe réellement dans la géométrie. Les
  // couleurs suivent ensuite l'ordre des bras occupés, ce qui maintient le
  // siège 0 du plateau sur le siège 0 du salon.
  CLASSIC_ARM_OFFSETS.forEach((armOffset, armIndex) => {
    const angleDeg = CLASSIC_ARM_ANGLE_DEG[armIndex];
    const angleRad = (angleDeg * Math.PI) / 180;
    const start = ring[armOffset];

    // La colonne maison descend l'axe du bras et la zone d'attente est
    // derrière son bout : les deux suivent l'orientation du bras, donc aucune
    // coordonnée n'est écrite en dur par joueur.
    const homeColumn = CLASSIC_LANE_RADII.map((r) =>
      polar(angleDeg, r * HOME_STEP),
    );
    const base = sectorBase(
      angleRad,
      CLASSIC_ARM_OFFSETS.length,
      CLASSIC_BASE_RADIUS,
    );

    const seatNumber = occupiedArms.indexOf(armOffset);
    let seat: LudoSeat | null = null;
    if (seatNumber !== -1) {
      const color = LUDO_PALETTE[seatNumber];
      seat = {
        seat: seatNumber,
        color,
        offset: armOffset,
        angle: angleRad,
        homeColumn,
        base,
        start,
      };
      seats[seatNumber] = seat;
      byColor.set(color, seat);
    }

    arms.push({ offset: armOffset, angle: angleRad, homeColumn, base, start, seat });
  });

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
    colors: seats.map((s) => s.color),
    seats,
    arms,
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

  // Comme sur la croix classique, les six bras du plateau existent tous : une
  // table à cinq joueurs garde un bras vide, départ et étoile compris.
  const arms: LudoArm[] = [];
  const seats: LudoSeat[] = [];
  const byColor = new Map<LudoColor, LudoSeat>();
  for (let arm = 0; arm < HEX_ARM_COUNT; arm += 1) {
    const offset = arm * HEX_ARM_LENGTH;
    const angleRad = hexArmAngleRad(arm);

    // 6 cases : de y = 5 jusqu'à y = 1, puis y = 0, juste avant le centre.
    const homeColumn: BoardPoint[] = [5, 4, 3, 2, 1, 0].map((y) =>
      hexLocalToWorld(arm, 0, y),
    );
    const base = sectorBase(angleRad, HEX_ARM_COUNT, HEX_BASE_RADIUS);

    let seat: LudoSeat | null = null;
    if (arm < playerCount) {
      const color = LUDO_PALETTE[arm];
      seat = { seat: arm, color, offset, angle: angleRad, homeColumn, base, start: ring[offset] };
      seats.push(seat);
      byColor.set(color, seat);
    }

    arms.push({ offset, angle: angleRad, homeColumn, base, start: ring[offset], seat });
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
    arms,
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
