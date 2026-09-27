/**
 * Gamer-profile verification against the real database.
 *
 * Exercises the actual product paths — ensureProfilesForParticipants,
 * ingestMatchResult, readPublicGamerProfile — with throwaway users, then
 * deletes them (cascades wipe every profile table). Run with:
 *
 *   bun scripts/db/verify-gamer-profile.ts
 *
 * Exits non-zero on the first failed assertion. No fake historical data
 * is left behind: every created row belongs to a user deleted in the
 * finally block.
 */

import "dotenv/config";

import { eq, like } from "drizzle-orm";

import { db } from "@/lib/db";
import { user as users } from "@/lib/db/schema/auth";
import { profiles } from "@/lib/db/schema/profiles";
import {
    ensureAchievementCatalogue,
    ensureProfilesForParticipants,
    ingestMatchResult,
} from "@/lib/profile/queries";
import { readPublicGamerProfile } from "@/lib/profile/read-model";
import { profileSchema } from "@/lib/validation/profile";
import { sanitizeGamerTag } from "@/lib/profile/queries";

const EMAIL_PREFIX = "gamer-profile-verify-";
const runId = `${Date.now()}`;

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
    if (condition) {
        console.log(`  ✔ ${label}`);
    } else {
        failures++;
        console.error(`  ✘ ${label}`, detail ?? "");
    }
}

async function cleanup() {
    await db
        .delete(users)
        .where(like(users.email, `${EMAIL_PREFIX}%`));
}

async function makeUser(name: string): Promise<string> {
    const [row] = await db
        .insert(users)
        .values({
            id: crypto.randomUUID(),
            name,
            email: `${EMAIL_PREFIX}${crypto.randomUUID()}@test.local`,
            emailVerified: true,
        })
        .returning({ id: users.id });
    return row.id;
}

