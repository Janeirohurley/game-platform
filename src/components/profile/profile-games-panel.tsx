"use client";

import type { PublicGameStatsView } from "@/lib/profile/read-model";

/**
 * Per-game panel — one row per game from game_stats, no per-game
 * special cases anywhere. A game the player never touched simply has
 * no row; the panel says so without inventing anything.
 */
export function ProfileGamesPanel({ games }: { games: PublicGameStatsView[] }) {
  return (
    <section
      aria-label="Statistiques par jeu"
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.025]"
    >
      <h2 className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
        Jeux
      </h2>

      {games.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-white/40">
          Aucune partie en ligne jouée pour l&apos;instant. Les statistiques
          arrivent dès la première partie terminée.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-white/[0.06]">
          {games.map((game) => (
            <li
              key={game.gameId}
              className="flex items-center justify-between gap-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{game.title}</p>
                <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-white/40">
                  {game.gamesPlayed} partie{game.gamesPlayed > 1 ? "s" : ""} ·{" "}
                  {game.winRate} % de victoires
                  {game.bestStreak > 1 ? ` · série ${game.bestStreak}` : ""}
                </p>
              </div>

              <p className="shrink-0 text-lg font-semibold tabular-nums text-cyan-600 dark:text-cyan-300">
                {game.rating}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
