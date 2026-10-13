/**
 * Bot identity generator — local, seeded, dependency-free.
 *
 * Why not a third-party fake-data service: the name has to be STABLE for
 * the life of the bot (a player trains against the same opponent from one
 * session to the next), the whole pipeline has to work offline, and the
 * resulting row is a real platform account — so nothing about it should
 * depend on a remote catalogue we do not control.
 *
 * The generator is a pure function of a seed: same seed, same identity.
 * That makes provisioning reproducible in tests and lets the persisted
 * `bot` row be the single source of truth while the seed stays the audit
 * trail. Randomness comes from `randomBotSeed()` at call time.
 *
 * Pools are deliberately ASCII: a gamer tag must satisfy
 * `profiles_username` (3–24, [a-zA-Z0-9_]) and passes through
 * `sanitizeGamerTag`, which strips anything non-word. ASCII keeps the
 * generated tag and its display form in sync with no accent folding.
 */

import {
    BOT_DIFFICULTIES,
    type BotDifficulty,
} from "@/lib/db/schema/bots";

/** Deterministic PRNG (mulberry32): 32-bit seed → uniform [0, 1). */
export function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Uniform pick from a non-empty list. */
export function pickFrom<T>(random: () => number, items: readonly T[]): T {
    if (items.length === 0) {
        throw new Error("pickFrom requires a non-empty list");
    }
    return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/** Fresh 32-bit seed for real provisioning (not for tests). */
export function randomBotSeed(): number {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
}

/** ASCII display adjectives — no accents, so tag == display stem. */
const ADJECTIVES = [
    "Agile",
    "Furtif",
    "Malin",
    "Vaillant",
    "Rapide",
    "Sournois",
    "Audacieux",
    "Tenace",
    "Vif",
    "Astucieux",
    "Sauvage",
    "Serein",
    "Ruse",
    "Fonceur",
    "Discret",
    "Superbe",
] as const;

/** ASCII totem nouns — the second half of the identity. */
const CREATURES = [
    "Renard",
    "Tigre",
    "Faucon",
    "Loup",
    "Panda",
    "Dragon",
    "Corbeau",
    "Lynx",
    "Aigle",
    "Viper",
    "Ours",
    "Requin",
    "Heron",
    "Puma",
    "Blaireau",
    "Phénix".replace("é", "e"),
] as const;

export interface GeneratedBotIdentity {
    /** Public display name, e.g. "Furtif Renard". */
    displayName: string;
    /** Legal gamer tag stem, e.g. "FurtifRenard42" (unique handled later). */
    gamerTag: string;
    /** Difficulty chosen with the seed, fixed for the bot's life. */
    difficulty: BotDifficulty;
    /** The seed this identity was derived from (audit trail). */
    seed: number;
}

/**
 * Derive one bot identity from a seed.
 *
 * The two-digit suffix is part of the tag, not a collision patch: it
 * spreads the name space so two bots sharing an adjective and a creature
 * rarely collide before the provisioning layer's suffix fallback ever
 * runs. Uniqueness itself is enforced by `profiles.username`, and the
 * provisioning service retries on conflict — this function only promises
 * a VALID candidate.
 */
export function generateBotIdentity(seed: number): GeneratedBotIdentity {
    const random = mulberry32(seed);
    const adjective = pickFrom(random, ADJECTIVES);
    const creature = pickFrom(random, CREATURES);
    const suffix = Math.floor(random() * 90) + 10; // 10–99
    const difficulty = pickFrom(random, BOT_DIFFICULTIES);

    return {
        displayName: `${adjective} ${creature}`,
        gamerTag: `${adjective}${creature}${suffix}`,
        difficulty,
        seed,
    };
}

/**
 * Reserved, non-routable e-mail for a bot account. `.invalid` is
 * guaranteed never to resolve (RFC 2606), so even a misconfigured mailer
 * treats it as undeliverable — and no mailbox exists to be compromised.
 */
export function botEmail(userId: string): string {
    return `bot+${userId}@bots.invalid`;
}
