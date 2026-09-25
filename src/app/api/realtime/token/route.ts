import { SignJWT } from "jose";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  REALTIME_TOKEN_ISSUER,
  REALTIME_TOKEN_TTL_SECONDS,
} from "@/lib/realtime/config";

/**
 * Mints the short-lived JWT the browser presents to the Colyseus server.
 *
 * The token carries only the identity the realtime server needs
 * (user id + display name). It is signed with the shared
 * REALTIME_TOKEN_SECRET and expires quickly, so leaking one does not
 * compromise the platform session.
 *
 * GET /api/realtime/token → { token: string }
 */
export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.REALTIME_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { error: "Realtime token secret is not configured" },
      { status: 500 },
    );
  }

  const token = await new SignJWT({ name: session.user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.user.id)
    .setIssuer(REALTIME_TOKEN_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${REALTIME_TOKEN_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json(
    { token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
