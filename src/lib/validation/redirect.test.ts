import { describe, expect, test } from "bun:test";

import { DEFAULT_AUTH_REDIRECT, sanitizeCallbackUrl } from "./redirect";

describe("sanitizeCallbackUrl", () => {
  test("keeps same-site relative paths, including query strings", () => {
    expect(sanitizeCallbackUrl("/games")).toBe("/games");
    expect(sanitizeCallbackUrl("/games/ludo/play?table=casual")).toBe(
      "/games/ludo/play?table=casual",
    );
    expect(sanitizeCallbackUrl("  /profile  ")).toBe("/profile");
    expect(sanitizeCallbackUrl("/")).toBe("/");
  });

  test("falls back for absent, empty or oversized input", () => {
    expect(sanitizeCallbackUrl(null)).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeCallbackUrl(undefined)).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeCallbackUrl("")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeCallbackUrl("/" + "a".repeat(4096))).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
  });

  test("rejects absolute external URLs", () => {
    expect(sanitizeCallbackUrl("https://evil.example")).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
    expect(sanitizeCallbackUrl("http://evil.example")).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
    expect(sanitizeCallbackUrl("ftp://evil.example")).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
    expect(sanitizeCallbackUrl("evil.example/games")).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
  });

  test("rejects protocol-relative and backslash tricks", () => {
    expect(sanitizeCallbackUrl("//evil.example")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeCallbackUrl("/\\evil.example")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeCallbackUrl("\\\\evil.example")).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
  });

  test("rejects a scheme hidden behind the leading slash", () => {
    expect(sanitizeCallbackUrl("javascript:alert(1)")).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
    expect(sanitizeCallbackUrl("/javascript:alert(1)")).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
    expect(sanitizeCallbackUrl("/data:text/html,<script>")).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
  });

  test("rejects control characters and interior whitespace", () => {
    expect(sanitizeCallbackUrl("/a\nb")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeCallbackUrl("/a\tb")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeCallbackUrl("/a b")).toBe(DEFAULT_AUTH_REDIRECT);
    expect(sanitizeCallbackUrl("/a\r\nSet-Cookie:x")).toBe(
      DEFAULT_AUTH_REDIRECT,
    );
  });

  test("honours a custom fallback", () => {
    expect(sanitizeCallbackUrl("//evil.example", "/")).toBe("/");
  });
});
