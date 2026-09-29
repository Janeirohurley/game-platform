/**
 * Admin queries — the database access layer for the /admin control plane.
 *
 * Server-only, same discipline as `lib/profile/queries.ts`: imported by
 * admin server components/actions only, never reachable from a client
 * bundle. Every admin feature adds its query here instead of querying
 * from a component.
 */

import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { adminAuditLog } from "@/lib/db/schema/audit";
import {
  gameMatches,
  gameStats,
  profiles,
} from "@/lib/db/schema/profiles";
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
// Users list — server-side pagination + search over Better Auth accounts.
// ---------------------------------------------------------------------------

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  banned: boolean;
  banReason: string | null;
  banExpires: Date | null;
  /** Public gamer tag; null when the account has no profile yet. */
  gamerTag: string | null;
  lastPlayedAt: Date | null;
  createdAt: Date;
}

export interface AdminUserList {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * One page of platform accounts, newest first. `search` matches name
 * OR email (case-insensitive). Pagination is SQL-side (LIMIT/OFFSET) —
 * the client never receives more than one slice.
 */
export async function listUsers(options: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<AdminUserList> {
  const query = options.search?.trim();
  const where = query
    ? or(ilike(user.name, `%${query}%`), ilike(user.email, `%${query}%`))
    : undefined;

  const [totalRows, rows] = await Promise.all([
    db.select({ value: count() }).from(user).where(where),
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        gamerTag: profiles.username,
        lastPlayedAt: profiles.lastPlayedAt,
        createdAt: user.createdAt,
      })
      .from(user)
      // LEFT JOIN: an account without a gamer profile is a normal row,
      // not a missing one — the tag/last-played columns just read « — ».
      .leftJoin(profiles, eq(profiles.userId, user.id))
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
  ]);

