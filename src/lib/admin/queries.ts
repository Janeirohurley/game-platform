/**
 * Admin queries — the database access layer for the /admin control plane.
 *
 * Server-only, same discipline as `lib/profile/queries.ts`: imported by
 * admin server components/actions only, never reachable from a client
 * bundle. Phase 1 exposes READ-ONLY counts; every later admin feature
 * (users, matches, actions…) adds its query here instead of querying
 * from a component.
 */

import { count } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/auth";
import { gameMatches, profiles } from "@/lib/db/schema/profiles";
import { GAMES } from "@/lib/games/registry";

/** Everything the Phase 1 dashboard shows — all of it real data. */
export interface AdminOverview {
  totalUsers: number;
  totalGamers: number;
  totalGames: number;
  totalMatches: number;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [users, gamers, matches] = await Promise.all([
    db.select({ value: count() }).from(user),
    db.select({ value: count() }).from(profiles),
    db.select({ value: count() }).from(gameMatches),
  ]);

  return {
    totalUsers: users[0]?.value ?? 0,
    totalGamers: gamers[0]?.value ?? 0,
    // The registry IS the games catalogue (schema/design decision of the
    // platform): its length is the real count, no games table exists.
    totalGames: GAMES.length,
    totalMatches: matches[0]?.value ?? 0,
  };
}
