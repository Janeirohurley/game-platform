/**
 * Admin queries — the database access layer for the /admin control plane.
 *
 * Server-only, same discipline as `lib/profile/queries.ts`: imported by
 * admin server components/actions only, never reachable from a client
 * bundle. Every admin feature adds its query here instead of querying
 * from a component.
 */

import { count, countDistinct, desc, eq, gte, sql } from "drizzle-orm";

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
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 6);

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${gameMatches.playedAt}), 'YYYY-MM-DD')`,
      matches: count(),
    })
    .from(gameMatches)
    .where(gte(gameMatches.playedAt, since))
    .groupBy(sql`date_trunc('day', ${gameMatches.playedAt})`);

  const byDay = new Map(rows.map((row) => [row.day, Number(row.matches)]));
  const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });

  const week: AdminDailyActivity[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    week.push({
      date: dayKey(day),
      label: weekday.format(day),
      count: byDay.get(dayKey(day)) ?? 0,
    });
  }
  return week;
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
