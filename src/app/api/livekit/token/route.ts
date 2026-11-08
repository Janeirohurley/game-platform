import { AccessToken } from "livekit-server-sdk";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  readLiveKitServerCredentials,
  resolveLiveKitUrl,
  LIVEKIT_TOKEN_TTL_SECONDS,
} from "@/lib/livekit/config";
import { verifyRoomMembership } from "@/lib/livekit/room-membership";
import { livekitRoomName } from "@/lib/livekit/room-name";
import { grantsForRole } from "@/lib/livekit/grants";
import { getRealtimeIdentityForUser } from "@/lib/profile/queries";

/**
 * Mints a short-lived LiveKit access token for a game room's media
 * channel.
 *
 * Security shape (spec phase 4A):
 *
 *   1. AUTHENTICATION — a platform session is REQUIRED. The LiveKit
 *      identity is derived from the authenticated user id, never from a
 *      client claim, so nobody can join as somebody else.
 *   2. AUTHORIZATION — membership in the requested Colyseus room is
 *      verified server-to-server against the realtime server (the
 *      authoritative holder of room rosters). A valid session for
 *      game-room-A cannot mint a token for game-room-B.
 *   3. SCOPING — the token carries ONLY `roomJoin` for the derived
 *      room plus the publish/subscribe/data permissions of a normal
 *      participant. No admin, no create, no list, no record.
 *
 * `LIVEKIT_API_SECRET` never leaves this process: it is read through
 * `readLiveKitServerCredentials()` (server-only module, no
 * `NEXT_PUBLIC_*`), used to sign, and never included in the response.
 */

/** Participant identities are stable, derived from the user id. */
function participantIdentity(userId: string): string {
  return `user-${userId}`;
}

export async function GET(request: NextRequest) {
  // ---- 0. Configuration (fail closed, without leaking details) --------
  const credentials = readLiveKitServerCredentials();
  if (!credentials) {
    console.error("[livekit-token] LIVEKIT_API_KEY/SECRET not configured");
    return NextResponse.json(
      { error: "Service vocal indisponible (configuration)." },
      { status: 500 },
    );
  }

  // The media address is as load-bearing as the credentials: without it
  // the client has a valid token and nowhere to dial. Answering 200 with
  // `url: null` is what made this failure invisible — the browser aborted
  // with a generic "jeton invalide" and the server logged nothing at all.
  // Fail here instead, named, so the next person reads one log line
  // instead of bisecting a build.
  const mediaUrl = resolveLiveKitUrl();
  if (!mediaUrl) {
    console.error(
      "[livekit-token] no media URL: set LIVEKIT_PUBLIC_URL (runtime) " +
        "or build with NEXT_PUBLIC_LIVEKIT_URL",
    );
    return NextResponse.json(
      { error: "Service vocal indisponible (configuration)." },
      { status: 500 },
    );
  }

  // ---- 1. Validate the request shape ----------------------------------
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const roomId = (url.searchParams.get("roomId") ?? "").trim();
  if (!roomId) {
    return NextResponse.json(
      { error: "roomId est requis." },
      { status: 400 },
    );
  }
  let mediaRoom: string;
  try {
    // Deriving also VALIDATES: a malformed room id must never reach
    // the membership check, let alone become a LiveKit room name.
    mediaRoom = livekitRoomName(roomId);
  } catch {
    return NextResponse.json(
      { error: "roomId invalide." },
      { status: 400 },
    );
  }

  // ---- 1b. Anonymous SPECTATORS: listen-only, no session needed -------
  //
  // The application's OWN rule (mirrors /api/realtime/token?scope=spectator
  // and the game server's guest handling): an anonymous visitor who knows
  // the room id may WATCH — the game server seats them as a spectator and
  // publishes their id in spectatorIds. Hearing the match is part of
  // watching, so the media mirror is a RECEIVE-ONLY guest token: the
  // grants make publishing (mic, camera, data) impossible at the TOKEN
  // level, not merely hidden in the UI. The room id is the credential,
  // exactly as it already is for watching the game state; admission to
  // the GAME remains Colyseus' job and a guest token can never affect it.
  if (scope === "spectator") {
    const guestIdentity = `guest-${crypto.randomUUID()}`;
    const at = new AccessToken(credentials.apiKey, credentials.apiSecret, {
      identity: guestIdentity,
      name: "Spectateur",
      ttl: LIVEKIT_TOKEN_TTL_SECONDS,
    });
    at.addGrant(grantsForRole("spectator", mediaRoom));
    const token = await at.toJwt();
    return NextResponse.json(
      { token, identity: guestIdentity, url: mediaUrl, room: mediaRoom },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // ---- 2. Authenticate (better-auth session) ---------------------------
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return NextResponse.json(
      { error: "Connecte-toi pour utiliser la voix." },
      { status: 401 },
    );
  }
  const userId = session.user.id;

  // ---- 3. Authorize against the REAL room roster -----------------------
  const membership = await verifyRoomMembership(roomId, userId);
  if (!membership.ok) {
    if (membership.reason === "unavailable") {
      // The check itself failed (realtime server down/slow): not a
      // refusal, a 503 the client may retry. Never a 403 — that would
      // be a lie about the authorization result.
      //
      // `cause` and `detail` are logged HERE and never serialized: they
      // are the only record of why a hosted deployment could not reach
      // its game server (unroutable address, drifted secret, timeout).
      console.error("[livekit-token] membership check unavailable", {
        roomId,
        userId,
        cause: membership.cause,
        detail: membership.detail,
      });
      return NextResponse.json(
        { error: "Vérification de la room impossible — réessaie." },
        { status: 503 },
      );
    }
    console.warn("[livekit-token] membership refused", { roomId, userId });
    return NextResponse.json(
      { error: "Tu ne fais pas partie de cette partie." },
      { status: 403 },
    );
  }

  // ---- 4. Display name from the PROFILE, never from the client --------
  let displayName = session.user.name ?? "Joueur";
  try {
    const identity = await getRealtimeIdentityForUser(userId);
    if (identity?.username) displayName = identity.username;
  } catch (error) {
    // The media join must not depend on the profile lookup.
    console.error("[livekit-token] profile lookup failed:", error);
  }

  // ---- 5. Mint the token (server-side only) ---------------------------
  const at = new AccessToken(credentials.apiKey, credentials.apiSecret, {
    identity: participantIdentity(userId),
    name: displayName,
    ttl: LIVEKIT_TOKEN_TTL_SECONDS,
    metadata: JSON.stringify({ userId }),
  });
  // The ROOM ROLE decides the media permissions (the application's
  // rules, not LiveKit's): a seated player may publish mic/camera; a
  // spectator is receive-only — mirroring the game server, which
  // already refuses `voice:mute` from anyone not seated.
  at.addGrant(grantsForRole(membership.role, mediaRoom));

  const token = await at.toJwt();

  return NextResponse.json(
    {
      token,
      identity: participantIdentity(userId),
      // The browser-facing media URL is public by design (it is an
      // address, not a credential) but it still comes from the server
      // so the client never reads env vars itself.
      url: mediaUrl,
      room: mediaRoom,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
