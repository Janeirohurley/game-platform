/**
 * match-hud.dom.test.ts — the HUD strip renders what the redesign
 * promises: game identity + phase, one avatar per player (photo or
 * initials) with a crown on the host, dashed free seats, the spectator
 * counter, a live elapsed-match clock once the game runs, and — during
 * a playing match — the turn-countdown ring on the current player only.
 * happy-dom stands in for the browser.
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
const { MatchHud } = await import("./match-hud");

beforeAll(() => {
  // base-ui's Avatar keeps a fallback mount error hidden without RO.
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
  root: HTMLElement;
  dispose: () => Promise<void>;
}

async function mount(props: Record<string, unknown>): Promise<Harness> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(createElement(MatchHud as never, props as never));
  });

  return {
    root: host.firstElementChild as HTMLElement,
    dispose: async () => {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function snapshot(overrides: Partial<LobbySnapshot> = {}) {
  const base = {
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
        avatarUrl: "https://example.com/bob.png",
        sessionId: "s-b",
        seat: 1,
        connected: false,
      },
    ],
    pendingPlayerRequests: [],
    spectators: [{ userId: "user-c", name: "Carol", sessionId: "s-c" }],
    currentTurn: null,
    turnDeadline: 0,
    turnDurationMs: 0,
    ...overrides,
  };
  return base as LobbySnapshot;
}

test("strip shows game, phase, avatars, free seats, host crown and spectator count", async () => {
  const { root, dispose } = await mount({
    snapshot: snapshot(),
    isAdmin: true,
  });

  expect(root.textContent).toContain("Ludo");
  expect(root.textContent).toContain("En attente");

  // Two players → two circular avatar roots; Alice lands on initials,
  // Bob too until happy-dom loads his photo.
  const avatars = root.querySelectorAll("[data-slot='avatar']");
  expect(avatars.length).toBe(2);
  expect(avatars[0]!.textContent).toContain("AL");
  expect(avatars[1]!.textContent).toContain("BT");

  // Host wears the crown.
  expect(root.querySelector('svg[aria-label="Hôte"]')).not.toBeNull();

  // 4-player table, 2 seated → 2 dashed free seats.
  const free = root.querySelectorAll("li[aria-label='Place libre']");
  expect(free.length).toBe(2);

  // Spectator counter, reachable by its accessible label.
  const spectator = root.querySelector('span[aria-label="1 spectateur"]');
  expect(spectator).not.toBeNull();
  expect(spectator!.textContent).toBe("1");

  // No elapsed clock while the lobby is waiting.
  expect(root.querySelector('[title="Temps écoulé"]')).toBeNull();

  await dispose();
});

test("the elapsed clock replaces the phase label once the game runs", async () => {
  const { root, dispose } = await mount({
    snapshot: snapshot({
      phase: "playing",
      startedAt: Date.now() - 65_000,
      currentTurn: "user-a",
      turnDeadline: 1_000,
      turnDurationMs: 30_000,
    }),
    isAdmin: true,
  });

  const chip = root.querySelector<HTMLElement>('[title="Temps écoulé"]');
  expect(chip).not.toBeNull();
  expect(chip!.textContent).toMatch(/\d\d:\d\d/);
  // "En cours" is redundant next to the live timer — the clock holds
  // the phase chip's slot.
  expect(root.textContent).not.toContain("En cours");

  await dispose();
});

test("a finished match shows its label and the final elapsed time", async () => {
  const { root, dispose } = await mount({
    snapshot: snapshot({
      phase: "finished",
      startedAt: Date.now() - 240_000,
    }),
    isAdmin: true,
  });

  expect(root.textContent).toContain("Terminée");
  const chip = root.querySelector<HTMLElement>('[title="Temps écoulé"]');
  expect(chip).not.toBeNull();
  expect(chip!.textContent).toMatch(/04:\d\d/);

  await dispose();
});

test("the turn ring wraps only the current player during a playing match", async () => {
  const { root, dispose } = await mount({
    snapshot: snapshot({
      phase: "playing",
      currentTurn: "user-a",
      turnDeadline: 1_000,
      turnDurationMs: 30_000,
    }),
    isAdmin: true,
  });

  // Exactly one countdown ring, on the player whose turn it is.
  expect(root.querySelectorAll("svg.-rotate-90").length).toBe(1);

  await dispose();
});