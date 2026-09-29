import "server-only";

import { RoomServiceClient } from "livekit-server-sdk";

import { readLiveKitServerCredentials } from "@/lib/livekit/config";

/**
 * Admin → LiveKit client for the media operational page (Phase 8).
 *
 * Uses the OFFICIAL RoomServiceClient from the already-installed
 * `livekit-server-sdk` (no new dependency, no invented protocol) to
 * read the LIVE voice rooms of the media server. Credentials are the
 * same LIVEKIT_API_KEY/SECRET the token route signs with — this is a
 * server-only module, they never reach a client bundle.
 *
 * The internal address is NOT the browser-facing NEXT_PUBLIC_LIVEKIT_URL
 * per se, but the same HOST with an http scheme: the platform dials the
 * media server server-to-server. Resolution order:
 *
 *   1. LIVEKIT_INTERNAL_URL (explicit override, mirrors
 *      INTERNAL_REALTIME_URL for the realtime server),
 *   2. NEXT_PUBLIC_LIVEKIT_URL with ws(s):// → http(s):// (works when
 *      the platform runs on the host, the dev setup here),
 *   3. http://localhost:7880 as the last dev fallback.
 *
 * Never throws: every failure becomes an honest `unavailable` state —
 * the console must distinguish "no voice traffic" from "media server
 * down", never show a fake empty list.
 */

/** One active voice room on the media server. */
export interface AdminLiveKitRoom {
  name: string;
  /** Linked Colyseus room id when the name follows the game-room-<id>
   * convention (lib/livekit/config), null otherwise. */
  gameRoomId: string | null;
  numParticipants: number;
  /** Epoch SECONDS, LiveKit's creationTime semantics. */
  createdAt: number | null;
  participants: {
    identity: string;
    name: string;
    /** Platform user id when the identity is `user-<id>` (server-minted). */
    userId: string | null;
    isGuest: boolean;
  }[];
}

export type AdminLiveKitStatus =
  | { ok: true; rooms: AdminLiveKitRoom[] }
  | { ok: false; reason: "unavailable"; message: string };

function resolveInternalMediaUrl(): string {
  const override = process.env.LIVEKIT_INTERNAL_URL?.trim();
  if (override) return override.replace(/^ws(s?):\/\//, "http$1://");

  const publicUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();
  if (publicUrl) return publicUrl.replace(/^ws(s?):\/\//, "http$1://");

  // Same dev default as resolveRealtimeServerUrl in the membership module.
  return "http://127.0.0.1:7880";
}

/** The game room id behind a derived LiveKit name, when applicable. */
function linkedGameRoomId(liveKitRoomName: string): string | null {
  return liveKitRoomName.startsWith("game-room-")
    ? liveKitRoomName.slice("game-room-".length)
    : null;
}

export async function getLiveKitOperationalStatus(): Promise<AdminLiveKitStatus> {
  const credentials = readLiveKitServerCredentials();
  if (!credentials) {
    return {
      ok: false,
      reason: "unavailable",
      message:
        "LIVEKIT_API_KEY / LIVEKIT_API_SECRET ne sont pas configurés côté plateforme.",
    };
  }

  // Hard client-side cap so a dead media server never holds the page.
  const client = new RoomServiceClient(
    resolveInternalMediaUrl(),
    credentials.apiKey,
    credentials.apiSecret,
  );
  const roomsPromise = client.listRooms([]);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 5_000),
  );

  try {
    // `listRooms` takes an array of specific names; EMPTY = all rooms.
    const rooms = await Promise.race([roomsPromise, timeoutPromise]);

    const detailed: AdminLiveKitRoom[] = await Promise.all(
      rooms.map(async (room) => {
        const participants = await client.listParticipants(room.name);
        return {
          name: room.name,
          gameRoomId: linkedGameRoomId(room.name),
          numParticipants: room.numParticipants ?? participants.length,
          createdAt: room.creationTime ? Number(room.creationTime) : null,
          participants: participants.map((participant) => {
            const identity = participant.identity ?? "";
            return {
              identity,
              name: participant.name ?? "",
              userId: identity.startsWith("user-")
                ? identity.slice("user-".length)
                : null,
              isGuest: identity.startsWith("guest-"),
            };
          }),
        };
      }),
    );

    return { ok: true, rooms: detailed };
  } catch (error) {
    return {
      ok: false,
      reason: "unavailable",
      message:
        error instanceof Error && error.message === "timeout"
          ? "Le serveur média ne répond pas (timeout)."
          : "Serveur média injoignable — le service `livekit` tourne-t-il ?",
    };
  }
}
