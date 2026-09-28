import { describe, expect, it } from "bun:test";

import { grantsForRole } from "./grants";
import { isValidGameRoomId, livekitRoomName } from "./room-name";

/**
 * The media authorization matrix (phase 4B): the token must mirror the
 * application's OWN role rules, scoped to exactly one room, and never
 * grant room-management capabilities.
 */
describe("grantsForRole", () => {
  it("a seated player may publish and subscribe", () => {
    const grants = grantsForRole("player", "game-room-abc123");
    expect(grants).toEqual({
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      room: "game-room-abc123",
    });
  });

  it("a spectator is receive-only — no mic, no camera, no data", () => {
    const grants = grantsForRole("spectator", "game-room-abc123");
    expect(grants).toEqual({
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
      canPublishData: false,
      room: "game-room-abc123",
    });
  });

  it("every grant is scoped to the requested room only", () => {
    for (const role of ["player", "spectator"] as const) {
      expect(grantsForRole(role, "game-room-one").room).toBe(
        "game-room-one",
      );
    }
  });
});

/**
 * Room-name derivation: deterministic, game-agnostic, and it REFUSES
 * malformed ids instead of coercing them into a colliding name.
 */
describe("livekitRoomName", () => {
  it("derives the namespaced media room from the Colyseus room id", () => {
    expect(livekitRoomName("VHAhe1gCu")).toBe("game-room-VHAhe1gCu");
  });

  it("is deterministic and never collides across matches", () => {
    expect(livekitRoomName("roomA")).toBe(livekitRoomName("roomA"));
    expect(livekitRoomName("roomA")).not.toBe(livekitRoomName("roomB"));
  });

  it("rejects malformed room ids rather than sanitising them", () => {
    for (const bad of ["", "../etc", "bad room", "a".repeat(65), "x/y"]) {
      expect(() => livekitRoomName(bad)).toThrow();
      expect(isValidGameRoomId(bad)).toBe(false);
    }
  });

  it("accepts plain opaque ids of any supported game", () => {
    expect(isValidGameRoomId("abc123")).toBe(true);
    expect(isValidGameRoomId("AbCdE")).toBe(true);
  });
});
