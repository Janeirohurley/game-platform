import { SignJWT } from "jose";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  REALTIME_GUEST_TOKEN_ISSUER,
  REALTIME_TOKEN_ISSUER,
  REALTIME_TOKEN_TTL_SECONDS,
} from "@/lib/realtime/config";

/**
 * Mints the short-lived JWT the browser presents to the Colyseus server.
 *
 * Two kinds, same shared secret (REALTIME_TOKEN_SECRET):
 *
 *   - GET → user token (issuer "game-platform"). Requires a session.
 *     Carries the identity needed to PLAY (user id + display name).
 *
 *   - GET ?scope=spectator → guest token (issuer "game-platform-guest").
 *     Requires NO session: anyone may watch. The server pins the
 *     identity to a per-connection guest id and treats it as
 *     spectator-only — it can never seat or run a room.
 *
 * Tokens are signed with the shared REALTIME_TOKEN_SECRET and expire
 * quickly, so leaking one does not compromise the platform session.
 */
export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get("scope");

  const secret = process.env.REALTIME_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { error: "Realtime token secret is not configured" },
      { status: 500 },
    );
  }

  // ---- Anonymous spectators: no account required ------------------------
  if (scope === "spectator") {
    const token = await new SignJWT({
      name: "Spectateur",
      guest: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(`guest-${crypto.randomUUID()}`)
      .setIssuer(REALTIME_GUEST_TOKEN_ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${REALTIME_TOKEN_TTL_SECONDS}s`)
      .sign(new TextEncoder().encode(secret));

    return NextResponse.json(
      { token },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // ---- Players: a platform session is required --------------------------
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
