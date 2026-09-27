/**
 * Achievement catalogue — static reference data.
 *
 * Rows are upserted into the `achievements` table by
 * `ensureAchievementCatalogue()` (queries.ts) and unlocked exclusively
 * from real match results by `applyAchievements()` (progression.ts).
 * A profile view NEVER unlocks anything: achievements come from games
 * actually played, nothing else.
 *
 * Adding an achievement:
 *   1. append an entry here (stable `code`, never rename one),
 *   2. if it needs a rule, extend `ACHIEVEMENT_RULES` in progression.ts
 *      — the catalogue only describes; progression decides.
 *
 * `gameId: null` = global (counts any game); otherwise the id must be
 * one of the registry's GAME_IDS — the DB check enforces it too.
 */

export interface AchievementSeed {
    code: string;
    name: string;
    description: string;
    icon: string;
    gameId: string | null;
    sortOrder: number;
}

export const ACHIEVEMENT_SEEDS: readonly AchievementSeed[] = [
    {
        code: "first-win",
        name: "Première victoire",
        description: "Remporter ta première partie en ligne.",
        icon: "①",
        gameId: null,
        sortOrder: 10,
    },
    {
        code: "ten-matches",
        name: "Habitué",
        description: "Jouer 10 parties en ligne.",
        icon: "10",
        gameId: null,
        sortOrder: 20,
    },
    {
        code: "fifty-matches",
        name: "Vétéran",
        description: "Jouer 50 parties en ligne.",
        icon: "50",
        gameId: null,
        sortOrder: 21,
    },
    {
        code: "hundred-matches",
        name: "Centurion",
        description: "Jouer 100 parties en ligne.",
        icon: "100",
        gameId: null,
        sortOrder: 22,
    },
    {
        code: "streak-3",
        name: "En feu",
        description: "Remporter 3 parties d'affilée.",
        icon: "✦",
        gameId: null,
        sortOrder: 30,
    },
    {
        code: "streak-10",
        name: "Série de 10",
        description: "Remporter 10 parties d'affilée.",
        icon: "✸",
        gameId: null,
        sortOrder: 31,
    },
    {
        code: "ludo-25",
        name: "Connaisseur de Ludo",
        description: "Jouer 25 parties de Ludo.",
        icon: "LU",
        gameId: "ludo",
        sortOrder: 50,
    },
    {
        code: "checkers-25",
        name: "Connaisseur de Dames",
        description: "Jouer 25 parties de Dames.",
        icon: "CH",
        gameId: "checkers",
        sortOrder: 51,
    },
];
