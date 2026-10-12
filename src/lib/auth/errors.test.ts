import { describe, expect, test } from "bun:test";

import { describeAuthError, GENERIC_AUTH_ERROR_MESSAGE } from "./errors";

describe("describeAuthError", () => {
  test("maps known Better Auth codes to French copy", () => {
    expect(describeAuthError({ code: "INVALID_TOKEN" })).toContain("invalide");
    expect(describeAuthError({ code: "EXPIRED_TOKEN" })).toContain("expiré");
    expect(describeAuthError({ code: "failed_to_create_session" })).toContain(
      "Connexion impossible",
    );
  });

  test("maps an HTTP 429 to the rate-limit message", () => {
    expect(describeAuthError({ status: 429 })).toContain("Trop de tentatives");
  });

  test("falls back to message hints when no code is present", () => {
    expect(describeAuthError({ message: "Token has expired" })).toContain(
      "expiré",
    );
    expect(describeAuthError({ message: "SMTP send failed" })).toContain(
      "envoyer l'e-mail",
    );
  });

  test("never surfaces a raw technical message", () => {
    const result = describeAuthError({ message: "pg: deadlock detected" });

    expect(result).toBe(GENERIC_AUTH_ERROR_MESSAGE);
  });

  test("handles empty or absent errors", () => {
    expect(describeAuthError(null)).toBe(GENERIC_AUTH_ERROR_MESSAGE);
    expect(describeAuthError(undefined)).toBe(GENERIC_AUTH_ERROR_MESSAGE);
    expect(describeAuthError({})).toBe(GENERIC_AUTH_ERROR_MESSAGE);
  });
});
