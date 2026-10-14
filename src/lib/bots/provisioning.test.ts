/**
 * Bot control-plane tests — the writers behind the admin console, run
 * against the real database.
 *
 * The suite is skipped when DATABASE_URL is absent. It creates its own
 * users/bots and removes them afterwards, and it never assumes an empty
 * table: the one test that must know exactly which bot a claim returns
 * temporarily parks the other idle pool bots and restores them in a
 * finally block.
 */

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { profiles } from "@/lib/db/schema/profiles";
import { bots } from "@/lib/db/schema/bots";
import {
  BotAdminError,
  bindExistingBot,
  claimBots,
  countAvailableBots,
  createManagedBot,
  deleteManagedBot,
  releaseBots,
  resolveAttachedBrain,
  updateManagedBot,
} from "./provisioning";

const HAS_DB = !!process.env.DATABASE_URL;

// The managed Postgres pooler is a network round-trip per statement, and
// these tests chain several; the default 5 s budget is too tight.
setDefaultTimeout(30_000);

const createdUserIds = new Set<string>();
const createdBotIds = new Set<string>();

/** The admin "author" every created brain points at (FK + audit). */
let adminId = "";

async function makeAccount(
  overrides: { isBot?: boolean; name?: string } = {},
): Promise<{ id: string; gamerTag: string }> {
  const id = `test-bot-${randomUUID().slice(0, 12)}`;
  const gamerTag = `t_${randomUUID().replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
  await db.insert(user).values({
    id,
    name: overrides.name ?? "Test Account",
    email: `${id}@example.test`,
    emailVerified: true,
    role: "user",
    isBot: overrides.isBot ?? false,
  });
  await db.insert(profiles).values({
    userId: id,
    username: gamerTag,
    displayName: overrides.name ?? "Test Account",
  });
  createdUserIds.add(id);
  return { id, gamerTag };
}

async function cleanup() {
  if (!HAS_DB) return;
  if (createdBotIds.size > 0) {
    await db.delete(bots).where(inArray(bots.id, [...createdBotIds]));
    createdBotIds.clear();
  }
  if (createdUserIds.size > 0) {
    await db.delete(user).where(inArray(user.id, [...createdUserIds]));
    createdUserIds.clear();
  }
}

beforeAll(async () => {
  await cleanup();
  if (!HAS_DB) return;
  adminId = (await makeAccount({ name: "Admin Author" })).id;
});
afterAll(cleanup);

describe.if(HAS_DB)("bot control plane", () => {
  test("createManagedBot(pool) mints an inert account and a claimable row", async () => {
    const bot = await createManagedBot({
      gameId: "ludo",
      mode: "pool",
      difficulty: "hard",
      label: "Boss",
      config: { aggression: 0.9, caution: 0.1 },
      createdByAdminId: adminId,
    });
    createdBotIds.add(bot.botId);
    createdUserIds.add(bot.userId);

    const [row] = await db.select().from(bots).where(eq(bots.id, bot.botId));
    expect(row.mode).toBe("pool");
    expect(row.status).toBe("idle");
    expect(row.difficulty).toBe("hard");
    expect(row.label).toBe("Boss");
    expect(row.config).toEqual({ aggression: 0.9, caution: 0.1 });

    const [account] = await db
      .select()
      .from(user)
      .where(eq(user.id, bot.userId));
    expect(account.isBot).toBe(true);
  });

  test("an attached brain binds an existing account and is excluded from the pool", async () => {
    const account = await makeAccount({ name: "Real Player" });
    const bot = await createManagedBot({
      gameId: "ludo",
      mode: "attached",
      difficulty: "normal",
      targetUserId: account.id,
      createdByAdminId: adminId,
    });
    createdBotIds.add(bot.botId);

    const [row] = await db.select().from(bots).where(eq(bots.id, bot.botId));
    expect(row.mode).toBe("attached");
    expect(row.userId).toBe(account.id);

    // The claim eligibility filter (gameId, idle, pool) must miss this
    // row entirely — an attached brain is never claimable.
    const eligible = await db
      .select({ id: bots.id })
      .from(bots)
      .where(
        and(
          eq(bots.gameId, "ludo"),
          eq(bots.status, "idle"),
          eq(bots.mode, "pool"),
          eq(bots.id, bot.botId),
        ),
      );
    expect(eligible.length).toBe(0);
  });

  test("a second brain on the same account is rejected", async () => {
    const account = await makeAccount({ name: "Busy" });
    const first = await createManagedBot({
      gameId: "ludo",
      mode: "attached",
      difficulty: "easy",
      createdByAdminId: adminId,
      targetUserId: account.id,
    });
    createdBotIds.add(first.botId);

    await expect(
      createManagedBot({
        gameId: "ludo",
        mode: "attached",
        difficulty: "easy",
        createdByAdminId: adminId,
        targetUserId: account.id,
      }),
    ).rejects.toBeInstanceOf(BotAdminError);
  });

  test("update retunes a brain and disabling flips its status", async () => {
    const bot = await createManagedBot({
      gameId: "ludo",
      mode: "pool",
      difficulty: "easy",
      createdByAdminId: adminId,
    });
    createdBotIds.add(bot.botId);
    createdUserIds.add(bot.userId);

    await updateManagedBot(bot.botId, {
      difficulty: "hard",
      label: "Retuned",
      config: { aggression: 1, caution: 0 },
    });
    const [retuned] = await db
      .select()
      .from(bots)
      .where(eq(bots.id, bot.botId));
    expect(retuned.difficulty).toBe("hard");
    expect(retuned.label).toBe("Retuned");
    expect(retuned.config).toEqual({ aggression: 1, caution: 0 });

    await updateManagedBot(bot.botId, { enabled: false });
    const [disabled] = await db
      .select()
      .from(bots)
      .where(eq(bots.id, bot.botId));
    expect(disabled.status).toBe("disabled");
  });

  test("bindExistingBot moves a pool brain onto an account and frees the minted one", async () => {
    const bot = await createManagedBot({
      gameId: "ludo",
      mode: "pool",
      difficulty: "normal",
      createdByAdminId: adminId,
    });
    createdBotIds.add(bot.botId);
    const mintedUserId = bot.userId;

    const account = await makeAccount({ name: "Target" });
    await bindExistingBot(bot.botId, account.id);

    const [row] = await db.select().from(bots).where(eq(bots.id, bot.botId));
    expect(row.mode).toBe("attached");
    expect(row.userId).toBe(account.id);

    const minted = await db
      .select()
      .from(user)
      .where(eq(user.id, mintedUserId));
    expect(minted.length).toBe(0);
  });

  test("deleteManagedBot removes an attached brain but keeps the account", async () => {
    const account = await makeAccount({ name: "Keep Me" });
    const bot = await createManagedBot({
      gameId: "ludo",
      mode: "attached",
      difficulty: "normal",
      createdByAdminId: adminId,
      targetUserId: account.id,
    });

    await deleteManagedBot(bot.botId);

    const gone = await db.select().from(bots).where(eq(bots.id, bot.botId));
    expect(gone.length).toBe(0);
    const kept = await db.select().from(user).where(eq(user.id, account.id));
    expect(kept.length).toBe(1);
  });

  test("deleteManagedBot on a pool brain removes its minted account too", async () => {
    const bot = await createManagedBot({
      gameId: "ludo",
      mode: "pool",
      difficulty: "normal",
      createdByAdminId: adminId,
    });
    const mintedUserId = bot.userId;

    await deleteManagedBot(bot.botId);

    const gone = await db.select().from(user).where(eq(user.id, mintedUserId));
    expect(gone.length).toBe(0);
  });

  test("resolveAttachedBrain returns an attached brain and ignores the rest", async () => {
    const account = await makeAccount({ name: "Resolved" });
    const bot = await createManagedBot({
      gameId: "ludo",
      mode: "attached",
      difficulty: "hard",
      config: { aggression: 0.8, caution: 0.2 },
      targetUserId: account.id,
      createdByAdminId: adminId,
    });
    createdBotIds.add(bot.botId);

    const resolved = await resolveAttachedBrain({
      userId: account.id,
      gameId: "ludo",
    });
    expect(resolved?.botId).toBe(bot.botId);
    expect(resolved?.difficulty).toBe("hard");
    expect(resolved?.config).toEqual({ aggression: 0.8, caution: 0.2 });

    // Wrong game: the brain is reserved for ludo only.
    expect(
      await resolveAttachedBrain({ userId: account.id, gameId: "checkers" }),
    ).toBeNull();

    // Disabled: an operator turned it off.
    await updateManagedBot(bot.botId, { enabled: false });
    expect(
      await resolveAttachedBrain({ userId: account.id, gameId: "ludo" }),
    ).toBeNull();

    // A pool brain is never resolved by account — it is seated via claim.
    const pool = await createManagedBot({
      gameId: "ludo",
      mode: "pool",
      difficulty: "normal",
      createdByAdminId: adminId,
    });
    createdBotIds.add(pool.botId);
    createdUserIds.add(pool.userId);
    expect(
      await resolveAttachedBrain({ userId: pool.userId, gameId: "ludo" }),
    ).toBeNull();

    // An account with no brain at all.
    const plain = await makeAccount({ name: "Plain" });
    expect(
      await resolveAttachedBrain({ userId: plain.id, gameId: "ludo" }),
    ).toBeNull();
  });

  test("an idle pool brain is the one a claim returns when it is alone", async () => {
    const gameId = "checkers";
    const parked = await db
      .update(bots)
      .set({ status: "disabled" })
      .where(
        and(
          eq(bots.gameId, gameId),
          eq(bots.status, "idle"),
          eq(bots.mode, "pool"),
        ),
      )
      .returning({ id: bots.id });

    const roomId = `test-room-${randomUUID().slice(0, 8)}`;
    try {
      const bot = await createManagedBot({
        gameId,
        mode: "pool",
        difficulty: "normal",
        createdByAdminId: adminId,
      });
      createdBotIds.add(bot.botId);
      createdUserIds.add(bot.userId);
      expect(await countAvailableBots(gameId)).toBe(1);

      const claimed = await claimBots({
        count: 1,
        gameId,
        roomId,
        topUp: false,
      });
      expect(claimed.map((b) => b.botId)).toEqual([bot.botId]);

      await releaseBots({ roomId });
      const [row] = await db.select().from(bots).where(eq(bots.id, bot.botId));
      expect(row.status).toBe("idle");
    } finally {
      if (parked.length > 0) {
        await db
          .update(bots)
          .set({ status: "idle" })
          .where(
            inArray(
              bots.id,
              parked.map((r) => r.id),
            ),
          );
      }
    }
  });
});
