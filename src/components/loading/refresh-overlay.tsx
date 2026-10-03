"use client";

import type { ReactNode } from "react";

import { cn } from "cn";

/**
 * Client-side loading state for content that is ALREADY rendered and is
 * being refetched — the opposite of a skeleton, which stands in for
 * content that does not exist yet.
 *
 * Three signals at once, none of which blanks the screen (a balance that
 * flickers to a grey bar on every refresh is worse than no feedback):
 *   1. a 2px indeterminate bar, the conventional "request in flight" cue;
 *   2. a sweeping highlight over the region, so the user can see WHICH
 *      part of the page is about to change;
 *   3. `aria-busy` + a polite live label, so the wait is announced.
 *
 * Children stay mounted and stay interactive — only their brightness
 * drops, so a slow refetch never eats a click.
 */
export function RefreshOverlay({
  busy,
  label = "Actualisation en cours…",
  className,
  children,
}: {
  busy: boolean;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-refreshing={busy ? "true" : "false"}
      aria-busy={busy}
      className={cn("relative", className)}
    >
      {busy && (
        <>
          <span
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            {label}
          </span>
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-muted"
          >
            <span className="block h-full w-1/3 animate-shimmer bg-primary" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
          >
            <span className="absolute inset-y-0 -left-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
          </span>
        </>
      )}
      <div
        className={cn(
          "transition-opacity duration-200",
          busy ? "opacity-60" : "opacity-100",
        )}
      >
        {children}
      </div>
    </div>
  );
}