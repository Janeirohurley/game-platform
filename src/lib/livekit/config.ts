/**
 * LiveKit configuration — the single source of truth for the voice/video
 * transport, mirroring how `lib/realtime/config.ts` owns Colyseus.
 *
 * Division of responsibility:
 *
 *   - Colyseus owns GAME STATE. It decides who plays, who watches, who
 *     may act. Nothing here may change that.
 *   - LiveKit owns MEDIA ONLY. It moves audio/video between browsers that
 *     the Colyseus room has already admitted. A LiveKit outage degrades
 *     voice/video and nothing else: the board keeps running, because
 *     this module is never imported by the game state path.
 *
 * The two are joined only by a DERIVED room name (see `livekitRoomName`),
 * so no second room-id system is introduced.
 */

/** How long a LiveKit access token stays valid, in seconds.
 *
 * Short-lived on purpose: a token is minted immediately before the
 * client connects, and a leaked one is useless for long. Long enough to
 * survive a page refresh that re-mints a token mid-match. */
export const LIVEKIT_TOKEN_TTL_SECONDS = 10 * 60;

/** LiveKit room names are `[a-zA-Z0-9-_=,.@]{1,128}`. */
const LIVEKIT_ROOM_NAME_PATTERN = /^[A-Za-z0-9\-_=,.@]{1,128}$/;

/**
 * Colyseus room ids we are willing to derive a LiveKit room from.
 *
 * Deliberately conservative: the value reaches a LiveKit room name, so
 * anything that is not a plain opaque id is rejected up front rather
 * than sanitised into something ambiguous. Colyseus ids are lowercase
 * alphanumerics; this accepts exactly that shape.
 */
const COLYSEUS_ROOM_ID_PATTERN = /^[A-Za-z0-9]{1,64}$/;

/** Endpoint that mints the LiveKit token. */
export const LIVEKIT_TOKEN_ENDPOINT = "/api/livekit/token";

/**
 * The LiveKit room for a given game room.
 *
 * Deterministic, so every participant of the same match lands in the
 * same LiveKit room without any coordination, and different matches
 * never share one. The prefix namespaces voice rooms apart from any
 * other LiveKit room the deployment may host.
 *
 * Game-agnostic on purpose: it takes the platform's room id, never a
 * game id, so a new game inherits this for free.
 *
 * Throws on an invalid room id rather than coercing it: a coerced id
 * could collide with a different real room, which is exactly the
 * cross-room leak the token route is built to prevent.
 */
export function livekitRoomName(gameRoomId: string): string {
  const roomId = gameRoomId.trim();
  if (!COLYSEUS_ROOM_ID_PATTERN.test(roomId)) {
    throw new Error("Invalid game room id");
  }
  const name = `game-room-${roomId}`;
  // Defence in depth: the derived name must also satisfy LiveKit's own
  // room-name grammar, otherwise the join fails server-side with a
  // message that says nothing about the cause.
  if (!LIVEKIT_ROOM_NAME_PATTERN.test(name)) {
    throw new Error("Derived LiveKit room name is not valid");
  }
  return name;
}

/** True when a game room id is one we can derive a LiveKit room from. */
export function isValidGameRoomId(gameRoomId: string): boolean {
  return COLYSEUS_ROOM_ID_PATTERN.test(gameRoomId.trim());
}

// ---------------------------------------------------------------------------
// Server-side credentials — NEVER read from a client component.
// ---------------------------------------------------------------------------

export interface LiveKitServerCredentials {
  apiKey: string;
  apiSecret: string;
}

/**
 * The server-only LiveKit API key pair, or `null` when unconfigured.
 *
 * This function must only ever be called from a Route Handler, a server
 * action or a server component. It touches `LIVEKIT_API_KEY` /
 * `LIVEKIT_API_SECRET`, which are NOT `NEXT_PUBLIC_*` and are therefore
 * never inlined into a client bundle.
 *
 * Returns `null` instead of throwing so callers can answer 500 with a
 * generic message rather than surfacing a config detail.
 */
export function readLiveKitServerCredentials(): LiveKitServerCredentials | null {
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret };
}

// ---------------------------------------------------------------------------
// Browser-facing endpoint — public by design.
// ---------------------------------------------------------------------------

/**
 * The WebSocket endpoint the BROWSER dials.
 *
 * `NEXT_PUBLIC_LIVEKIT_URL` is intentionally public: it is the address
 * of the media server, not a credential, and the browser needs it to
 * open the WebSocket.
 *
 * The browser must never be pointed at a Docker-internal hostname
 * (`ws://livekit:7880`): that name only resolves inside the compose
 * network. The browser runs on the host, so it needs the published
 * address (`ws://localhost:7880` in local development).
 */
export function resolveLiveKitUrl(): string | null {
  const configured = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();
  return configured ? configured : null;
}
