"use client";

import { useSyncExternalStore } from "react";

import { isMuted, setMuted, subscribeMuted } from "@/lib/sounds";

/**
 * React binding over the global sound mute.
 *
 * Several screens can show the switch at once; `useSyncExternalStore` keeps
 * them all in step. On the server the mute is always off, so markup renders
 * identically and the client reconciles on hydration.
 */
export function useSoundMute() {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);

  return {
    muted,
    setMuted,
    toggleMuted: () => setMuted(!muted),
  };
}
