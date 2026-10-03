"use client";

import type { PublicGamerProfileView } from "@/lib/profile/read-model";
import { XP_PER_LEVEL } from "@/lib/db/schema/profiles";

function formatPlayTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** Bandeau des statistiques globales : niveau + progression XP, puis 4 indicateurs clés. */
export function ProfileStatsStrip({ data }: { data: PublicGamerProfileView }) {
  const xpInLevel = data.xp % XP_PER_LEVEL;
  const progress = Math.min(100, Math.round((xpInLevel / XP_PER_LEVEL) * 100));
  const winRate = Math.max(0, Math.min(100, Number(data.winRate) || 0));

  return (
    <section
      aria-label="Statistiques globales"
      className="mt-6 grid overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-[300px_1fr] dark:border-white/10 dark:bg-[#0b0f17]"
    >
      {/* Niveau */}
      <div className="flex flex-col justify-center gap-4 border-b border-slate-200 p-5 lg:border-b-0 lg:border-r dark:border-white/10">
        <div className="flex items-center gap-4">
          <div
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-2xl font-bold tabular-nums text-cyan-700 ring-1 ring-inset ring-cyan-500/30 dark:text-cyan-300"
          >
            {data.level}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-500 dark:text-white/45">Niveau</p>
            <p className="text-lg font-semibold">Niveau {data.level}</p>
          </div>
        </div>

        <div>
          <div
            role="progressbar"
            aria-label="Progression vers le niveau suivant"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
          >
            <div
              className="h-full rounded-full bg-cyan-500 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 flex justify-between text-xs tabular-nums text-slate-500 dark:text-white/40">
            <span>
              {xpInLevel} / {XP_PER_LEVEL} XP
            </span>
            <span>{data.xpToNextLevel} XP restants</span>
          </p>
        </div>
      </div>

      {/* Indicateurs */}
      <dl className="grid grid-cols-2 divide-slate-200 sm:grid-cols-4 sm:divide-x dark:divide-white/10">
        <StatCell label="Rating" value={String(data.rating)} />
        <StatCell label="Parties jouées" value={String(data.gamesPlayed)} />
        <StatCell label="Taux de victoire" value={`${data.winRate} %`}>
          <div
            aria-hidden
            className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
          >
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${winRate}%` }}
            />
          </div>
        </StatCell>
        <StatCell label="Temps de jeu" value={formatPlayTime(data.totalPlaySeconds)} />
      </dl>
    </section>
  );
}

function StatCell({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-center border-t border-slate-200 p-5 sm:border-t-0 [&:nth-child(-n+2)]:border-t-0 dark:border-white/10">
      <dt className="text-sm text-slate-500 dark:text-white/45">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {children}
    </div>
  );
}