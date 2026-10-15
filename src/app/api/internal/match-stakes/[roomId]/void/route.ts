import { NextResponse } from "next/server";

import { voidStakes } from "@/lib/wallet/match-stakes";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await params;
  try {
    await voidStakes(roomId);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Failed" }, { status: error.status ?? 500 });
  }
}
