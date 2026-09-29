import type { Metadata } from "next";

import { getAdminOverview } from "@/lib/admin/queries";

export const metadata: Metadata = {
  title: "Administration",
};

/**
 * Phase 1 dashboard — real numbers only, one database roundtrip. Later
 * phases extend this page (charts, queues, live section links); the
 * metric tiles below stay the base vocabulary.
 */
export default async function AdminDashboardPage() {
  const overview = await getAdminOverview();

  const metrics = [
    { label: "Comptes", value: overview.totalUsers, hint: "utilisateurs inscrits" },
    { label: "Profils gamers", value: overview.totalGamers, hint: "profils créés" },
    { label: "Jeux au catalogue", value: overview.totalGames, hint: "registre plateforme" },
    { label: "Matchs joués", value: overview.totalMatches, hint: "résultats ingérés" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-950 dark:text-white">
          Tableau de bord
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-white/60">
          Vue d&apos;ensemble de la plateforme — données réelles, mises à jour
          à chaque chargement.
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5"
          >
            <dt className="text-sm text-slate-500 dark:text-white/60">
              {metric.label}
            </dt>
            <dd className="mt-2">
              <span className="text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
                {metric.value.toLocaleString("fr-FR")}
              </span>
              <span className="ml-2 text-xs text-slate-400 dark:text-white/40">
                {metric.hint}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="text-xs text-slate-400 dark:text-white/40">
        Gestion des utilisateurs, matchs en direct et modération : à venir
        dans les prochaines phases de l&apos;administration.
      </p>
    </div>
  );
}
