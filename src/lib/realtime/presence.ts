"use client";

/**
 * Realtime presence for gamer profiles.
 *
 * Presence is a VIEW over the live rooms, never a stored profile field:
 * the profile page asks the game server "who is in a room right now?"
 * and shows the answer, or nothing when the server is unreachable.
 * Offline is the absence of a row, not data.
 */

import { resolveRealtimeUrl } from "./config";

export interface RealtimePresence {
    state: "in-match" | "spectating";
    gameId: string;
}

/**
 * Ask the realtime server for the presence of a handful of users.
 * Server-rendered pages call this through resolvePresence() with a
 * short timeout so a slow game server can never hold a page hostage.
 */
export async function fetchRealtimePresence(
    userIds: string[],
): Promise<Record<string, RealtimePresence>> {
    if (userIds.length === 0) return {};

    const url = `${resolveRealtimeUrl()}/api/presence?ids=${encodeURIComponent(
        userIds.join(","),
    )}`;

    const response = await fetch(url, {
        // Next.js caching is explicitly unwanted here: presence is "now".
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) {
        throw new Error(`Presence unavailable (HTTP ${response.status})`);
    }

    const payload = (await response.json()) as {
        users?: Record<string, RealtimePresence>;
    };
    return payload.users ?? {};
}
