/**
 * Realtime (multiplayer) client configuration.
 *
 * Points the browser at the Colyseus game server and carries the shared
 * token settings agreed with server-games. Nothing else in the app should
 * read these env vars directly.
 */

/** Port the Colyseus server listens on. */
export const REALTIME_PORT = 2567;

/** Fallback used during server rendering, where there is no page URL. */
const SSR_FALLBACK = `http://192.168.2.61:${REALTIME_PORT}`;

/**
 * Base URL of the Colyseus server.
 *
 * Resolved when a connection is opened rather than when this module is
 * loaded, because the right answer depends on the page the browser is
 * actually on:
 *
 * - `NEXT_PUBLIC_REALTIME_URL` wins whenever it is set. That is what a
 *   real deployment uses, and it is baked into the bundle at build time.
 * - With nothing set, the URL is derived from the page's own address.
 *   Hardcoding `192.168.2.61` breaks the moment the app is opened from
 *   anywhere but the machine running the server: a phone or a second
 *   computer on the LAN would aim at *its own* 192.168.2.61, where nothing
 *   is listening, and every join fails before it reaches the network.
 *
 * The scheme follows the page too. A page served over HTTPS cannot talk
 * to a plain-HTTP game server — the browser blocks it as mixed content —
 * so the realtime server needs TLS as well in that case, or an explicit
 * `NEXT_PUBLIC_REALTIME_URL`.
 */
export function resolveRealtimeUrl(): string {
  const configured = process.env.NEXT_PUBLIC_REALTIME_URL?.trim();
  if (configured) return configured;

  if (typeof window === "undefined") return SSR_FALLBACK;

  const { protocol, hostname } = window.location;
  const scheme = protocol === "https:" ? "https:" : "http:";
  return `${scheme}//${hostname}:${REALTIME_PORT}`;
}

/**
 * The issuer claim the Colyseus server expects on platform tokens.
 * Must match REALTIME_TOKEN_ISSUER in server-games.
 */
export const REALTIME_TOKEN_ISSUER = "game-platform";

/** Lifetime of a realtime join token, in seconds. */
export const REALTIME_TOKEN_TTL_SECONDS = 5 * 60;

/** Internal endpoint that mints the realtime token. */
export const REALTIME_TOKEN_ENDPOINT = "/api/realtime/token";
