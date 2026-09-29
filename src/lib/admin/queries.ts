/**
 * Admin queries — the database access layer for the /admin control plane.
 *
 * Server-only, same discipline as `lib/profile/queries.ts`: imported by
 * admin server components/actions only, never reachable from a client
 * bundle. Every admin feature adds its query here instead of querying
 * from a component.
 */

import { and, count, countDistinct, desc, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { gameMatches, profiles } from "@/lib/db/schema/profiles";
import { GAMES, getGameById } from "@/lib/games/registry";

/** Everything the dashboard header shows — all of it real data. */
export interface AdminOverview {
  totalUsers: number;
  totalGamers: number;
  totalGames: number;
  totalMatches: number;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [users, gamers, matches] = await Promise.all([
    db.select({ value: count() }).from(user),
    db.select({ value: count() }).from(profiles),
    db.select({ value: count() }).from(gameMatches),
  ]);

  return {
    totalUsers: users[0]?.value ?? 0,
    totalGamers: gamers[0]?.value ?? 0,
    // The registry IS the games catalogue (schema/design decision of the
    // platform): its length is the real count, no games table exists.
    totalGames: GAMES.length,
    totalMatches: matches[0]?.value ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Weekly activity — matches per day over the last 7 days.
// Days without a match are filled with zero so the chart is honest about
// inactivity instead of collapsing the time axis.
// ---------------------------------------------------------------------------

export interface AdminDailyActivity {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Short weekday label (fr), e.g. « lun. ». */
  label: string;
  count: number;
}

/** Local-date key — NOT toISOString(), which would shift the day (UTC). */
function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export async function getWeeklyMatchActivity(): Promise<AdminDailyActivity[]> {
  return getMatchesPerDay(7);
}

/**
 * Matches per day over the last `days` days (server-local calendar),
 * zero-filled. Powers the dashboard chart at 7/30/90-day spans from ONE
 * query.
 */
export async function getMatchesPerDay(days: number): Promise<AdminDailyActivity[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${gameMatches.playedAt}), 'YYYY-MM-DD')`,
      matches: count(),
    })
    .from(gameMatches)
    .where(gte(gameMatches.playedAt, since))
    .groupBy(sql`date_trunc('day', ${gameMatches.playedAt})`);

  const byDay = new Map(rows.map((row) => [row.day, Number(row.matches)]));
  const label = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  });

  const series: AdminDailyActivity[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const key = dayKey(day);
    series.push({
      date: key,
      label: label.format(day),
      count: byDay.get(key) ?? 0,
    });
  }
  return series;
}

// ---------------------------------------------------------------------------
// Seven-day stats — new accounts and gamers who actually played.
// ---------------------------------------------------------------------------

export interface AdminWeeklyStats {
  newAccounts: number;
  activeGamers: number;
}

export async function getWeeklyStats(): Promise<AdminWeeklyStats> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);

  const [accounts, active] = await Promise.all([
    db
      .select({ value: count() })
      .from(user)
      .where(gte(user.createdAt, since)),
    db
      .select({ value: countDistinct(gameMatches.userId) })
      .from(gameMatches)
      .where(gte(gameMatches.playedAt, since)),
  ]);

  return {
    newAccounts: accounts[0]?.value ?? 0,
    activeGamers: active[0]?.value ?? 0,
  };
}

/**
 * This week vs the previous one — feeds the trend badges of the stat
 * cards with REAL deltas (null percentage when the previous week is 0:
 * a change from nothing is not a percentage).
 */
export interface AdminWeeklyComparison {
  matchesThisWeek: number;
  matchesLastWeek: number;
  accountsThisWeek: number;
  accountsLastWeek: number;
}

export async function getWeeklyComparison(): Promise<AdminWeeklyComparison> {
  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setHours(0, 0, 0, 0);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - 6);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const [matchesNow, matchesPrev, accountsNow, accountsPrev] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(gameMatches)
        .where(gte(gameMatches.playedAt, startOfThisWeek)),
      db
        .select({ value: count() })
        .from(gameMatches)
        .where(gte(gameMatches.playedAt, startOfLastWeek)),
      db
        .select({ value: count() })
        .from(user)
        .where(gte(user.createdAt, startOfThisWeek)),
      db
        .select({ value: count() })
        .from(user)
        .where(gte(user.createdAt, startOfLastWeek)),
    ]);

  return {
    matchesThisWeek: matchesNow[0]?.value ?? 0,
    matchesLastWeek: matchesPrev[0]?.value ?? 0,
    accountsThisWeek: accountsNow[0]?.value ?? 0,
    accountsLastWeek: accountsPrev[0]?.value ?? 0,
  };
}

/**
 * A metric span for the trend chart: current window series + how the
 * window total compares to the PREVIOUS window of equal length — the
 * « +x % vs période précédente » badge is computed, not invented.
 */
export interface AdminTrendSeries {
  days: AdminDailyActivity[];
  total: number;
  previousTotal: number;
  /** Percent change vs previous span; null when there is no baseline. */
  changePercent: number | null;
}

async function countInWindow(
  table: typeof gameMatches | typeof user,
  column: "playedAt" | "createdAt",
  from: Date,
  to: Date,
): Promise<number> {
  const range =
    column === "playedAt"
      ? gameMatches.playedAt
      : user.createdAt;
  const rows = await db
    .select({ value: count() })
    .from(table)
    .where(and(gte(range, from), lt(range, to)));
  return rows[0]?.value ?? 0;
}

/**
 * Daily series + current-vs-previous totals for one metric over one
 * span (7, 30 or 90 days). Three queries, no fabrication.
 */
export async function getMetricTrend(
  metric: "matches" | "accounts",
  days: 7 | 30 | 90,
): Promise<AdminTrendSeries> {
  const table = metric === "matches" ? gameMatches : user;
  const column = metric === "matches" ? "playedAt" : "createdAt";

  const currentStart = new Date();
  currentStart.setHours(0, 0, 0, 0);
  currentStart.setDate(currentStart.getDate() - (days - 1));
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);

  const [series, currentTotal, previousTotal] = await Promise.all([
    metric === "matches"
      ? getMatchesPerDay(days)
      : getAccountsPerDay(days),
    countInWindow(table, column, currentStart, new Date()),
    countInWindow(table, column, previousStart, currentStart),
  ]);

  const changePercent =
    previousTotal === 0 ? null : Math.round(((currentTotal - previousTotal) / previousTotal) * 100);

  return { days: series, total: currentTotal, previousTotal, changePercent };
}

/**
 * New accounts per day over the last `days` days (zero-filled) — the
 * second series of the dashboard trend chart, same shape as matches.
 */
export async function getAccountsPerDay(days: number): Promise<AdminDailyActivity[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${user.createdAt}), 'YYYY-MM-DD')`,
      accounts: count(),
    })
    .from(user)
    .where(gte(user.createdAt, since))
    .groupBy(sql`date_trunc('day', ${user.createdAt})`);

  const byDay = new Map(rows.map((row) => [row.day, Number(row.accounts)]));
  const label = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  });

  const series: AdminDailyActivity[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const key = dayKey(day);
    series.push({
      date: key,
      label: label.format(day),
      count: byDay.get(key) ?? 0,
    });
  }
  return series;
}