  const total = totalRows[0]?.value ?? 0;
  return {
    rows,
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}

// ---------------------------------------------------------------------------
// Gamers list — the profiles table IS the gamer population (a gamer =
// someone with a profile row), joined back to the auth account.
// ---------------------------------------------------------------------------

export interface AdminGamerRow {
  userId: string;
  /** Public gamer tag (unique). */
  username: string;
  displayName: string | null;
  accountName: string;
  accountEmail: string;
  level: number;
  xp: number;
  rating: number;
  /** Moderation state from the AUTH account (admin plugin). */
  banned?: boolean;
  banReason?: string | null;
  banExpires?: Date | null;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  /** Lifetime seconds across every game (profiles.total_play_seconds). */
  totalPlaySeconds: number;
  isPublic: boolean;
  lastPlayedAt: Date | null;
  createdAt: Date;
}

export interface AdminGamerList {
  rows: AdminGamerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * One page of gamer profiles, most recently ACTIVE first (never-played
 * profiles sink to the bottom, newest accounts last). `search` matches
 * the gamer tag, the display name, or the account name/email.
 */
export async function listGamers(options: {
  page: number;
  pageSize: number;
  search?: string;
}): Promise<AdminGamerList> {
  const query = options.search?.trim();
  const where = query
    ? or(
        ilike(profiles.username, `%${query}%`),
        ilike(profiles.displayName, `%${query}%`),
        ilike(user.name, `%${query}%`),
        ilike(user.email, `%${query}%`),
      )
    : undefined;

  const [totalRows, rows] = await Promise.all([
    db
      .select({ value: count() })
      .from(profiles)
      .innerJoin(user, eq(profiles.userId, user.id))
      .where(where),
    db
      .select({
        userId: profiles.userId,
        username: profiles.username,
        displayName: profiles.displayName,
        accountName: user.name,
        accountEmail: user.email,
        level: profiles.level,
        xp: profiles.xp,
        rating: profiles.rating,
        gamesPlayed: profiles.gamesPlayed,
        wins: profiles.wins,
        losses: profiles.losses,
        draws: profiles.draws,
        totalPlaySeconds: profiles.totalPlaySeconds,
        isPublic: profiles.isPublic,
        lastPlayedAt: profiles.lastPlayedAt,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .innerJoin(user, eq(profiles.userId, user.id))
      .where(where)
      // NULLS LAST: a gamer who never finished a match is not "the most
      // recent activity", it is no activity at all.
      .orderBy(sql`${profiles.lastPlayedAt} desc nulls last`, desc(profiles.createdAt))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
  ]);

  const total = totalRows[0]?.value ?? 0;
  return {
    rows,
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}

// ---------------------------------------------------------------------------
// Gamer detail — the drill-down behind /admin/gamers/[username]. Same
// server-owned numbers the profile pages show, from the admin side.
// Queries run SEQUENTIALLY (see the dashboard page: large concurrent
// batches deadlock against the transaction pooler in the dev runtime).
// ---------------------------------------------------------------------------

export interface AdminGamerGameStat {
  gameId: string;
  gameTitle: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  currentStreak: number;
  bestStreak: number;
  totalPlaySeconds: number;
  lastPlayedAt: Date | null;
}

export interface AdminGamerMatch {
  id: string;
  gameTitle: string;
  /** The DB CHECK guarantees `win | loss | draw`. */
  outcome: "win" | "loss" | "draw";
  ratingDelta: number;
  xpEarned: number;
  durationSeconds: number;
  playerCount: number;
  opponentTags: string[];
  playedAt: Date;
}

export interface AdminGamerDetail {
  gamer: AdminGamerRow;
  /** Percent of matches won; null when the gamer never played. */
  winRate: number | null;
  perGame: AdminGamerGameStat[];
  recentMatches: AdminGamerMatch[];
}

export async function getGamerDetail(
  username: string,
): Promise<AdminGamerDetail | null> {
  // 1) The gamer + their auth account (exact tag — tags are unique).
  const gamerRows = await db
    .select({
      userId: profiles.userId,
      username: profiles.username,
      displayName: profiles.displayName,
      accountName: user.name,
      accountEmail: user.email,
      level: profiles.level,
      xp: profiles.xp,
      rating: profiles.rating,
      gamesPlayed: profiles.gamesPlayed,
      wins: profiles.wins,
      losses: profiles.losses,
      draws: profiles.draws,
      totalPlaySeconds: profiles.totalPlaySeconds,
      isPublic: profiles.isPublic,
      lastPlayedAt: profiles.lastPlayedAt,
      createdAt: profiles.createdAt,
      // Moderation state — the ban lives on the AUTH account (admin
      // plugin), not on the gamer profile.
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
    })
    .from(profiles)
    .innerJoin(user, eq(profiles.userId, user.id))
    .where(eq(profiles.username, username))
    .limit(1);

  const gamer = gamerRows[0];
  if (!gamer) return null;

  // 2) Per-game competitive record.
  const stats = await db
    .select()
    .from(gameStats)
    .where(eq(gameStats.userId, gamer.userId))
    .orderBy(desc(gameStats.gamesPlayed));

  // 3) Latest ingested matches.
  const matchRows = await db
    .select({
      id: gameMatches.id,
      gameId: gameMatches.gameId,
      outcome: gameMatches.outcome,
      ratingBefore: gameMatches.ratingBefore,
      ratingAfter: gameMatches.ratingAfter,
      xpEarned: gameMatches.xpEarned,
      durationSeconds: gameMatches.durationSeconds,
      playerCount: gameMatches.playerCount,
      opponentIds: gameMatches.opponentIds,
      playedAt: gameMatches.playedAt,
    })
    .from(gameMatches)
    .where(eq(gameMatches.userId, gamer.userId))
    .orderBy(desc(gameMatches.playedAt))
    .limit(8);

  // 4) Opponent tags resolved in one extra query (same pattern as the
  // profile read-model: « Défaite contre @alex »).
  const opponentIds = [
    ...new Set(
      matchRows.flatMap((row) =>
        Array.isArray(row.opponentIds)
          ? row.opponentIds.filter((id) => id !== gamer.userId)
          : [],
      ),
    ),
  ];
  const opponents = opponentIds.length
    ? await db
        .select({ userId: profiles.userId, username: profiles.username })
        .from(profiles)
        .where(inArray(profiles.userId, opponentIds))
    : [];
  const tagByUser = new Map(opponents.map((row) => [row.userId, row.username]));

  return {
    gamer,
    winRate:
      gamer.gamesPlayed > 0
        ? Math.round((gamer.wins / gamer.gamesPlayed) * 100)
        : null,
    perGame: stats.map((row) => ({
      gameId: row.gameId,
      gameTitle: getGameById(row.gameId)?.title ?? row.gameId,
      gamesPlayed: row.gamesPlayed,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      rating: row.rating,
      currentStreak: row.currentStreak,
      bestStreak: row.bestStreak,
      totalPlaySeconds: row.totalPlaySeconds,
      lastPlayedAt: row.lastPlayedAt,
    })),
    recentMatches: matchRows.map((row) => ({
      id: row.id,
      gameTitle: getGameById(row.gameId)?.title ?? row.gameId,
      outcome: row.outcome as AdminGamerMatch["outcome"],
      ratingDelta: row.ratingAfter - row.ratingBefore,
      xpEarned: row.xpEarned,
      durationSeconds: row.durationSeconds,
      playerCount: row.playerCount,
      opponentTags: (Array.isArray(row.opponentIds) ? row.opponentIds : [])
        .filter((id) => id !== gamer.userId)
        .map((id) => tagByUser.get(id))
        .filter((tag): tag is string => Boolean(tag)),
      playedAt: row.playedAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Games overview — the registry IS the catalogue (no games table by
// design), so the list is GAMES joined with whatever the real tables
// know about each id. Two grouped aggregates, merged in memory; games
// nobody played show honest zeros instead of disappearing.
// ---------------------------------------------------------------------------

export interface AdminGameRow {
  id: string;
  /** Registry route segment under /games. */
  slug: string;
  title: string;
  category: string;
  status: "live" | "coming-soon";
  minPlayers: number;
  maxPlayers: number;
  playableOnline: boolean;
  /** Registry card visuals (monogram + gradient fallback). */
  icon: string;
  accent: string;
  /** Distinct gamers with a game_stats row for this game. */
  players: number;
  /** Ingested matches (game_matches rows, one per participant). */
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  /** Sum of per-match durations — the audit trail is the truth. */
  totalPlaySeconds: number;
  /** Mean game_stats rating; null when no one has a record yet. */
  avgRating: number | null;
  lastPlayedAt: Date | null;
}

export async function getGamesOverview(): Promise<AdminGameRow[]> {
  // Sequential on purpose — same pooler constraint as the dashboard.
  const statRows = await db
    .select({
      gameId: gameStats.gameId,
      players: countDistinct(gameStats.userId),
      avgRating: sql<number | null>`avg(${gameStats.rating})::float8`,
    })
    .from(gameStats)
    .groupBy(gameStats.gameId);

  const matchRows = await db
    .select({
      gameId: gameMatches.gameId,
      matches: count(),
      wins: sql<number>`(count(*) filter (where ${gameMatches.outcome} = 'win'))::int`,
      losses: sql<number>`(count(*) filter (where ${gameMatches.outcome} = 'loss'))::int`,
      draws: sql<number>`(count(*) filter (where ${gameMatches.outcome} = 'draw'))::int`,
      totalPlaySeconds:
        sql<number>`coalesce(sum(${gameMatches.durationSeconds}), 0)::int`,
      lastPlayedAt: sql<Date | null>`max(${gameMatches.playedAt})`,
    })
    .from(gameMatches)
    .groupBy(gameMatches.gameId);

  const statsByGame = new Map(statRows.map((row) => [row.gameId, row]));
  const matchesByGame = new Map(matchRows.map((row) => [row.gameId, row]));

  return GAMES.map((game) => {
    const stats = statsByGame.get(game.id);
    const matches = matchesByGame.get(game.id);
    return {
      id: game.id,
      slug: game.slug,
      title: game.title,
      category: game.category,
      status: game.status,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      playableOnline: game.playableOnline,
      icon: game.icon ?? game.id.slice(0, 2).toUpperCase(),
      accent: game.accent ?? "from-slate-400 via-slate-500 to-slate-700",
      players: stats?.players ?? 0,
      avgRating: stats?.avgRating ?? null,
      matches: matches?.matches ?? 0,
      wins: matches?.wins ?? 0,
      losses: matches?.losses ?? 0,
      draws: matches?.draws ?? 0,
      totalPlaySeconds: matches?.totalPlaySeconds ?? 0,
      lastPlayedAt: matches?.lastPlayedAt ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Matches list — every game_matches row (one per participant), the
// platform-wide audit trail. Server-side pagination + game/outcome
// filters, same discipline as the users/gamers lists.
// ---------------------------------------------------------------------------

export interface AdminMatchRow {
  id: string;
  /** Colyseus room that produced the result (dedupe key). */
  roomId: string;
  gameId: string;
  gameTitle: string;
  playerName: string;
  /** Gamer tag for the drill-down; null when no profile. */
  gamerTag: string | null;
  /** The DB CHECK guarantees `win | loss | draw`. */
  outcome: "win" | "loss" | "draw";
  ratingDelta: number;
  xpEarned: number;
  durationSeconds: number;
  playerCount: number;
  playedAt: Date;
}

export interface AdminMatchList {
  rows: AdminMatchRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listMatches(options: {
  page: number;
  pageSize: number;
  search?: string;
  /** Registry game id filter (validated by the caller). */
  game?: string;
  /** `win | loss | draw` filter (validated by the caller). */
  outcome?: string;
}): Promise<AdminMatchList> {
  const conditions = [];
  const query = options.search?.trim();
  if (query) {
    conditions.push(
      or(ilike(user.name, `%${query}%`), ilike(profiles.username, `%${query}%`)),
    );
  }
  if (options.game) {
    conditions.push(eq(gameMatches.gameId, options.game));
  }
  if (options.outcome === "win" || options.outcome === "loss" || options.outcome === "draw") {
    conditions.push(eq(gameMatches.outcome, options.outcome));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRows, rows] = await Promise.all([
    db.select({ value: count() }).from(gameMatches).where(where),
    db
      .select({
        id: gameMatches.id,
        roomId: gameMatches.roomId,
        gameId: gameMatches.gameId,
        playerName: user.name,
        gamerTag: profiles.username,
        outcome: gameMatches.outcome,
        ratingBefore: gameMatches.ratingBefore,
        ratingAfter: gameMatches.ratingAfter,
        xpEarned: gameMatches.xpEarned,
        durationSeconds: gameMatches.durationSeconds,
        playerCount: gameMatches.playerCount,
        playedAt: gameMatches.playedAt,
      })
      .from(gameMatches)
      .innerJoin(user, eq(gameMatches.userId, user.id))
      // LEFT JOIN: identity enrichment only — a match of an account
      // without a profile must still list.
      .leftJoin(profiles, eq(gameMatches.userId, profiles.userId))
      .where(where)
      .orderBy(desc(gameMatches.playedAt))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
  ]);

  const total = totalRows[0]?.value ?? 0;
  return {
    rows: rows.map((row) => ({
      id: row.id,
      roomId: row.roomId,
      gameId: row.gameId,
      gameTitle: getGameById(row.gameId)?.title ?? row.gameId,
      playerName: row.playerName,
      gamerTag: row.gamerTag,
      outcome: row.outcome as AdminMatchRow["outcome"],
      ratingDelta: row.ratingAfter - row.ratingBefore,
      xpEarned: row.xpEarned,
      durationSeconds: row.durationSeconds,
      playerCount: row.playerCount,
      playedAt: row.playedAt,
    })),
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}

// ---------------------------------------------------------------------------
// Audit log — every admin action attempt, newest first (Phase 11).
// Rows are denormalized (no FK) so entries outlive account deletion.
// ---------------------------------------------------------------------------

export interface AdminAuditRow {
  id: string;
  actorEmail: string;
  action: string;
  targetEmail: string | null;
  targetGamerTag: string | null;
  status: "ok" | "error";
  errorMessage: string | null;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AdminAuditList {
  rows: AdminAuditRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listAuditLog(options: {
  page: number;
  pageSize: number;
  /** Only rows for one action name (e.g. `ban`). */
  action?: string;
  /** Only rows targeting one account (user.id). */
  targetUserId?: string;
}): Promise<AdminAuditList> {
  const conditions = [];
  if (options.action && options.action !== "all") {
    conditions.push(eq(adminAuditLog.action, options.action));
  }
  if (options.targetUserId) {
    conditions.push(eq(adminAuditLog.targetUserId, options.targetUserId));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRows, rows] = await Promise.all([
    db
      .select({ value: count() })
      .from(adminAuditLog)
      .where(where),
    db
      .select({
        id: adminAuditLog.id,
        actorEmail: adminAuditLog.actorEmail,
        action: adminAuditLog.action,
        targetEmail: adminAuditLog.targetEmail,
        targetGamerTag: adminAuditLog.targetGamerTag,
        status: adminAuditLog.status,
        errorMessage: adminAuditLog.errorMessage,
        details: adminAuditLog.details,
        createdAt: adminAuditLog.createdAt,
      })
      .from(adminAuditLog)
      .where(where)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(options.pageSize)
      .offset((options.page - 1) * options.pageSize),
  ]);

  const total = totalRows[0]?.value ?? 0;
  return {
    rows: rows.map((row) => ({
      ...row,
      status: row.status as AdminAuditRow["status"],
      details: (row.details ?? null) as Record<string, unknown> | null,
    })),
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
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
