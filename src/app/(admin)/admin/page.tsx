import type { Metadata } from "next";

import DashboardShell01 from "@/components/shadcn-dashboard/blocks/dashboardshell/dashboard-shell-01";
import type { PlatformTrendData } from "@/components/shadcn-dashboard/blocks/dashboardshell/dashboard-shell-01/TotalSalesCode";
import { getAdminOverview } from "@/lib/admin/queries";
import {
  getMetricTrend,
  getRecentMatches,
  getWeeklyStats,
  getWeeklyComparison,
} from "@/lib/admin/queries";
import { requireAdminSession } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Administration",
};

/**
 * The /admin dashboard — the shadcn-dashboard registry shell fed ONLY
 * with real numbers. Every tile's value comes from lib/admin/queries:
 * PostgreSQL counters, per-day series with real previous-span deltas,
 * and the actual latest ingested results. No demo rows anywhere.
 */
export default async function AdminDashboardPage() {
  // Guard FIRST: a redirect emitted here carries no payload, so the
  // metrics below can never leak into an unauthorized response.
  const session = await requireAdminSession();

  const [overview, weekly, comparison, trend7, trend30, trend90, recent] =
    await Promise.all([
      getAdminOverview(),
      getWeeklyStats(),
      getWeeklyComparison(),
      getMetricTrend("matches", 7),
      getMetricTrend("matches", 30),
      getMetricTrend("matches", 90),
      getRecentMatches(10),
    ]);

  // The chart's second series (new accounts per day) — three small
  // queries sharing the same span boundaries as the matches series.
  const [accounts7, accounts30, accounts90] = await Promise.all([
    getMetricTrend("accounts", 7),
    getMetricTrend("accounts", 30),
    getMetricTrend("accounts", 90),
  ]);

  const trend: PlatformTrendData = {
    periods: {
      "Last 7 Days": {
        rows: trend7.days.map((day, index) => ({
          date: day.date,
          label: day.label,
          matches: day.count,
          accounts: accounts7.days[index]?.count ?? 0,
        })),
        total: trend7.total,
        changePercent: trend7.changePercent,
      },
      "Last 30 Days": {
        rows: trend30.days.map((day, index) => ({
          date: day.date,
          label: day.label,
          matches: day.count,
          accounts: accounts30.days[index]?.count ?? 0,
        })),
        total: trend30.total,
        changePercent: trend30.changePercent,
      },
      "Last 90 Days": {
        rows: trend90.days.map((day, index) => ({
          date: day.date,
          label: day.label,
          matches: day.count,
          accounts: accounts90.days[index]?.count ?? 0,
        })),
        total: trend90.total,
        changePercent: trend90.changePercent,
      },
    },
  };

  const matchesChange =
    comparison.matchesLastWeek === 0
      ? null
      : Math.round(
          ((comparison.matchesThisWeek - comparison.matchesLastWeek) /
            comparison.matchesLastWeek) *
            100,
        );
  const accountsChange =
    comparison.accountsLastWeek === 0
      ? null
      : Math.round(
          ((comparison.accountsThisWeek - comparison.accountsLastWeek) /
            comparison.accountsLastWeek) *
            100,
        );

  return (
    <DashboardShell01
      userName={session.user.name}
      overview={overview}
      weekly={{
        matches: comparison.matchesThisWeek,
        matchesLastWeek: comparison.matchesLastWeek,
        changePercent: matchesChange,
      }}
      weeklyAccounts={{
        accounts: comparison.accountsThisWeek,
        changePercent: accountsChange,
      }}
      activeGamers={weekly.activeGamers}
      trend={trend}
      recentMatches={recent}
    />
  );
}
