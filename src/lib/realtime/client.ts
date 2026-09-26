"use client";

import { Client, type Room } from "@colyseus/sdk";

import { REALTIME_TOKEN_ENDPOINT, resolveRealtimeUrl } from "./config";
import type { LobbySnapshot } from "./types";

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

/** Create a room for `gameId` with the requested table size. */
export async function createRoom(
  gameId: string,
  targetPlayers: number,
): Promise<Room<LobbySnapshot>> {
  const client = getRealtimeClient();
  const token = await fetchRealtimeToken();
  return client.create(gameId, { targetPlayers, token });
}

/** Join an existing room by id (invitation link flow). */
export async function joinRoom(
  gameId: string,
  roomId: string,
): Promise<Room<LobbySnapshot>> {
  const client = getRealtimeClient();
  const token = await fetchRealtimeToken();
  return client.joinById(roomId, { token });
}

/** Reconnect with a seat-reservation token after a refresh or a blip. */
export async function reconnectRoom(
  reconnectionToken: string,
): Promise<Room<LobbySnapshot>> {
  const client = getRealtimeClient();
  return client.reconnect(reconnectionToken) as Promise<Room<LobbySnapshot>>;
}
