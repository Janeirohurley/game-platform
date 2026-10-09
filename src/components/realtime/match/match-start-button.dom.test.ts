/**
 * match-start-button.dom.test.ts — the admin's start control floats alone
 * in the top-right corner, shows only while the lobby is waiting/ready and
 * locks once the server's 3 s countdown is running. happy-dom stands in
 * for the browser.
 */

import { afterAll, beforeAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import type { LobbySnapshot } from "../../../lib/realtime/types";

GlobalRegistrator.register();

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MatchStartButton } = await import("./match-start-button");

beforeAll(() => {
  (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
    (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver ??
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

afterAll(() => {
  GlobalRegistrator.unregister();
});

interface Harness {
  root: HTMLElement | null;
  dispose: () => Promise<void>;
}

async function mount(props: Record<string, unknown>): Promise<Harness> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(createElement(MatchStartButton as never, props as never));
  });

  return {
    root: host.firstElementChild as HTMLElement | null,
    dispose: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function snapshot(overrides: Partial<LobbySnapshot> = {}): LobbySnapshot {
  return {
    gameId: "ludo",
    gameName: "Ludo",
    minPlayers: 2,
    maxPlayers: 4,
    targetPlayers: 4,
    phase: "waiting",
    startedAt: 0,
    hostUserId: "user-a",
    players: [
      {
        userId: "user-a",
        name: "Alice",
        avatarUrl: "",
        sessionId: "s-a",
        seat: 0,
        connected: true,
      },
      {
        userId: "user-b",
        name: "Bobby Tables",
        avatarUrl: "",
        sessionId: "s-b",
        seat: 1,
        connected: true,
      },
    ],
    pendingPlayerRequests: [],
    spectators: [],
    currentTurn: null,
    turnDeadline: 0,
    turnDurationMs: 0,
    ...overrides,
  } as LobbySnapshot;
}

test("while waiting, the admin sees the compact start pill top-right", async () => {
  const { root, dispose } = await mount({
    snapshot: snapshot(),
    onStart: () => {},
  });

  expect(root).not.toBeNull();
  // Top-right anchor of the match screen.
  expect(root!.className).toContain("right-3");
  const button = root!.querySelector<HTMLButtonElement>("button");
  expect(button).not.toBeNull();
  expect(button!.textContent).toContain("Démarrer");
  // The missing-players count lives in the tooltip, not the pill.
  expect(button!.title).toContain("2 joueurs");

  await dispose();
});

test("clicking the pill fires the start request", async () => {
  let started = false;
  const { root, dispose } = await mount({
    snapshot: snapshot({ phase: "ready" }),
    onStart: () => {
      started = true;
    },
  });

  const button = root!.querySelector<HTMLButtonElement>("button")!;
  await act(async () => {
    button.click();
  });
  expect(started).toBe(true);

  await dispose();
});

test("while the server counts down the button reads Lancement and is locked", async () => {
  const { root, dispose } = await mount({
    snapshot: snapshot(),
    starting: true,
    onStart: () => {},
  });

  const button = root!.querySelector<HTMLButtonElement>("button")!;
  expect(button.textContent).toContain("Lancement…");
  expect(button.disabled).toBe(true);

  await dispose();
});

test("renders nothing once the match is running", async () => {
  const { root, dispose } = await mount({
    snapshot: snapshot({ phase: "playing" }),
    onStart: () => {},
  });

  expect(root).toBeNull();

  await dispose();
});