/**
 * Platform-side game registry — the single source of truth for the
 * games catalog (`/games`), routes and card visuals.
 *
 * Mirrors `server-games/src/games/registry.ts` (realtime rooms) and the
 * implementations under `src/games/*`. Adding a game to the platform =
 *   1. implement the game module under `src/games/<id>`,
 *   2. register its realtime room on the Colyseus server,
 *   3. add one entry here.
 * The catalog page renders whatever this registry contains — nothing
 * is hardcoded in the page anymore.
 */

export const GAME_CATEGORIES = [
  "Board",
  "Arcade",
  "Strategy",
  "Racing",
  "Puzzle",
] as const;

export type GameCategory = (typeof GAME_CATEGORIES)[number];

export type GameStatus = "live" | "coming-soon";

export interface GameEntry {
  /** Stable id — matches the realtime room name on the Colyseus server. */
  id: string;
  /** Route segment under /games. */
  slug: string;
  title: string;
  description: string;
  category: GameCategory;
  /** Player bounds for the realtime rooms (mirrors the server registry). */
  minPlayers: number;
  maxPlayers: number;
  /**
   * Table sizes the game supports (mirrors the server registry). The
   * room creator picks a capacity among these — nothing else is valid.
   */
  allowedPlayerCounts?: readonly number[];
  status: GameStatus;
  /** Whether /games/<slug>/play (online rooms) is available. */
  playableOnline: boolean;
  /** Card image path under /public (optional — gradient fallback when absent). */
  image?: string;
  /** Two-letter monogram used when no image is available. */
  icon?: string;
  /** Tailwind gradient for the fallback visual. */
  accent?: string;
  glow?: string;
}

/**
 * Every registered game id, as a tuple type + runtime list. Used by the
 * database layer (game_stats/achievements/game_matches CHECKs and
 * foreign-ish validation) so a gameId can only ever be one the registry
 * knows. Add a game above and this follows automatically.
 */
export const GAME_IDS = ["ludo", "checkers", "rally", "tetris"] as const;

export type GameId = (typeof GAME_IDS)[number];

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}

export const GAMES: readonly GameEntry[] = [
  {
    id: "ludo",
    slug: "ludo",
    title: "Ludo",
    description:
      "The classic race-to-home board game — play locally or in realtime online rooms with 2 to 6 players.",
    category: "Board",
    minPlayers: 2,
    // Six is the size of the client colour palette in
    // `games/ludo/data/track.ts` (LUDO_PALETTE). Must stay equal to
    // the server's `maxPlayers` for the Ludo entry — the two registries
    // are hand-duplicated across separate repositories, so a table the
    // client offers but the server refuses would only fail at creation.
    maxPlayers: 6,
    allowedPlayerCounts: [2, 3, 4, 5, 6],
    status: "live",
    playableOnline: true,
    image: "/ludo.jpg",
    icon: "LU",
    accent: "from-cyan-400 via-sky-500 to-blue-700",
    glow: "bg-cyan-400/20",
  },
  {
    id: "checkers",
    slug: "checkers",
    title: "Checkers",
    description:
      "Le jeu de dames classique — capture obligatoire, rafles et promotion en dame. À deux sur un écran ou en ligne.",
    category: "Strategy",
    minPlayers: 2,
    maxPlayers: 2,
    status: "live",
    playableOnline: true,
    image: "/checkers.jpg",
    icon: "CH",
    accent: "from-amber-300 via-orange-500 to-rose-700",
    glow: "bg-amber-400/20",
  },
  {
    "id" : "tetris",
    "slug" : "tetris",
    "title" : "Tetris",
    "description" : "Le jeu de tetris classique — empilez les pièces et nettoyez les lignes.",
    "category" : "Arcade",
    "minPlayers" : 2,
    "maxPlayers" : 10,
    "allowedPlayerCounts" : [2, 3, 4, 5, 6, 7, 8, 9, 10],
    "status" : "live",
    "playableOnline" : true,
    "icon" : "TE",
    "image" : "/tetris.png",
    "accent" : "from-purple-300 via-pink-500 to-rose-700",
    "glow" : "bg-purple-400/20"
  },
  {
    id: "rally",
    slug: "rally",
    title: "Rally",
    description:
      "Tennis de table — seul contre l'ordinateur sur trois niveaux, ou à deux en ligne. Premier à 11 points.",
    category: "Arcade",
    minPlayers: 1,
    maxPlayers: 2,
    status: "live",
    playableOnline: true,
    image: "/Rally.jpg",
    icon: "RA",
    accent: "from-orange-300 via-red-500 to-emerald-800",
    glow: "bg-orange-400/20",
  },
] as const;

/** All catalog entries, newest additions last. */
export function listGames(): GameEntry[] {
  return [...GAMES];
}

export function getGameBySlug(slug: string): GameEntry | undefined {
  return GAMES.find((game) => game.slug === slug);
}

export function getGameById(id: string): GameEntry | undefined {
  return GAMES.find((game) => game.id === id);
}

/** Distinct categories present in the registry, for the filter row. */
export function listCategories(): GameCategory[] {
  return [...new Set(GAMES.map((game) => game.category))];
}

/**
 * True when the game is open to everyone. Anything else (e.g.
 * "coming-soon") hides it from matchmaking and blocks its play routes.
 */
export function isGameLive(slug: string): boolean {
  return getGameBySlug(slug)?.status === "live";
}

/**
 * True when the online rooms of a game can be created and joined.
 * A game can be live locally while its realtime rooms stay closed.
 */
export function isGamePlayableOnline(slug: string): boolean {
  const game = getGameBySlug(slug);
  return Boolean(game && game.status === "live" && game.playableOnline);
}
