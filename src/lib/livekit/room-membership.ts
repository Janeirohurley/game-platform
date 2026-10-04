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
  | {
      ok: false;
      reason: "unavailable";
      cause: MembershipUnavailableCause;
      /**
       * Operator-facing detail, safe to log: a resolved origin, an HTTP
       * status, an error NAME and a duration. Never the shared secret,
       * never the response body, never a token.
       */
      detail?: string;
    };

/**
 * Why a membership check could not be completed.
 *
 * DIAGNOSTICS ONLY, and server-side only: this never reaches the client.
 * The route still answers the same 503 for every cause — telling an
 * unauthorized caller *why* the check is broken is itself a small leak —
 * but an operator genuinely needs to tell "the platform points at a LAN
 * address it cannot dial" from "the shared secret drifted", and those
 * two failures are otherwise indistinguishable.
 */
export type MembershipUnavailableCause =
  /** `REALTIME_TOKEN_SECRET` absent or shorter than 16 characters. */
  | "secret_missing"
  /** `REALTIME_SERVER_URL` absent while running in production. */
  | "url_missing"
  /** The request never completed: DNS, refused connection, TLS, blocked IP. */
  | "network"
  /** No answer within `MEMBERSHIP_TIMEOUT_MS`. */
  | "timeout"
  /** The server answered, but not 2xx (403 = our own secret is wrong). */
  | "http_status"
  /** 2xx whose body was not the JSON we expect (proxy error page, …). */
  | "invalid_payload";

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
 * The realtime origin, with any userinfo stripped.
 *
 * This is the single most useful thing to have in a log when a hosted
 * deployment cannot reach the game server: the usual cause is the
 * platform still pointing at a LAN address it has no route to. `host`
 * carries the port but never the credentials, and an unparseable value
 * is reported as such rather than echoed — a malformed URL can itself
 * embed a secret.
 */
function describeRealtimeOrigin(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "(unparseable REALTIME_SERVER_URL)";
  }
}

/** Error NAME + message: enough to diagnose, never a payload. */
function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return `non-Error thrown (${typeof error})`;
}

/** `AbortSignal.timeout` rejects with a `TimeoutError`, not an `AbortError`. */
function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "TimeoutError" || error.name === "AbortError";
}

/**
 * Ask the realtime server whether `userId` currently belongs to
 * `roomId`, and with which role.
 *
 * Never throws: transport and configuration failures are reported as
 * `{ ok: false, reason: "unavailable", cause, detail }` so the route can
 * answer 503 instead of 403, because telling an unauthorized caller
 * "the room check is broken" is itself a small information leak and an
 * outright lie about the authorization result.
 *
 * Every failure is logged here, server-side, with its `cause` — that log
 * line is the only place the real reason for a 503 is ever written down.
 * A hosted deployment cannot reach a LAN address, and a drifted shared
 * secret answers 403; from the outside both are the same opaque 503.
 */
export async function verifyRoomMembership(
  roomId: string,
  userId: string,
): Promise<MembershipVerdict> {
  const logContext = { roomId, userId };

  /** Report an unusable check: log the cause, return the verdict. */
  const unavailable = (
    cause: MembershipUnavailableCause,
    detail?: string,
  ): MembershipVerdict => {
    console.warn(`[livekit-membership] ${cause}${detail ? ` — ${detail}` : ""}`, {
      ...logContext,
    });
    return detail === undefined
      ? { ok: false, reason: "unavailable", cause }
      : { ok: false, reason: "unavailable", cause, detail };
  };

  let secret: string;
  try {
    secret = readSecret();
  } catch (error) {
    return unavailable("secret_missing", describeError(error));
  }

  let baseUrl: string;
  try {
    baseUrl = resolveRealtimeServerUrl();
  } catch (error) {
    return unavailable("url_missing", describeError(error));
  }

  const origin = describeRealtimeOrigin(baseUrl);
  const url = `${baseUrl}/api/room-membership/${encodeURIComponent(
    roomId,
  )}?userId=${encodeURIComponent(userId)}`;

  let response: Response;
  const startedAt = Date.now();
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: { [MEMBERSHIP_SECRET_HEADER]: secret },
      // Short on purpose: this runs inside a user-visible request, and a
      // slow game server must not hold the media join hostage. Failing
      // open is not an option, so we give up and report "unavailable".
      signal: AbortSignal.timeout(MEMBERSHIP_TIMEOUT_MS),
    });
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    return isTimeoutError(error)
      ? unavailable(
          "timeout",
          `${describeError(error)} (origin=${origin}, after ${elapsed}ms, budget ${MEMBERSHIP_TIMEOUT_MS}ms)`,
        )
      : unavailable(
          "network",
          `${describeError(error)} (origin=${origin}, after ${elapsed}ms)`,
        );
  }

  // A non-2xx here means OUR side is wrong, never a user-level refusal:
  // 403 is a shared-secret mismatch, 503 is the game server itself
  // missing its own secret. Collapsed into one branch because both mean
  // the same thing to us — we could not obtain a verdict.
  if (!response.ok) {
    return unavailable(
      "http_status",
      `realtime server answered ${response.status} ${response.statusText} (origin=${origin}, after ${Date.now() - startedAt}ms)`,
    );
  }

  let payload: RoomMembership;
  try {
    payload = (await response.json()) as RoomMembership;
  } catch (error) {
    // Deliberately NOT logging the body: an HTML error page from a proxy
    // is the usual cause, and the body may echo request internals.
    return unavailable(
      "invalid_payload",
      `${describeError(error)} (origin=${origin}, content-type=${response.headers.get("content-type") ?? "none"})`,
    );
  }

  if (!payload.member || (payload.role !== "player" && payload.role !== "spectator")) {
    console.info("[livekit-membership] not-a-member", logContext);
    return { ok: false, reason: "not-a-member" };
  }

  console.info(
    `[livekit-membership] ok role=${payload.role} (origin=${origin}, after ${Date.now() - startedAt}ms)`,
    logContext,
  );
  return { ok: true, role: payload.role, gameId: payload.gameId ?? "" };
}
