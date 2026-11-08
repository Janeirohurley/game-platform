import type { RoomListing } from "./types";

/**
 * Choosing where "Partie rapide" sends a player.
 *
 * Kept out of the component on purpose: this is the one piece of the new
 * matchmaking that can be wrong in a way nobody notices — sending players
 * to a table that cannot seat them, or scattering them across half-empty
 * rooms so no match ever starts. Pure input/output, so it is testable
 * without a browser.
 *
 * Deliberately NOT Colyseus' `joinOrCreate`: that call picks any unlocked
 * room of the type, including one already PLAYING, and this server
 * refuses a player there (`ServerError 4010`) from inside `onJoin`. The
 * SDK surfaces that error rather than trying the next room, so quick play
 * would fail precisely when tables exist. Choosing here, from the listing
 * the page already polls, keeps the decision where `phase` and the seat
 * counts are visible.
 */

/**
 * Free player seats at a table, or `null` when it cannot take one.
 *
 * `null` covers three different refusals on purpose — the match has
 * started, it is finished, or it is full — because the caller only ever
 * needs "can this seat me?". Spectators never count: they are outside
 * capacity, which is why `players` is compared to `targetPlayers` rather
 * than to the client count.
 */
export function freeSeats(room: RoomListing): number | null {
  const meta = room.metadata;
  const phase = meta?.phase ?? "waiting";
  if (phase !== "waiting" && phase !== "ready") return null;
  // `targetPlayers` is the table size the host chose; `maxPlayers` is the
  // game's ceiling and only a fallback for a listing that predates it.
  const capacity = meta?.targetPlayers ?? meta?.maxPlayers ?? 0;
  if (capacity <= 0) return null;
  const seated = meta?.players ?? 0;
  return seated < capacity ? capacity - seated : null;
}

/**
 * Joinable tables, best first.
 *
 * Fewest free seats first: filling a table that needs one more player
 * starts a match now, while spreading arrivals over empty tables starts
 * none. Ties break on room id so the order is stable between two polls
 * and the list does not reshuffle under the player.
 */
export function rankQuickPlayCandidates(
  rooms: readonly RoomListing[],
): RoomListing[] {
  return rooms
    .map((listing) => ({ listing, free: freeSeats(listing) }))
    .filter(
      (entry): entry is { listing: RoomListing; free: number } =>
        entry.free !== null,
    )
    .sort(
      (a, b) =>
        a.free - b.free || a.listing.roomId.localeCompare(b.listing.roomId),
    )
    .map((entry) => entry.listing);
}
