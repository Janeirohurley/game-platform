/**
 * Centralized validation for post-authentication redirects.
 *
 * Better Auth's server already refuses callback URLs whose origin is not
 * in `trustedOrigins`, but the client must never build a link pointing
 * out of the site in the first place: a malicious `?redirect=` value
 * would otherwise turn the sign-in page into an open redirect.
 *
 * The rule is deliberately strict — only same-site, relative paths are
 * accepted. Anything else falls back to a known-safe destination.
 */

export const DEFAULT_AUTH_REDIRECT = "/games";

// Conservative cap: real in-app paths are far shorter, and an oversized
// value only wastes bytes in the URL / verification row.
const MAX_REDIRECT_LENGTH = 2048;

export function sanitizeCallbackUrl(
  raw: string | null | undefined,
  fallback: string = DEFAULT_AUTH_REDIRECT,
): string {
  if (typeof raw !== "string") {
    return fallback;
  }

  const value = raw.trim();

  if (value.length === 0 || value.length > MAX_REDIRECT_LENGTH) {
    return fallback;
  }

  // Must be a site-relative path.
  if (!value.startsWith("/")) {
    return fallback;
  }

  // Reject protocol-relative ("//evil.com") and backslash variants
  // ("/\evil.com"), which browsers normalize to another origin.
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }

  // Reject control characters and any interior whitespace/newline that
  // could be used to smuggle a second value or header.
  if (/[\u0000-\u001f\u007f]/.test(value) || /\s/.test(value)) {
    return fallback;
  }

  // Reject an explicit scheme hiding behind the leading slash, e.g.
  // "/javascript:alert(1)".
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    return fallback;
  }

  return value;
}
