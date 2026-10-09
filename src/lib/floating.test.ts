/**
 * floating.test.ts — pins the two ways a floating panel goes wrong:
 * an offset that never comes back on screen, and a parse lenient enough
 * to hand the renderer a position it cannot draw.
 */

import { describe, expect, test } from "bun:test";

import {
  clampPositionToViewport,
  parsePosition,
  positionStorageKey,
  readPosition,
  samePosition,
  serializePosition,
  writePosition,
  type FloatingPosition,
} from "./floating";

/** 1000×800 viewport, with a 200×150 panel anchored bottom-right. */
const VIEWPORT = { width: 1000, height: 800 };
const ANCHOR = { left: 700, top: 600, right: 900, bottom: 750 };

function moved(offset: FloatingPosition) {
  return {
    left: ANCHOR.left + offset.x,
    top: ANCHOR.top + offset.y,
    right: ANCHOR.right + offset.x,
    bottom: ANCHOR.bottom + offset.y,
  };
}

describe("clampPositionToViewport", () => {
  test("leaves a panel that already fits alone", () => {
    const offset = { x: -250, y: -120 };
    const result = clampPositionToViewport(offset, moved(offset), VIEWPORT);
    expect(samePosition(result, offset)).toBe(true);
  });

  test("pulls a panel back in from the left edge", () => {
    const offset = { x: -800, y: 0 };
    const box = moved(offset);
    expect(box.left).toBeLessThan(0);

    const result = clampPositionToViewport(offset, box, VIEWPORT);
    expect(result).toEqual({ x: -700, y: 0 });
    expect(moved(result).left).toBe(0);
  });

  test("pulls a panel back in from the right edge", () => {
    const offset = { x: 150, y: 0 };
    const box = moved(offset);
    expect(box.right).toBeGreaterThan(VIEWPORT.width);

    const result = clampPositionToViewport(offset, box, VIEWPORT);
    expect(result).toEqual({ x: 100, y: 0 });
    expect(moved(result).right).toBe(VIEWPORT.width);
  });

  test("pulls a panel back in from the top edge", () => {
    const offset = { x: 0, y: -700 };
    const box = moved(offset);
    expect(box.top).toBeLessThan(0);

    const result = clampPositionToViewport(offset, box, VIEWPORT);
    expect(result).toEqual({ x: 0, y: -600 });
    expect(moved(result).top).toBe(0);
  });

  test("pulls a panel back in from the bottom edge", () => {
    const offset = { x: 0, y: 100 };
    const box = moved(offset);
    expect(box.bottom).toBeGreaterThan(VIEWPORT.height);

    const result = clampPositionToViewport(offset, box, VIEWPORT);
    expect(result).toEqual({ x: 0, y: 50 });
    expect(moved(result).bottom).toBe(VIEWPORT.height);
  });

  test("pins a panel wider than the viewport to the left instead of ping-ponging", () => {
    // Both edges are out at once; only the leading one is chased.
    const offset = { x: -50, y: 0 };
    const box = { left: -50, top: 600, right: 1150, bottom: 750 };

    const result = clampPositionToViewport(offset, box, VIEWPORT);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  test("pins a panel taller than the viewport to the top instead of ping-ponging", () => {
    const offset = { x: 0, y: -50 };
    const box = { left: 700, top: -50, right: 900, bottom: 950 };

    const result = clampPositionToViewport(offset, box, VIEWPORT);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  test("is idempotent — a clamped panel clamps to itself", () => {
    const offset = { x: -800, y: 400 };
    const once = clampPositionToViewport(offset, moved(offset), VIEWPORT);
    const twice = clampPositionToViewport(once, moved(once), VIEWPORT);
    expect(samePosition(twice, once)).toBe(true);
  });
});

describe("parsePosition", () => {
  test("round-trips what serializePosition writes", () => {
    const position = { x: 12.5, y: -340 };
    expect(parsePosition(serializePosition(position))).toEqual(position);
  });

  test("accepts negative offsets — left and up are legal drags", () => {
    expect(parsePosition('{"x":-1,"y":-2}')).toEqual({ x: -1, y: -2 });
  });

  test("rejects absence and unparseable junk", () => {
    expect(parsePosition(null)).toBeNull();
    expect(parsePosition("")).toBeNull();
    expect(parsePosition("{nope")).toBeNull();
  });

  test("rejects scalars, arrays and empty objects", () => {
    expect(parsePosition("123")).toBeNull();
    expect(parsePosition('"12,34"')).toBeNull();
    expect(parsePosition("null")).toBeNull();
    expect(parsePosition("[700,600]")).toBeNull();
    expect(parsePosition("{}")).toBeNull();
  });

  test("rejects an object missing either coordinate", () => {
    expect(parsePosition('{"x":1}')).toBeNull();
    expect(parsePosition('{"y":1}')).toBeNull();
  });

  test("rejects coordinates that are not finite numbers", () => {
    expect(parsePosition('{"x":1,"y":"2"}')).toBeNull();
    expect(parsePosition('{"x":null,"y":1}')).toBeNull();
    expect(parsePosition('{"x":true,"y":1}')).toBeNull();
    // 1e999 parses to Infinity — legal JSON, illegal position.
    expect(parsePosition('{"x":1e999,"y":0}')).toBeNull();
  });

  test("ignores surplus keys rather than failing on them", () => {
    expect(parsePosition('{"x":1,"y":2,"z":3}')).toEqual({ x: 1, y: 2 });
  });
});

describe("positionStorageKey", () => {
  test("namespaces keys so two panels never collide", () => {
    expect(positionStorageKey("chat")).toBe("floating:position:chat");
    expect(positionStorageKey("call-bar")).toBe("floating:position:call-bar");
    expect(positionStorageKey("chat")).not.toBe(positionStorageKey("call-bar"));
  });
});

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe("readPosition / writePosition", () => {
  test("round-trips through storage under the namespaced key", () => {
    const storage = memoryStorage();

    writePosition(storage, "chat", { x: -40, y: 120 });

    expect(readPosition(storage, "chat")).toEqual({ x: -40, y: 120 });
    expect(storage.getItem(positionStorageKey("chat"))).not.toBeNull();
  });

  test("keeps panels independent", () => {
    const storage = memoryStorage();

    writePosition(storage, "chat", { x: 1, y: 1 });
    writePosition(storage, "call-bar", { x: 2, y: 2 });

    expect(readPosition(storage, "chat")).toEqual({ x: 1, y: 1 });
    expect(readPosition(storage, "call-bar")).toEqual({ x: 2, y: 2 });
    expect(readPosition(storage, "never-written")).toBeNull();
  });

  test("treats a missing storage as no position, not as the origin", () => {
    expect(readPosition(null, "chat")).toBeNull();
    expect(readPosition(undefined, "chat")).toBeNull();
    expect(() => writePosition(null, "chat", { x: 1, y: 2 })).not.toThrow();
    expect(() => writePosition(undefined, "chat", { x: 1, y: 2 })).not.toThrow();
  });

  test("survives a storage that throws on read", () => {
    const hostile = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };

    expect(readPosition(hostile, "chat")).toBeNull();
  });

  test("survives a storage that throws on write", () => {
    const hostile = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };

    expect(() => writePosition(hostile, "chat", { x: 1, y: 2 })).not.toThrow();
  });

  test("discards a stored value the parser refuses", () => {
    const storage = memoryStorage({
      [positionStorageKey("chat")]: "{broken",
    });

    expect(readPosition(storage, "chat")).toBeNull();
  });

  test("writing an unrepresentable position stores something unreadable", () => {
    const storage = memoryStorage();

    writePosition(storage, "chat", { x: Number.NaN, y: 0 });

    expect(readPosition(storage, "chat")).toBeNull();
  });
});

describe("samePosition", () => {
  test("compares both axes", () => {
    expect(samePosition({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(samePosition({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
    expect(samePosition({ x: 1, y: 2 }, { x: 0, y: 2 })).toBe(false);
  });
});
