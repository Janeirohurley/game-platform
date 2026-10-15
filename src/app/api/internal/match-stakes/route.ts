import { NextResponse } from "next/server";
import { z } from "zod";

import { createMatchStake } from "@/lib/wallet/match-stakes";
import { isGameId } from "@/lib/games/registry";
import { isSupportedCurrency } from "@/lib/wallet/currencies";

const schema = z.object({
  roomId: z.string().min(1).max(64),
  gameId: z.string(),
  currency: z.string().length(3),
  stakeMinor: z.coerce.number().int().positive(),
  rakeBps: z.coerce.number().int().min(0).max(10000).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { roomId, gameId, currency, stakeMinor, rakeBps } = parsed.data;
  if (!isGameId(gameId)) return NextResponse.json({ error: "Unknown game" }, { status: 400 });
  if (!isSupportedCurrency(currency)) return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  try {
    const stake = await createMatchStake({ roomId, gameId, currency, stakeMinor, rakeBps });
    return NextResponse.json({ id: stake.id, roomId: stake.roomId, status: stake.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed" }, { status: error.status ?? 500 });
  }
}
