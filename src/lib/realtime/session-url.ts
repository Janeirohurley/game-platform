"use client";

import type { Room } from "@colyseus/sdk";

/**
 * Room-session persistence across page refreshes.
 *
 * The room id lives in the URL (`?room=<id>`), the Colyseus
 * reconnection token in `sessionStorage` (same tab, same session —
 * never localStorage: another tab must not hijack the seat).
 *
 * On refresh the page re-derives everything:
 *   1. `client.reconnect(reconnectionToken)` — full state restoration
 *      (same seat, same role) while the server's grace window is open;
 *   2. otherwise a plain rejoin with the persisted mode — the server
 *      reclaims the seat for the same userId, or lands the viewer back
 *      as a spectator pending approval (its rules, not ours).
 *
 * Deliberate leaves and room closures wipe both markers so a stale URL
 * can never resurrect a dead session.
 */

const URL_PARAM = "room";

function storageKey(roomId: string): string {
  return `realtime:session:${roomId}`;
}

export interface PersistedRoomSession {
  reconnectionToken: string;
  mode: "play" | "watch";
}

/** Remember this room for refresh-restoration and reflect it in the URL. */
export function persistRoomSession(
  room: Room,
  mode: "play" | "watch",
): void {
  try {
    sessionStorage.setItem(
      storageKey(room.roomId),
      JSON.stringify({
        reconnectionToken: room.reconnectionToken,
        mode,
      } satisfies PersistedRoomSession),
    );
  } catch {
    // Storage unavailable (private mode quota, etc.): refresh restore
    // silently degrades to the plain rejoin path.
  }
  const url = new URL(window.location.href);
  url.searchParams.set(URL_PARAM, room.roomId);
  window.history.replaceState(null, "", url);
}

export function readRoomSession(
  roomId: string,
): PersistedRoomSession | null {
  try {
    const raw = sessionStorage.getItem(storageKey(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedRoomSession>;
    if (
      typeof parsed.reconnectionToken !== "string" ||
      (parsed.mode !== "play" && parsed.mode !== "watch")
    ) {
      return null;
    }
    return { reconnectionToken: parsed.reconnectionToken, mode: parsed.mode };
  } catch {
    return null;
  }
}

/** The room id a refresh (or a shared link) carries, if any. */
export function readRoomIdFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get(URL_PARAM);
  } catch {
    return null;
  }
}

/** Wipe both markers — deliberate leave or room closure. */
export function clearRoomSession(roomId: string): void {
  try {
    sessionStorage.removeItem(storageKey(roomId));
  } catch {
    // ignore
  }
  const url = new URL(window.location.href);
  if (url.searchParams.get(URL_PARAM) === roomId) {
    url.searchParams.delete(URL_PARAM);
    window.history.replaceState(null, "", url);
  }
}
