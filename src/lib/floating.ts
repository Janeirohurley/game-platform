/**
 * floating.ts — geometry and persistence behind the Floating component.
 *
 * Everything here is pure. That matters twice over: the offset maths is
 * what decides whether a panel comes back on screen or parks itself
 * outside the viewport, and the parser is the only thing standing between
 * a corrupted localStorage entry and a panel rendered at (NaN, NaN). The
 * drag itself needs a DOM and lives in components/floating.tsx.
 */

/** A drag offset in pixels, relative to wherever the content's CSS put it. */
export interface FloatingPosition {
  x: number;
  y: number;
}

/** An element's box in viewport coordinates, offset already applied. */
export interface BoxRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Prefixed so a panel can be renamed without inheriting the offset of an
 * unrelated one that happened to share the raw key.
 */
const STORAGE_PREFIX = "floating:position:";

export function positionStorageKey(storageKey: string): string {
  return `${STORAGE_PREFIX}${storageKey}`;
}

/**
 * Reads a stored offset, rejecting anything that would put the panel
 * somewhere unrenderable. `null` means "no usable value" — callers fall
 * back to their default position rather than treating it as the origin.
 */
export function parsePosition(raw: string | null): FloatingPosition | null {
  if (typeof raw !== "string") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const { x, y } = parsed as { x: unknown; y: unknown };
  if (typeof x !== "number" || typeof y !== "number") return null;
  // NaN never survives JSON (it becomes `null`) and Infinity is dropped
  // outright, but a hand-edited entry can still reach here with either.
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x, y };
}

export function serializePosition(position: FloatingPosition): string {
  return JSON.stringify({ x: position.x, y: position.y });
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

/**
 * Storage access is guarded because Safari's private mode throws on
 * `setItem`, and a panel that refuses to open because a browser said "no"
 * to a coordinate is a bad trade. The same guard covers the SSR case,
 * where `storage` is simply absent.
 */
export function readPosition(
  storage: ReadableStorage | null | undefined,
  storageKey: string,
): FloatingPosition | null {
  if (!storage) return null;
  try {
    return parsePosition(storage.getItem(positionStorageKey(storageKey)));
  } catch {
    return null;
  }
}

export function writePosition(
  storage: WritableStorage | null | undefined,
  storageKey: string,
  position: FloatingPosition,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      positionStorageKey(storageKey),
      serializePosition(position),
    );
  } catch {
    // Quota or private mode: losing an offset is better than losing a drag.
  }
}

/**
 * Nudges `offset` by the least distance that brings `box` — the element's
 * CURRENT rectangle, `offset` already baked into it — back inside
 * `viewport`.
 *
 * Each axis is an if/else rather than two independent corrections: when
 * the element is wider than the viewport both edges stick out at once, and
 * chasing both would ping-pong it across the screen. It pins to the
 * leading edge instead.
 */
export function clampPositionToViewport(
  offset: FloatingPosition,
  box: BoxRect,
  viewport: ViewportSize,
): FloatingPosition {
  let { x, y } = offset;

  if (box.left < 0) {
    x += -box.left;
  } else if (box.right > viewport.width) {
    x -= box.right - viewport.width;
  }

  if (box.top < 0) {
    y += -box.top;
  } else if (box.bottom > viewport.height) {
    y -= box.bottom - viewport.height;
  }

  return { x, y };
}

export function samePosition(
  a: FloatingPosition,
  b: FloatingPosition,
): boolean {
  return a.x === b.x && a.y === b.y;
}