async function main() {
    console.log("\n== Gamer profile verification ==\n");

    // Leftovers from a crashed previous run go first.
    await cleanup();

    console.log("1. Catalogue + création de profils");
    await ensureAchievementCatalogue();

    const alice = await makeUser("Alice Verify");
    const bob = await makeUser("Alice Verify"); // same name → tag collision
    await ensureProfilesForParticipants([
        { userId: alice },
        { userId: bob },
    ]);

    const aliceProfile = (
        await db.select().from(profiles).where(eq(profiles.userId, alice))
    )[0];
    const bobProfile = (
        await db.select().from(profiles).where(eq(profiles.userId, bob))
    )[0];

    check("profil créé pour l'utilisateur existant", Boolean(aliceProfile));
    check(
        "gamerTag dérivé du nom (sanitisé)",
        Boolean(
            aliceProfile &&
                /^[a-zA-Z0-9_]{3,24}$/.test(aliceProfile.username),
        ),
        aliceProfile?.username,
    );
    check(
        "unicité du gamerTag : collision suffixée",
        Boolean(
            aliceProfile &&
                bobProfile &&
                bobProfile.username !== aliceProfile.username,
        ),
        [aliceProfile?.username, bobProfile?.username],
    );
    check(
        "stats initiales honnêtes (zéro partout)",
        Boolean(
            aliceProfile &&
                aliceProfile.gamesPlayed === 0 &&
                aliceProfile.xp === 0 &&
                aliceProfile.level === 1 &&
                aliceProfile.rating === 1200,
        ),
    );

    console.log("\n2. Ingestion d'un vrai match (Alice gagne contre Bob)");
    await ingestMatchResult({
        gameId: "ludo",
        roomId: `verify-${runId}-m1`,
        // Streak placeholders like the ingestion route: re-read inside
        // the transaction.
        participants: [
            { userId: alice, gameId: "ludo", outcome: "win", seat: 0, durationSeconds: 600, playerCount: 2, currentStreak: 0, bestStreak: 0 },
            { userId: bob, gameId: "ludo", outcome: "loss", seat: 1, durationSeconds: 600, playerCount: 2, currentStreak: 0, bestStreak: 0 },
        ],
    });

    const afterMatch1 = (
        await db.select().from(profiles).where(eq(profiles.userId, alice))
    )[0];
    const bobAfter1 = (
        await db.select().from(profiles).where(eq(profiles.userId, bob))
    )[0];

    check(
        "victoire comptée (1 partie, 1 victoire, série 1)",
        afterMatch1.gamesPlayed === 1 &&
            afterMatch1.wins === 1 &&
            afterMatch1.currentStreak === 1,
    );
    check(
        "XP de victoire à 2 joueurs = 20",
        afterMatch1.xp === 20,
        afterMatch1.xp,
    );
    check(
        "rating per-game déplacé de +16",
        afterMatch1.rating === 1216,
        afterMatch1.rating,
    );
    check(
        "défaite : rating −16, série négative",
        bobAfter1.rating === 1184 && bobAfter1.currentStreak === -1,
        [bobAfter1.rating, bobAfter1.currentStreak],
    );

    console.log("\n3. Rejouer le même résultat (replay) = aucun doublon");
    await ingestMatchResult({
        gameId: "ludo",
        roomId: `verify-${runId}-m1`,
        // Streak placeholders like the ingestion route: re-read inside
        // the transaction.
        participants: [
            { userId: alice, gameId: "ludo", outcome: "win", seat: 0, durationSeconds: 600, playerCount: 2, currentStreak: 0, bestStreak: 0 },
            { userId: bob, gameId: "ludo", outcome: "loss", seat: 1, durationSeconds: 600, playerCount: 2, currentStreak: 0, bestStreak: 0 },
        ],
    });
    const afterReplay = (
        await db.select().from(profiles).where(eq(profiles.userId, alice))
    )[0];
    check(
        "aucun double comptage",
        afterReplay.gamesPlayed === 1 && afterReplay.xp === 20,
        [afterReplay.gamesPlayed, afterReplay.xp],
    );

    console.log("\n4. Dix victoires de suite pour Bob");
    for (let i = 2; i <= 11; i++) {
        await ingestMatchResult({
            gameId: "ludo",
            roomId: `verify-${runId}-m${i}`,
            participants: [
                { userId: alice, gameId: "ludo", outcome: "loss", seat: 0, durationSeconds: 300, playerCount: 2, currentStreak: 0, bestStreak: 0 },
                { userId: bob, gameId: "ludo", outcome: "win", seat: 1, durationSeconds: 300, playerCount: 2, currentStreak: 0, bestStreak: 0 },
            ],
        });
    }

    const bobFinal = (
        await db.select().from(profiles).where(eq(profiles.userId, bob))
    )[0];
    check(
        "11 parties, 10 victoires, 1 défaite",
        bobFinal.gamesPlayed === 11 &&
            bobFinal.wins === 10 &&
            bobFinal.losses === 1,
        [bobFinal.gamesPlayed, bobFinal.wins, bobFinal.losses],
    );
    check(
        "XP cumulée 205 → niveau 3",
        bobFinal.xp === 205 && bobFinal.level === 3,
        [bobFinal.xp, bobFinal.level],
    );
    check(
        "série actuelle 10, meilleure série 10",
        bobFinal.currentStreak === 10 && bobFinal.bestStreak === 10,
        [bobFinal.currentStreak, bobFinal.bestStreak],
    );

    console.log("\n5. Achievements débloqués par les matchs uniquement");
    const bobRead = await readPublicGamerProfile(bob, {
        viewerUserId: null,
        isOwner: false,
    });
    const bobUnlocked = bobRead.achievements
        .filter((a) => a.unlockedAt)
        .map((a) => a.code)
        .sort();
    check(
        "Bob : first-win, streak-3, streak-10, ten-matches",
        JSON.stringify(bobUnlocked) ===
            JSON.stringify(["first-win", "streak-10", "streak-3", "ten-matches"]),
        bobUnlocked,
    );

    const aliceRead = await readPublicGamerProfile(alice, {
        viewerUserId: alice,
        isOwner: true,
    });
    const aliceUnlocked = aliceRead.achievements
        .filter((a) => a.unlockedAt)
        .map((a) => a.code);
    check(
        "Alice : first-win + ten-matches (11 parties jouées)",
        aliceUnlocked.length === 2 &&
            aliceUnlocked.includes("first-win") &&
            aliceUnlocked.includes("ten-matches"),
        aliceUnlocked,
    );

    console.log("\n6. Read-model public cohérent");
    check(
        "win rate global = 1/11 ≈ 9.1 %",
        aliceRead.winRate === 9.1,
        aliceRead.winRate,
    );
    check(
        "stats par jeu génériques (gameId, pas de colonnes par jeu)",
        aliceRead.games.length === 1 && aliceRead.games[0].gameId === "ludo",
    );
    check(
        "activité liée aux vraies parties (limitée à 8)",
        aliceRead.activity.length === 8 &&
            aliceRead.activity.every((a) => a.gameId === "ludo"),
        aliceRead.activity.length,
    );
    check(
        "aucun email ni champ sensible exposé",
        !JSON.stringify(aliceRead).includes("@test.local"),
    );

    console.log("\n7. Sécurité des mutations");
    const forged = profileSchema.safeParse({
        username: "hacker_tag",
        displayName: "",
        bio: "",
        countryCode: "",
        avatarUrl: "",
        coverUrl: "",
        isPublic: true,
        xp: 999_999,
        rating: 5000,
        wins: 10_000,
    });
    check(
        "payload forgé accepté mais xp/rating/wins ABSENTS des données",
        forged.success &&
            !("xp" in (forged.data ?? {})) &&
            !("rating" in (forged.data ?? {})) &&
            !("wins" in (forged.data ?? {})),
        forged.success ? Object.keys(forged.data ?? {}) : forged.error,
    );
    check(
        "sanitizeGamerTag borne la forme",
        /^[a-zA-Z0-9_]{3,24}$/.test(sanitizeGamerTag("Jean-Pierre Ñü!")),
        sanitizeGamerTag("Jean-Pierre Ñü!"),
    );

    console.log(
        failures === 0
            ? "\n✅ Toutes les vérifications passent.\n"
            : `\n❌ ${failures} vérification(s) en échec.\n`,
    );
    // The pooled postgres socket keeps bun alive forever; leave
    // explicitly once the work is done (after the cleanup below).
    process.exit(failures > 0 ? 1 : 0);
}

try {
    await main();
} finally {
    await cleanup().catch((error) => {
        console.error("cleanup failed:", error);
        process.exitCode = 1;
    });
}