// ---------------------------------------------------------------------------
// Recent matches — the audit trail rows, joined to identity. The registry
 // supplies the display title (its ids ARE the persisted game ids).
// ---------------------------------------------------------------------------

export interface AdminRecentMatch {
  id: string;
  gameId: string;
  gameTitle: string;
  playerName: string;
  /** The DB CHECK guarantees `win | loss | draw`. */
  outcome: "win" | "loss" | "draw";
  ratingDelta: number;
  xpEarned: number;
  durationSeconds: number;
  playedAt: Date;
}

export async function getRecentMatches(
  limit = 10,
): Promise<AdminRecentMatch[]> {
  const rows = await db
    .select({
      id: gameMatches.id,
      gameId: gameMatches.gameId,
      playerName: user.name,
      outcome: gameMatches.outcome,
      ratingBefore: gameMatches.ratingBefore,
      ratingAfter: gameMatches.ratingAfter,
      xpEarned: gameMatches.xpEarned,
      durationSeconds: gameMatches.durationSeconds,
      playedAt: gameMatches.playedAt,
    })
    .from(gameMatches)
    .innerJoin(user, eq(gameMatches.userId, user.id))
    .orderBy(desc(gameMatches.playedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    gameId: row.gameId,
    gameTitle: getGameById(row.gameId)?.title ?? row.gameId,
    playerName: row.playerName,
    outcome: row.outcome as AdminRecentMatch["outcome"],
    ratingDelta: row.ratingAfter - row.ratingBefore,
    xpEarned: row.xpEarned,
    durationSeconds: row.durationSeconds,
    playedAt: row.playedAt,
  }));
}
