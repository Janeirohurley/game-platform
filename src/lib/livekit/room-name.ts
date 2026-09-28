/**
 * LiveKit room naming — the pure, isomorphic part of the LiveKit config.
 *
 * Split from `config.ts` so CLIENT code can derive the media room name
 * without importing a module that reads server-only environment
 * variables: importing `config.ts` from a client component would ship
 * functions referencing `LIVEKIT_API_SECRET` into the browser bundle
 * (the values are not inlined, but the surface should not exist).
 *
 * There is deliberately NO second room-id system: the LiveKit room is
 * a deterministic namespace over the Colyseus room id the app already
 * uses (`?room=abc123`). Same match → same media room, different
 * matches → different media rooms, any future game → same derivation.
 */

/** Endpoint that mints the LiveKit access token (Next.js route handler). */
export const LIVEKIT_TOKEN_ENDPOINT = "/api/livekit/token";

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
