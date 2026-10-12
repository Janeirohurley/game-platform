import { describe, expect, test } from "bun:test";

import {
  magicLinkSignInSchema,
  magicLinkSignUpSchema,
} from "./auth";

describe("magicLinkSignInSchema", () => {
  test("accepts a valid address and normalizes it to lower case", () => {
    const parsed = magicLinkSignInSchema.parse({ email: "Alice@Example.COM" });

    expect(parsed.email).toBe("alice@example.com");
  });

  test("rejects a malformed address", () => {
    const result = magicLinkSignInSchema.safeParse({ email: "not-an-email" });

    expect(result.success).toBe(false);
  });

  test("rejects an empty address", () => {
    expect(magicLinkSignInSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("magicLinkSignUpSchema", () => {
  test("accepts a valid name and normalizes the address", () => {
    const parsed = magicLinkSignUpSchema.parse({
      email: "Bob@Example.com",
      name: "bob_95",
    });

    expect(parsed.email).toBe("bob@example.com");
    expect(parsed.name).toBe("bob_95");
  });

  test("trims the name", () => {
    const parsed = magicLinkSignUpSchema.parse({
      email: "bob@example.com",
      name: "  bob_95  ",
    });

    expect(parsed.name).toBe("bob_95");
  });

  test("rejects a name shorter than 3 characters", () => {
    const result = magicLinkSignUpSchema.safeParse({
      email: "bob@example.com",
      name: "ab",
    });

    expect(result.success).toBe(false);
  });

  test("rejects forbidden characters in the name", () => {
    const result = magicLinkSignUpSchema.safeParse({
      email: "bob@example.com",
      name: "bad name!",
    });

    expect(result.success).toBe(false);
  });

  test("rejects an invalid address", () => {
    const result = magicLinkSignUpSchema.safeParse({
      email: "nope",
      name: "bob_95",
    });

    expect(result.success).toBe(false);
  });
});
