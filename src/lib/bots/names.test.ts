/**
 * names.test.ts — pins the identity generator's contract.
 *
 * The generator is a pure function of a seed, and the bot row persists
 * its output as a REAL account, so two properties matter above all:
 * determinism (same seed → same opponent, forever) and validity (every
 * generated tag must satisfy the profiles_username constraint). The rest
 * guards the plumbing (PRNG range, empty-list pick, reserved e-mail).
 */

import { describe, expect, test } from "bun:test";

import { BOT_DIFFICULTIES, isBotDifficulty } from "@/lib/db/schema/bots";
import {
    botEmail,
    generateBotIdentity,
    mulberry32,
    pickFrom,
    randomBotSeed,
} from "./names";

const TAG_RE = /^[a-zA-Z0-9_]{3,24}$/;

describe("mulberry32", () => {
    test("stays in [0, 1) over many draws", () => {
        const random = mulberry32(12345);
        for (let i = 0; i < 5000; i++) {
            const value = random();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    test("is reproducible for a given seed", () => {
        const a = mulberry32(42);
        const b = mulberry32(42);
        for (let i = 0; i < 100; i++) {
            expect(a()).toBe(b());
        }
    });
});

describe("pickFrom", () => {
    test("returns an item from the list", () => {
        const items = ["a", "b", "c"] as const;
        const random = mulberry32(7);
        for (let i = 0; i < 50; i++) {
            expect(items).toContain(pickFrom(random, items));
        }
    });

    test("throws on an empty list rather than returning undefined", () => {
        expect(() => pickFrom(mulberry32(1), [])).toThrow();
    });
});

describe("generateBotIdentity", () => {
    test("is fully deterministic for a seed", () => {
        expect(generateBotIdentity(987654)).toEqual(generateBotIdentity(987654));
    });

    test("produces distinct identities for distinct seeds", () => {
        const a = generateBotIdentity(1);
        const b = generateBotIdentity(2);
        expect(`${a.gamerTag}|${a.difficulty}`).not.toBe(
            `${b.gamerTag}|${b.difficulty}`,
        );
    });

    test("always emits a profile-legal gamer tag", () => {
        for (let seed = 0; seed < 2000; seed++) {
            const { gamerTag } = generateBotIdentity(seed);
            expect(gamerTag).toMatch(TAG_RE);
        }
    });

    test("always emits a known difficulty", () => {
        for (let seed = 0; seed < 1000; seed++) {
            const { difficulty } = generateBotIdentity(seed);
            expect(isBotDifficulty(difficulty)).toBe(true);
        }
    });

    test("covers every difficulty across the seed space", () => {
        const seen = new Set<string>();
        for (let seed = 0; seed < 500; seed++) {
            seen.add(generateBotIdentity(seed).difficulty);
        }
        for (const difficulty of BOT_DIFFICULTIES) {
            expect(seen.has(difficulty)).toBe(true);
        }
    });

    test("echoes the seed it was derived from", () => {
        expect(generateBotIdentity(2024).seed).toBe(2024);
    });
});

describe("botEmail", () => {
    test("is rooted in a reserved, non-routable domain", () => {
        const email = botEmail("bot_abc-123");
        expect(email).toBe("bot+bot_abc-123@bots.invalid");
        expect(email.endsWith("@bots.invalid")).toBe(true);
    });
});

describe("randomBotSeed", () => {
    test("returns an unsigned 32-bit integer", () => {
        for (let i = 0; i < 100; i++) {
            const seed = randomBotSeed();
            expect(Number.isInteger(seed)).toBe(true);
            expect(seed).toBeGreaterThanOrEqual(0);
            expect(seed).toBeLessThanOrEqual(0xffffffff);
        }
    });
});
