"use client";

import type { PublicActivityView } from "@/lib/profile/read-model";

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return new Intl.DateTimeFormat("fr", { dateStyle: "medium" }).format(date);
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "";
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return `${seconds} s`;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * Recent activity — straight rows from game_matches, the real matches
 * the ingestion path recorded. Nothing here is synthesised: a match
 * appears exactly when it was played on the server.
 */
export function ProfileActivityPanel({
  activity,
}: {
  activity: PublicActivityView[];
}) {
  return (
    <section
      aria-label="Activité récente"
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.025]"
    >
      <h2 className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
        Activité récente
      </h2>

      {activity.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-white/40">
          Aucune partie récente. Les résultats apparaissent ici dès la
          première partie terminée.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-white/[0.06]">
          {activity.map((match) => (
            <li
              key={match.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`h-8 w-1 shrink-0 rounded-full ${
                    match.outcome === "win"
                      ? "bg-emerald-500"
                      : match.outcome === "loss"
                        ? "bg-rose-500"
                        : "bg-slate-300 dark:bg-white/20"
                  }`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <span className="capitalize">{match.gameId}</span>
                    {" · "}
                    {match.outcome === "win"
                      ? "Victoire"
                      : match.outcome === "loss"
                        ? "Défaite"
                        : "Match nul"}
                    {match.opponentTags.length > 0
                      ? ` contre @${match.opponentTags[0]}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-white/30">
                    {match.playerCount} joueurs
                    {formatDuration(match.durationSeconds)
                      ? ` · ${formatDuration(match.durationSeconds)}`
                      : ""}
                    {match.ratingDelta !== 0
                      ? ` · rating ${
                          match.ratingDelta > 0 ? "+" : ""
                        }${match.ratingDelta}`
                      : ""}
                  </p>
                </div>
              </div>

              <time
                dateTime={match.playedAt.toISOString()}
                className="shrink-0 text-xs tabular-nums text-slate-400 dark:text-white/30"
              >
                {relativeTime(match.playedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
