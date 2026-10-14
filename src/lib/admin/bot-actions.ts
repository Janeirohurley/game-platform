"use server";

/**
 * Admin bot actions — the ONLY mutation path from the console for brains.
 *
 * Same contract as `lib/admin/actions.ts`: every action re-verifies the
 * caller's platform `admin` role SERVER-SIDE, delegates to the single
 * writer (`lib/bots/provisioning.ts`), writes an AUDIT row for BOTH
 * outcomes, and returns a plain `{ ok, message }`.
 */

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/admin/session";
import { writeAuditLog } from "@/lib/admin/audit";
import type { AdminActionResult } from "@/lib/admin/actions";
import {
  BOT_ORIGIN_ADMIN,
  isBotDifficulty,
  type BotConfig,
  type BotDifficulty,
  type BotMode,
} from "@/lib/db/schema/bots";
import { isGameId } from "@/lib/games/registry";
import {
  BotAdminError,
  bindExistingBot,
  createManagedBot,
  deleteManagedBot,
  provisionBots,
  updateManagedBot,
} from "@/lib/bots/provisioning";
import {
  listAttachableAccounts,
  type AttachableAccountRow,
} from "@/lib/admin/bot-queries";

const RULES: Record<string, string> = {
  "account-not-found": "Ce compte n'existe pas.",
  "account-already-bound": "Ce compte pilote déjà un bot.",
  "bot-not-found": "Ce bot n'existe plus.",
  "bot-busy": "Ce bot est en pleine partie — réessayez plus tard.",
};

function toMessage(error: unknown): string {
  if (error instanceof BotAdminError) {
    return RULES[error.code] ?? "Opération impossible sur ce bot.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "L'opération a échoué côté serveur.";
}

export interface CreateBotActionInput {
  gameId: string;
  mode: BotMode;
  difficulty: BotDifficulty;
  label?: string | null;
  config?: BotConfig | null;
  displayName?: string;
  gamerTag?: string;
  targetUserId?: string;
}

export async function createBotAction(
  input: CreateBotActionInput,
): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const actor = { id: session.user.id, email: session.user.email };

  if (!isGameId(input.gameId)) {
    return { ok: false, message: "Jeu inconnu." };
  }
  if (!isBotDifficulty(input.difficulty)) {
    return { ok: false, message: "Niveau de raisonnement inconnu." };
  }
  if (input.mode === "attached" && !input.targetUserId) {
    return { ok: false, message: "Choisissez le compte à rattacher." };
  }

  try {
    const bot = await createManagedBot({
      gameId: input.gameId,
      mode: input.mode,
      difficulty: input.difficulty,
      label: input.label ?? null,
      config: input.config ?? null,
      displayName: input.displayName,
      gamerTag: input.gamerTag,
      targetUserId: input.targetUserId,
      createdByAdminId: session.user.id,
    });
    await writeAuditLog({
      action: "bot.create",
      status: "ok",
      actor,
      target: { userId: bot.userId, gamerTag: bot.gamerTag },
      details: {
        botId: bot.botId,
        mode: input.mode,
        gameId: input.gameId,
        difficulty: input.difficulty,
      },
    });
    revalidatePath("/admin/bots");
    return {
      ok: true,
      message:
        input.mode === "attached"
          ? `Bot rattaché au compte ${bot.gamerTag}.`
          : `Bot « ${bot.gamerTag} » créé.`,
    };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "bot.create",
      status: "error",
      actor,
      target: input.targetUserId ? { userId: input.targetUserId } : undefined,
      details: { mode: input.mode, gameId: input.gameId },
      errorMessage: message,
    });
    return { ok: false, message };
  }
}

export interface UpdateBotActionInput {
  botId: string;
  label?: string | null;
  difficulty?: BotDifficulty;
  config?: BotConfig | null;
  enabled?: boolean;
}

export async function updateBotAction(
  input: UpdateBotActionInput,
): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const actor = { id: session.user.id, email: session.user.email };

  try {
    await updateManagedBot(input.botId, {
      label: input.label,
      difficulty: input.difficulty,
      config: input.config,
      enabled: input.enabled,
    });
    await writeAuditLog({
      action: "bot.update",
      status: "ok",
      actor,
      details: {
        botId: input.botId,
        label: input.label,
        difficulty: input.difficulty,
      },
    });
    revalidatePath("/admin/bots");
    return { ok: true, message: "Bot mis à jour." };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "bot.update",
      status: "error",
      actor,
      details: { botId: input.botId },
      errorMessage: message,
    });
    return { ok: false, message };
  }
}

export async function deleteBotAction(input: {
  botId: string;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const actor = { id: session.user.id, email: session.user.email };

  try {
    await deleteManagedBot(input.botId);
    await writeAuditLog({
      action: "bot.delete",
      status: "ok",
      actor,
      details: { botId: input.botId },
    });
    revalidatePath("/admin/bots");
    return { ok: true, message: "Bot supprimé." };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "bot.delete",
      status: "error",
      actor,
      details: { botId: input.botId },
      errorMessage: message,
    });
    return { ok: false, message };
  }
}

export async function bindBotAction(input: {
  botId: string;
  targetUserId: string;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const actor = { id: session.user.id, email: session.user.email };

  try {
    await bindExistingBot(input.botId, input.targetUserId);
    await writeAuditLog({
      action: "bot.bind",
      status: "ok",
      actor,
      target: { userId: input.targetUserId },
      details: { botId: input.botId },
    });
    revalidatePath("/admin/bots");
    return { ok: true, message: "Bot rattaché au compte." };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "bot.bind",
      status: "error",
      actor,
      target: { userId: input.targetUserId },
      details: { botId: input.botId },
      errorMessage: message,
    });
    return { ok: false, message };
  }
}

/** Account picker data for the attach/bind dialog — admin-guarded. */
export async function searchAccountsAction(
  search: string,
): Promise<AttachableAccountRow[]> {
  await requireAdminSession();
  const query = search.trim();
  if (query.length < 2) return [];
  return listAttachableAccounts(query);
}

/**
 * Bulk-fill the idle pool for a game with fresh inert bots. The quickest
 * way to make "create a table with AI" land instantly instead of waiting
 * on a cold pool. Same guards and audit trail as the other mutations.
 */
export async function provisionBotsAction(input: {
  gameId: string;
  count: number;
}): Promise<AdminActionResult> {
  const session = await requireAdminSession();
  const actor = { id: session.user.id, email: session.user.email };

  if (!isGameId(input.gameId)) {
    return { ok: false, message: "Jeu inconnu." };
  }
  const count = Math.trunc(input.count);
  if (!Number.isInteger(count) || count < 1 || count > 32) {
    return { ok: false, message: "Indiquez un nombre entre 1 et 32." };
  }

  try {
    const created = await provisionBots({
      count,
      gameId: input.gameId,
      origin: BOT_ORIGIN_ADMIN,
    });
    await writeAuditLog({
      action: "bot.provision",
      status: "ok",
      actor,
      details: { gameId: input.gameId, count, created: created.length },
    });
    revalidatePath("/admin/bots");
    const noun = created.length > 1 ? "bots ajoutés" : "bot ajouté";
    return { ok: true, message: `${created.length} ${noun} à la réserve.` };
  } catch (error) {
    const message = toMessage(error);
    await writeAuditLog({
      action: "bot.provision",
      status: "error",
      actor,
      details: { gameId: input.gameId, count },
      errorMessage: message,
    });
    return { ok: false, message };
  }
}
