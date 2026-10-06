import { describe, expect, it } from "bun:test";

import {
  inspectRealtimeServerUrl,
  normalizeRealtimeServerUrl,
} from "./server-url";

/**
 * Regression cover for the production outage caused by one invisible
 * character: `REALTIME_SERVER_URL` ending in a slash built
 * `//api/room-membership/…`, the game server answered `404 Cannot GET
 * //api` as HTML, and every user got an unexplained 503 on the media
 * token route. The request builder normalizes; these tests pin both the
 * repair and the boot-time report that makes the mistake visible.
 */
describe("normalizeRealtimeServerUrl", () => {
  it("leaves a clean origin untouched", () => {
    expect(normalizeRealtimeServerUrl("https://games.example.com")).toBe(
      "https://games.example.com",
    );
  });

  it("strips the trailing slash that breaks the request path", () => {
    expect(normalizeRealtimeServerUrl("https://games.example.com/")).toBe(
      "https://games.example.com",
    );
  });

  it("strips repeated trailing slashes and stray whitespace", () => {
    expect(normalizeRealtimeServerUrl("  https://games.example.com///  ")).toBe(
      "https://games.example.com",
    );
  });

  it("keeps a path prefix, which is a legitimate deployment shape", () => {
    expect(normalizeRealtimeServerUrl("https://example.com/realtime/")).toBe(
      "https://example.com/realtime",
    );
  });

  it("reduces a value made only of slashes to unset, not to a relative path", () => {
    expect(normalizeRealtimeServerUrl("///")).toBe("");
  });
});

describe("inspectRealtimeServerUrl", () => {
  const codes = (raw: string | undefined) =>
    inspectRealtimeServerUrl(raw).map((issue) => issue.code);

  it("says nothing about a clean value", () => {
    expect(codes("https://games.example.com")).toEqual([]);
  });

  it("reports a trailing slash, the outage we shipped", () => {
    expect(codes("https://games.example.com/")).toContain("trailing_slash");
  });

  it("reports every independent problem at once", () => {
    expect(codes(" wss://games.example.com/ ")).toEqual([
      "surrounding_whitespace",
      "trailing_slash",
      "websocket_scheme",
    ]);
  });

  it("distinguishes unset from empty", () => {
    expect(codes(undefined)).toEqual(["missing"]);
    expect(codes("   ")).toEqual(["missing"]);
  });

  it("rejects a websocket scheme with its own message, not a generic one", () => {
    const [issue] = inspectRealtimeServerUrl("wss://games.example.com");
    expect(issue.code).toBe("websocket_scheme");
    expect(issue.detail).toContain("HTTP API");
  });

  it("flags a scheme that cannot carry the request", () => {
    expect(codes("ftp://games.example.com")).toContain("unsupported_scheme");
  });

  it("flags an unparseable value", () => {
    expect(codes("games.example.com")).toEqual(["unparseable"]);
  });

  it("flags credentials embedded in the URL", () => {
    expect(codes("https://user:pass@games.example.com")).toContain(
      "embedded_credentials",
    );
  });

  it("never echoes the offending value into a loggable detail", () => {
    for (const raw of [
      "https://user:s3cr3t-token@games.example.com/",
      "https://games.example.com/?key=abcd1234",
    ]) {
      for (const issue of inspectRealtimeServerUrl(raw)) {
        expect(issue.detail).not.toContain("s3cr3t-token");
        expect(issue.detail).not.toContain("abcd1234");
      }
    }
  });
});
