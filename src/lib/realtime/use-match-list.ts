"use client";

import { useEffect, useState } from "react";

import { listRooms } from "./client";
import type { RoomListing } from "./types";

export interface MatchListController {
  rooms: RoomListing[];
  loading: boolean;
  error: string | null;
  /** Force an immediate reload (also done automatically on an interval). */
  refresh: () => void;
}

/**
 * Polls the realtime server for a game's public rooms (spec section
 * 4). The list is the server's truth — rooms appear on creation and
 * vanish when closed — refreshed on an interval so spectator counts
 * and phases stay current without opening any connection.
 */
export function useMatchList(gameId: string, pollMs = 5_000): MatchListController {
  const [rooms, setRooms] = useState<RoomListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      try {
        const next = await listRooms(gameId);
        if (!disposed) {
          setRooms(next);
          setError(null);
        }
      } catch {
        if (!disposed) setError("Liste des matchs indisponible.");
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void load();
    const interval = window.setInterval(load, pollMs);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [gameId, pollMs, tick]);

  return { rooms, loading, error, refresh: () => setTick((t) => t + 1) };
}
