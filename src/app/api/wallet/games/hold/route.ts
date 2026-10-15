import { NextResponse } from "next/server";
import { z } from "zod";

import { createMatchStake, holdStake, cancelHold, voidStakes } from "@/lib/wallet/match-stakes";
import { isGameId } from "@/lib/games/registry";
import { isSupportedCurrency } from "@/lib/wallet/currencies";

const holdSchema = z.object({
  roomId: z.string().min(1).max(64),
  amountMinor: z.coerce.number().int().positive(),
  currency: z.string().length(3),
  idempotencyKey: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = holdSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const { roomId, amountMinor, currency, idempotencyKey } = parsed.data;
  if (!isSupportedCurrency(currency)) {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  }
  try {
    const result = await holdStake({
      userId: "user-placeholder", // TODO: auth
      roomId,
      amountMinor,
      currency,
      idempotencyKey,
    });
    return NextResponse.json({ transactionId: result.transactionId, duplicate: result.duplicate });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed" }, { status: error.status ?? 500 });
  }
}
