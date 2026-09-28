import "server-only";

/**
 * Room-membership verification, for the LiveKit token route.
 *
 * This is the AUTHORIZATION step: authentication alone does not let
 * anyone into a match's media channel, and it is the reason a client
 * cannot simply swap the room id in its request to reach another
 * match. The platform derives the LiveKit room name from that same id,
 * so an unchecked request would mint a perfectly valid token for
 * somebody else's game.
 *
 * The source of truth is the realtime server, not this app's database.
 * Rooms are live Colyseus state: who holds a seat and who is watching
 * only exists inside the room, and the platform has no table to
 * duplicate it into. Every room already publishes its participant ids
 * into matchmaker metadata as roles change (see `refreshMetadata` in
 * base-game-room.ts), so the check is one lookup against the state the
 * game itself runs on — no new table, no second room-id system.
 *
 * `server-only`: this module reaches a credential over the network, so it
 * must never end up in a client bundle.
 */

/** Role the realtime server reports for a member. */
export type RoomMembershipRole = "player" | "spectator";

/** How long a media-token request waits on the game server. */
const MEMBERSHIP_TIMEOUT_MS = 3_000;

export interface RoomMembership {
  member: boolean;
  role: RoomMembershipRole | null;
  gameId?: string;
}

export type MembershipVerdict =
  /** The room exists, is open, and this user belongs to it. */
  | { ok: true; role: RoomMembershipRole; gameId: string }
  /** The request is well-formed but the user is not in that room. */
  | { ok: false; reason: "not-a-member" }
  /**
   * The room could not be checked — the realtime server is down, slow or
   * misconfigured. Deliberately NOT treated as "not a member": failing
   * closed is right for security, but the caller must be able to tell a
   * transport problem (retry / 503) from a real refusal (403).
   */
  | { ok: false; reason: "unavailable" };

/** Header the realtime server requires on its membership endpoint. */
const MEMBERSHIP_SECRET_HEADER = "x-realtime-token-secret";

/**
 * Server-to-server address of the realtime server.
 *
 * Intentionally NOT `resolveRealtimeUrl()`: that function reads
 * `NEXT_PUBLIC_REALTIME_URL`, and importing it here would reference a
 * public env var from a server-only module — Next would inline it into
 * the client graph and defeat the `server-only` guard. The browser and
 * the platform both reach the same Colyseus server, but they name it
 * differently (a LAN address for the browser, loopback or the compose
 * service name for the server), which is exactly what makes the two
 * separate variables correct.
 */
function resolveRealtimeServerUrl(): string {
  const configured = process.env.REALTIME_SERVER_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "REALTIME_SERVER_URL must be set in production to authorize media tokens",
    );
  }
  return "http://127.0.0.1:2567";
}

function readSecret(): string {
  const secret = process.env.REALTIME_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("REALTIME_TOKEN_SECRET is missing or too short");
  }
  return secret;
}

/**
 * Ask the realtime server whether `userId` currently belongs to
 * `roomId`, and with which role.
 *
 * Never throws: transport and configuration failures are reported as
 * `{ ok: false, reason: "unavailable" }` so the route can answer 503
 * instead of 403, because telling an unauthorized caller "the room check
 * is broken" is itself a small information leak and an outright lie about
 * the authorization result.
 */
export async function verifyRoomMembership(
  roomId: string,
  userId: string,
): Promise<MembershipVerdict> {
  let secret: string;
  try {
    secret = readSecret();
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const url = `${resolveRealtimeServerUrl()}/api/room-membership/${encodeURIComponent(
    roomId,
  )}?userId=${encodeURIComponent(userId)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: { [MEMBERSHIP_SECRET_HEADER]: secret },
      // Short on purpose: this runs inside a user-visible request, and a
      // slow game server must not hold the media join hostage. Failing
      // open is not an option, so we give up and report "unavailable".
      signal: AbortSignal.timeout(MEMBERSHIP_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  // 403 here means our own credential is wrong — a server-to-server
  // misconfiguration, never a user-level refusal.
  if (response.status === 503) return { ok: false, reason: "unavailable" };
  if (!response.ok) return { ok: false, reason: "unavailable" };

  let payload: RoomMembership;
  try {
    payload = (await response.json()) as RoomMembership;
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (!payload.member || (payload.role !== "player" && payload.role !== "spectator")) {
    return { ok: false, reason: "not-a-member" };
  }

  return { ok: true, role: payload.role, gameId: payload.gameId ?? "" };
}
