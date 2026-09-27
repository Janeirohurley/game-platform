"use client";

import type { PublicGamerProfileView } from "@/lib/profile/read-model";
import { XP_PER_LEVEL } from "@/lib/db/schema/profiles";

function formatPlayTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** Dense global-stats strip under the header — the "Niveau / Rating / Parties / Win rate" line. */
export function ProfileStatsStrip({ data }: { data: PublicGamerProfileView }) {
  const xpInLevel = data.xp % XP_PER_LEVEL;

  return (
    <section
      aria-label="Statistiques globales"
      className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-5 dark:border-white/10 dark:bg-white/10"
    >
      {/* Level + XP progress — the only cell with a second line. */}
      <div className="col-span-2 bg-white p-4 sm:col-span-1 dark:bg-[#0b0f17]">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
          Niveau
        </p>
        <p className="mt-1 text-xl font-semibold tabular-nums">
          {data.level}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-cyan-500"
            style={{
              width: `${Math.min(100, Math.round((xpInLevel / XP_PER_LEVEL) * 100))}%`,
            }}
          />
        </div>
        <p className="mt-1 text-[11px] tabular-nums text-slate-400 dark:text-white/30">
          {data.xp} / {data.xp + data.xpToNextLevel} XP
        </p>
      </div>

      <StatCell label="Rating" value={String(data.rating)} />
      <StatCell label="Parties" value={String(data.gamesPlayed)} />
      <StatCell label="Win rate" value={`${data.winRate} %`} />
      <StatCell
        label="Temps de jeu"
        value={formatPlayTime(data.totalPlaySeconds)}
      />
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4 dark:bg-[#0b0f17]">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
