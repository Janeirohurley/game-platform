import "server-only";

import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { profiles } from "@/lib/db/schema/profiles";
import {
  bots,
  type BotConfig,
  type BotDifficulty,
  type BotMode,
  type BotStatus,
} from "@/lib/db/schema/bots";

/**
 * Read-only views of the bot pool for the admin console. Writes live in
 * `lib/bots/provisioning.ts` (the single writer); this module only reads.
 * Everything is paginated server-side so the console never loads the
 * whole pool into a Server Component.
 */

export interface AdminBotListRow {
  id: string;
  label: string | null;
  mode: BotMode;
  gameId: string;
  difficulty: BotDifficulty;
  config: BotConfig | null;
  status: BotStatus;
  origin: string;
  leaseRoomId: string | null;
  leasedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  userId: string;
  gamerTag: string | null;
  displayName: string | null;
  ownerEmail: string | null;
}

export interface AdminBotList {
  rows: AdminBotListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Idle pool bots per game — the "is the pool deep enough?" gauge. */
  availableByGame: Record<string, number>;
}

export interface AdminBotFilters {
  page: number;
  pageSize: number;
  search?: string;
  gameId?: string;
  mode?: BotMode;
  status?: BotStatus;
}

export async function listBotsAdmin(
  filters: AdminBotFilters,
): Promise<AdminBotList> {
  const search = filters.search?.trim();
  const conditions: SQL[] = [];
  if (search) {
    const like = `%${search}%`;
    conditions.push(
      or(
        ilike(bots.label, like),
        ilike(bots.id, like),
        ilike(bots.userId, like),
        ilike(profiles.username, like),
        ilike(user.email, like),
        ilike(user.name, like),
      ) as SQL,
    );
  }
  if (filters.gameId) conditions.push(eq(bots.gameId, filters.gameId));
  if (filters.mode) conditions.push(eq(bots.mode, filters.mode));
  if (filters.status) conditions.push(eq(bots.status, filters.status));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRows, rows, poolRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(bots)
      .leftJoin(user, eq(bots.userId, user.id))
      .leftJoin(profiles, eq(profiles.userId, bots.userId))
      .where(where),
    db
      .select({
        id: bots.id,
        label: bots.label,
        mode: bots.mode,
        gameId: bots.gameId,
        difficulty: bots.difficulty,
        config: bots.config,
        status: bots.status,
        origin: bots.origin,
        leaseRoomId: bots.leaseRoomId,
        leasedAt: bots.leasedAt,
        lastUsedAt: bots.lastUsedAt,
        createdAt: bots.createdAt,
        userId: bots.userId,
        gamerTag: profiles.username,
        displayName: profiles.displayName,
        ownerEmail: user.email,
      })
      .from(bots)
      .leftJoin(user, eq(bots.userId, user.id))
      .leftJoin(profiles, eq(profiles.userId, bots.userId))
      .where(where)
      .orderBy(desc(bots.createdAt))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    db
      .select({ gameId: bots.gameId, value: count() })
      .from(bots)
      .where(and(eq(bots.status, "idle"), eq(bots.mode, "pool")))
      .groupBy(bots.gameId),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const availableByGame: Record<string, number> = {};
  for (const row of poolRows) {
    availableByGame[row.gameId] = Number(row.value);
  }

  return {
    rows: rows.map((row) => ({
      ...row,
      mode: row.mode as BotMode,
      difficulty: row.difficulty as BotDifficulty,
      status: row.status as BotStatus,
      config: (row.config as BotConfig | null) ?? null,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    availableByGame,
  };
}

export interface AttachableAccountRow {
  id: string;
  name: string | null;
  email: string | null;
  gamerTag: string | null;
  isBot: boolean;
}

/**
 * Accounts that can receive an attached brain: any user not already
 * driving one. Bot accounts are shown too (an operator may legitimately
 * bind a brain to one), but flagged so the choice is informed.
 */
export async function listAttachableAccounts(
  search: string,
  limit = 20,
): Promise<AttachableAccountRow[]> {
  const like = `%${search.trim()}%`;
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      gamerTag: profiles.username,
      isBot: user.isBot,
    })
    .from(user)
    .leftJoin(profiles, eq(profiles.userId, user.id))
    .leftJoin(bots, eq(bots.userId, user.id))
    .where(
      and(
        isNull(bots.id),
        or(
          ilike(user.email, like),
          ilike(user.name, like),
          ilike(profiles.username, like),
        ),
      ),
    )
    .orderBy(user.name)
    .limit(limit);
  return rows.map((row) => ({ ...row, isBot: row.isBot ?? false }));
}
