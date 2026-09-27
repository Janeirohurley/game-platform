"use client";

import type { PublicAchievementView } from "@/lib/profile/read-model";

/**
 * Achievements grid — locked items stay visible and greyed so the
 * panel doubles as a progress overview. Unlocks come exclusively from
 * real matches (see progression.ts); the page only reads.
 */
export function ProfileAchievementsPanel({
  achievements,
}: {
  achievements: PublicAchievementView[];
}) {
  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <section
      aria-label="Achievements"
      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.025]"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-[0.16em] text-slate-400 dark:text-white/30">
          Achievements
        </h2>
        <p className="text-xs tabular-nums text-slate-400 dark:text-white/30">
          {unlockedCount}/{achievements.length}
        </p>
      </div>

      {achievements.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-white/40">
          Le catalogue d&apos;achievements n&apos;est pas encore disponible.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {achievements.map((achievement) => {
            const unlocked = Boolean(achievement.unlockedAt);
            return (
              <li
                key={achievement.code}
                title={achievement.description}
                className={`rounded-xl border px-3 py-3 ${
                  unlocked
                    ? "border-cyan-200 bg-cyan-50/60 dark:border-cyan-400/20 dark:bg-cyan-400/[0.06]"
                    : "border-slate-200 bg-slate-50/60 dark:border-white/[0.06] dark:bg-white/[0.02]"
                }`}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-lg text-sm font-semibold ${
                    unlocked
                      ? "bg-cyan-500 text-white"
                      : "bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-white/30"
                  }`}
                >
                  {achievement.icon}
                </span>
                <p
                  className={`mt-2 text-xs font-semibold leading-tight ${
                    unlocked
                      ? ""
                      : "text-slate-400 dark:text-white/35"
                  }`}
                >
                  {achievement.name}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-slate-400 dark:text-white/30">
                  {achievement.description}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
