import type { Room } from "@colyseus/sdk";

import type { SeatStatePayload } from "./types";

/**
 * Bounded wait so a slow or empty bot pool never traps a creator on the
 * "préparation" screen. Also the ceiling when the socket never answers.
 */
export const SEAT_PREPARE_TIMEOUT_MS = 20_000;

/**
 * Resolves once the server has reported the room's seat state — the lobby's
 * acknowledgement of the join — so a caller can hold a "préparation" screen
 * until it knows the table (and any AI seats) is ready.
 *
 * `onProgress` receives every `seatState` update, which lets a caller show
 * "Installation des adversaires IA (x/y)…". The server pushes `seatState`
 * on join; the extra `querySeatState` covers the race where that push lands
 * before this listener is attached. Falls back to `timeoutMs`.
 */
export function waitForRoomReady(
  room: Room,
  onProgress?: (payload: SeatStatePayload) => void,
  timeoutMs = SEAT_PREPARE_TIMEOUT_MS,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    let off: (() => void) | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      off?.();
      resolve();
    };
    off = room.onMessage("seatState", (payload: SeatStatePayload) => {
      onProgress?.(payload);
      if ((payload?.pending ?? 0) <= 0) finish();
    });
    const timer = window.setTimeout(finish, timeoutMs);
    try {
      room.send("querySeatState", {});
    } catch {
      // The socket is not ready yet — the timeout above is the fallback.
    }
  });
}
