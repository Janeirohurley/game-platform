/**
 * Realtime (multiplayer) client configuration.
 *
 * Points the browser at the Colyseus game server and carries the shared
 * token settings agreed with server-games. Nothing else in the app should
 * read these env vars directly.
 */

/** Base URL of the Colyseus server, e.g. http://localhost:2567 */
export const REALTIME_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:2567";

/**
 * The issuer claim the Colyseus server expects on platform tokens.
 * Must match REALTIME_TOKEN_ISSUER in server-games.
 */
export const REALTIME_TOKEN_ISSUER = "game-platform";

/** Lifetime of a realtime join token, in seconds. */
export const REALTIME_TOKEN_TTL_SECONDS = 5 * 60;

/** Internal endpoint that mints the realtime token. */
export const REALTIME_TOKEN_ENDPOINT = "/api/realtime/token";
