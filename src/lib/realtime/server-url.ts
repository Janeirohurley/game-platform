/**
 * Sanity checks for `REALTIME_SERVER_URL`.
 *
 * This value is typed by hand into a hosting dashboard and then
 * concatenated with `/api/room-membership/…`. A trailing slash — an
 * invisible character in a settings form — therefore builds `//api/…`,
 * which matches no route: the game server answers `404 Cannot GET //api`
 * as an HTML page, and the media token route faithfully turns that into
 * an opaque `503` for every user. One invisible character, voice dead in
 * production, nothing in the logs to point at it.
 *
 * Hence two halves, deliberately separated:
 *
 *   - `normalizeRealtimeServerUrl` repairs what is repairable, so the
 *     runtime never depends on a human pasting a pristine value;
 *   - `inspectRealtimeServerUrl` describes what it found, so
 *     `instrumentation.ts` can say so at server start instead of the
 *     operator learning about it from a 503.
 *
 * Pure and dependency-free on purpose: no `server-only`, no env access,
 * so it can be unit tested and imported from either runtime.
 */

/** A misconfiguration worth reporting at boot. */
export interface RealtimeServerUrlIssue {
  /** Stable, greppable token — never the offending value itself. */
  readonly code:
    | "missing"
    | "trailing_slash"
    | "surrounding_whitespace"
    | "websocket_scheme"
    | "unsupported_scheme"
    | "unparseable"
    | "embedded_credentials";
  /** Operator-facing sentence. Safe to log: never echoes the value. */
  readonly detail: string;
}

const WEBSOCKET_SCHEME = /^wss?:\/\//i;

/**
 * The value to concatenate a path onto: trimmed, without trailing
 * slashes.
 *
 * Exported so the request builder and the boot-time report can never
 * disagree about what "clean" means — the bug this exists for was a
 * normalization that lived in one place while the log rendered another.
 * A value made only of slashes normalizes to the empty string, which
 * callers treat as unset rather than as a relative path.
 */
export function normalizeRealtimeServerUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/**
 * Everything wrong with the configured value, most actionable first.
 *
 * Returns an empty array when the value is usable. Details deliberately
 * describe the *consequence* instead of repeating the value: a URL can
 * carry a token in its path or credentials in its userinfo, and this
 * text lands in deploy logs.
 */
export function inspectRealtimeServerUrl(
  raw: string | undefined,
): RealtimeServerUrlIssue[] {
  if (raw === undefined || raw.trim() === "") {
    return [
      {
        code: "missing",
        detail:
          "is not set. Required in production: without it the media token route cannot verify room membership and answers 503 to everyone.",
      },
    ];
  }

  const issues: RealtimeServerUrlIssue[] = [];
  const trimmed = raw.trim();

  if (raw !== trimmed) {
    issues.push({
      code: "surrounding_whitespace",
      detail:
        "has leading or trailing whitespace — a copy-paste slip. The runtime trims it, but the stored value should match what is actually requested.",
    });
  }

  if (/\/+$/.test(trimmed)) {
    issues.push({
      code: "trailing_slash",
      detail:
        "ends with a slash, so requests are built as //api/room-membership/… which matches no route: the game server answers 404 Cannot GET //api in HTML and the media token route reports an opaque 503. The runtime strips it, but fix the variable.",
    });
  }

  if (WEBSOCKET_SCHEME.test(trimmed)) {
    issues.push({
      code: "websocket_scheme",
      detail:
        "uses a ws:// or wss:// scheme. This variable addresses the game server's HTTP API, not the Colyseus socket the browser opens — use http:// or https://.",
    });
  }

  let parsed: URL | undefined;
  try {
    parsed = new URL(trimmed);
  } catch {
    issues.push({
      code: "unparseable",
      detail:
        "is not a parseable absolute URL. It needs a scheme and a host, for example https://games.example.com",
    });
  }

  if (parsed) {
    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:" &&
      !WEBSOCKET_SCHEME.test(trimmed)
    ) {
      issues.push({
        code: "unsupported_scheme",
        detail: `uses the ${parsed.protocol} scheme; only http and https can carry this request.`,
      });
    }
    if (parsed.username || parsed.password) {
      issues.push({
        code: "embedded_credentials",
        detail:
          "embeds credentials in the URL. They are useless to the fetch and would be written to logs — move them to REALTIME_TOKEN_SECRET.",
      });
    }
  }

  return issues;
}
