import "server-only";

/**
 * Admin → realtime-server client for the Rooms table (Phase 7).
 *
 * The live room state exists ONLY inside the Colyseus server (no DB
 * table by design), so the console reads it server-to-server through
 * the `api_admin_rooms` endpoint, authorized by the SAME shared
 * `REALTIME_TOKEN_SECRET` the platform already holds (same discipline
 * as lib/livekit/room-membership.ts). Three honest states, never
 * fabricated data: rooms list, empty, or unavailable (server down /
 * misconfigured — the console says so instead of showing a fake empty
 * list).
 */

/** Role state of one active room, straight from matchmaker metadata. */
export interface AdminRealtimeRoom {
  roomId: string;
  /** Epoch ms of room creation, when the server reports it. */
  createdAt: number | null;
  gameId: string;
  gameName: string;
  targetPlayers: number;
  players: number;
  maxPlayers: number;
  spectators: number;
  playerIds: string[];
  /** LIFECYCLE phase string published by the room. */
  phase: string;
}

export type AdminRoomsResult =
  | { ok: true; rooms: AdminRealtimeRoom[] }
  | { ok: false; reason: "unavailable"; message: string };

const SECRET_HEADER = "x-realtime-token-secret";
const TIMEOUT_MS = 4_000;

function resolveRealtimeServerUrl(): string {
  const configured = process.env.REALTIME_SERVER_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "REALTIME_SERVER_URL must be set in production to read realtime state",
    );
  }
  // Same dev default as lib/livekit/room-membership.ts.
  return "http://127.0.0.1:2567";
}

function readSecret(): string {
  const secret = process.env.REALTIME_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("REALTIME_TOKEN_SECRET is missing or too short");
  }
  return secret;
}

export async function listActiveRealtimeRooms(): Promise<AdminRoomsResult> {
  let url: string;
  try {
    url = `${resolveRealtimeServerUrl()}/api/admin/rooms`;
    const secret = readSecret();
    const response = await fetch(url, {
      cache: "no-store",
      headers: { [SECRET_HEADER]: secret },
      // Short: the table must render fast; the server may be down.
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: "unavailable",
        message: `Le serveur temps réel a répondu ${response.status}.`,
      };
    }
    const payload = (await response.json()) as {
      rooms?: {
        roomId: string;
        createdAt?: number | null;
        metadata?: {
          gameId?: string;
          gameName?: string;
          targetPlayers?: number;
          players?: number;
          maxPlayers?: number;
          spectators?: number;
          playerIds?: unknown;
          phase?: string;
        };
      }[];
    };
    const rooms: AdminRealtimeRoom[] = (payload.rooms ?? []).map((room) => ({
      roomId: room.roomId,
      createdAt: typeof room.createdAt === "number" ? room.createdAt : null,
      gameId: room.metadata?.gameId ?? "",
      gameName: room.metadata?.gameName ?? "",
      targetPlayers: room.metadata?.targetPlayers ?? 0,
      players: room.metadata?.players ?? 0,
      maxPlayers: room.metadata?.maxPlayers ?? 0,
      spectators: room.metadata?.spectators ?? 0,
      playerIds: Array.isArray(room.metadata?.playerIds)
        ? room.metadata.playerIds.map(String)
        : [],
      phase: room.metadata?.phase ?? "",
    }));
    return { ok: true, rooms };
  } catch (error) {
    return {
      ok: false,
      reason: "unavailable",
      message:
        error instanceof Error && error.message.includes("REALTIME_TOKEN_SECRET")
          ? "REALTIME_TOKEN_SECRET n'est pas configuré — impossible d'interroger le serveur temps réel."
          : "Serveur temps réel injoignable (démarré ?).",
    };
  }
}
