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

export const GAMES: readonly GameEntry[] = [
  {
    id: "ludo",
    slug: "ludo",
    title: "Ludo",
    description:
      "The classic race-to-home board game — play locally or in realtime online rooms with 2 to 4 players.",
    category: "Board",
    minPlayers: 2,
    maxPlayers: 4,
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
    icon: "CH",
    accent: "from-amber-300 via-orange-500 to-rose-700",
    glow: "bg-amber-400/20",
  },
  {
    id: "rally",
    slug: "rally",
    title: "Rally",
    description:
      "Tennis de table contre l'ordinateur — trois niveaux, coups puissants et échanges qui s'accélèrent. Premier à 11.",
    category: "Arcade",
    minPlayers: 1,
    maxPlayers: 1,
    status: "live",
    // Solo against the computer: no realtime room for this one.
    playableOnline: false,
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
