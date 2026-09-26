"use client";

import { Client, type Room } from "@colyseus/sdk";

import { REALTIME_TOKEN_ENDPOINT, resolveRealtimeUrl } from "./config";
import type { LobbySnapshot, RoomListing } from "./types";

/**
 * Connection wrapper for the Colyseus game server.
 *
 * Responsibilities kept deliberately thin:
 *   - fetch a short-lived join token from the platform,
 *   - open/join rooms with that token attached,
 *   - expose the SDK room (state sync + reconnection are the SDK's job).
 *
 * It must stay game-agnostic: Ludo-specific behaviour belongs to the
 * Ludo module.
 */

let cachedClient: Client | null = null;
let cachedUrl: string | null = null;

export function getRealtimeClient(): Client {
  // Resolved here, in the browser, rather than at module load: the URL
  // depends on the address the page was opened from. If that address
  // changes the client is rebuilt, so a cached one never points at the
  // wrong host.
  const url = resolveRealtimeUrl();
  if (!cachedClient || cachedUrl !== url) {
    cachedClient = new Client(url);
    cachedUrl = url;
  }
  return cachedClient;
}

/** Ask the Next.js platform for a short-lived realtime join token. */
export async function fetchRealtimeToken(): Promise<string> {
  const response = await fetch(REALTIME_TOKEN_ENDPOINT, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Connecte-toi avant de jouer en ligne."
        : "Impossible d'obtenir le jeton temps réel.",
    );
  }
  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new Error("Jeton temps réel invalide.");
  }
  return payload.token;
}

/**
 * Anonymous SPECTATOR token — no platform session needed. The server
 * pins guests to watch-only: no seat, no admin, no join requests.
 */
export async function fetchGuestRealtimeToken(): Promise<string> {
  const response = await fetch(`${REALTIME_TOKEN_ENDPOINT}?scope=spectator`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Impossible d'obtenir l'accès spectateur.");
  }
  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new Error("Jeton spectateur invalide.");
  }
  return payload.token;
}

/** Create a room for `gameId` with the requested table size. */
export async function createRoom(
  gameId: string,
  targetPlayers: number,
): Promise<Room<LobbySnapshot>> {
  const client = getRealtimeClient();
  const token = await fetchRealtimeToken();
  return client.create(gameId, { targetPlayers, token });
}

/**
 * Join an existing room by id.
 *
 * `mode: "play"` sends a player request the room admin must approve
 * (except for the room creator, recognised server-side). `mode:
 * "watch"` lands as a spectator immediately, no approval, no seat.
 * Omitting the mode keeps the legacy default ("play") so existing call
 * sites keep working while the flows migrate.
 */
export async function joinRoom(
  gameId: string,
  roomId: string,
  mode: "play" | "watch" = "play",
): Promise<Room<LobbySnapshot>> {
  const client = getRealtimeClient();
  const token = await fetchRealtimeToken();
  return client.joinById(roomId, { token, mode });
}

/**
 * Watch a room. Spectating needs no account: a signed-in viewer watches
 * as themselves (and may later ask to play), an anonymous one is handed
 * a guest token that the server pins to watch-only — no seat, no admin,
 * no join request, ever.
 */
export async function watchRoom(roomId: string): Promise<Room<LobbySnapshot>> {
  const client = getRealtimeClient();
  let token: string | null = null;
  try {
    token = await fetchRealtimeToken();
  } catch {
    token = null; // not signed in — fall through to the guest token
  }
  if (!token) {
    token = await fetchGuestRealtimeToken();
  }
  return client.joinById(roomId, { token, mode: "watch" });
}

/** Reconnect with a seat-reservation token after a refresh or a blip. */
export async function reconnectRoom(
  reconnectionToken: string,
): Promise<Room<LobbySnapshot>> {
  const client = getRealtimeClient();
  return client.reconnect(reconnectionToken) as Promise<Room<LobbySnapshot>>;
}

/**
 * The public rooms of a game, for the match list (spec section 4).
 *
 * Served by the realtime server's own `/api/rooms/:gameId` endpoint,
 * which reads the matchmaker: rooms publish their players, spectators
 * and phase into metadata as they live. No static mocks: absent rooms
 * simply no longer exist.
 */
export async function listRooms(gameId: string): Promise<RoomListing[]> {
  const client = getRealtimeClient();
  const response = await client.http.get(
    `/api/rooms/${encodeURIComponent(gameId)}`,
  );
  const payload = response.data as { rooms?: RoomListing[] };
  return payload.rooms ?? [];
}
