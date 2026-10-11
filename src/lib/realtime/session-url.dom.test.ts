import { afterAll, beforeEach, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { Room } from "@colyseus/sdk";

GlobalRegistrator.register({ url: "http://localhost/games/ludo/play?table=casual" });

const {
  clearRoomSession,
  persistRoomSession,
  readRoomIdFromUrl,
  readRoomSession,
} = await import("./session-url");

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState(null, "", "http://localhost/games/ludo/play?table=casual");
});

afterAll(() => {
  GlobalRegistrator.unregister();
});

test("persists room identity in the URL and its reconnect token in this tab", () => {
  const room = {
    roomId: "room-refresh-001",
    reconnectionToken: "signed-reconnect-token",
  } as Room;

  persistRoomSession(room, "play");

  expect(readRoomIdFromUrl()).toBe("room-refresh-001");
  expect(readRoomSession("room-refresh-001")).toEqual({
    reconnectionToken: "signed-reconnect-token",
    mode: "play",
  });
  expect(localStorage.length).toBe(0);
  expect(new URL(window.location.href).searchParams.get("table")).toBe("casual");
});

test("restores spectator mode and treats malformed or absent storage as missing", () => {
  persistRoomSession(
    { roomId: "room-watch-001", reconnectionToken: "watch-token" } as Room,
    "watch",
  );
  sessionStorage.setItem("realtime:session:broken-room", "not-json");

  expect(readRoomSession("room-watch-001")).toEqual({
    reconnectionToken: "watch-token",
    mode: "watch",
  });
  expect(readRoomSession("broken-room")).toBeNull();
  expect(readRoomSession("missing-room")).toBeNull();
});

test("clears only the matching room session and URL marker", () => {
  persistRoomSession(
    { roomId: "room-to-leave", reconnectionToken: "token-a" } as Room,
    "play",
  );
  sessionStorage.setItem(
    "realtime:session:other-room",
    JSON.stringify({ reconnectionToken: "token-b", mode: "watch" }),
  );

  clearRoomSession("room-to-leave");

  expect(readRoomSession("room-to-leave")).toBeNull();
  expect(readRoomSession("other-room")).toEqual({
    reconnectionToken: "token-b",
    mode: "watch",
  });
  expect(readRoomIdFromUrl()).toBeNull();
  expect(new URL(window.location.href).searchParams.get("table")).toBe("casual");
});
