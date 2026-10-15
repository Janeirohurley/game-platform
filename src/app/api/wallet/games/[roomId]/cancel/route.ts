import { NextResponse } from "next/server";

import { cancelHold } from "@/lib/wallet/match-stakes";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  const body = await request.json().catch(() => ({}));
  const idempotencyKey = (body?.idempotencyKey as string) || `match:${roomId}:cancel:auto`;
  try {
    await cancelHold({ userId: "user-placeholder", roomId, idempotencyKey });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed" }, { status: error.status ?? 500 });
  }
}
