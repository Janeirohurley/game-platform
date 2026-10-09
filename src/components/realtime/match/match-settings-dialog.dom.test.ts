/**
 * match-settings-dialog.dom.test.ts — the lobby settings panel shows the
 * current server values, lets the host edit them and hands them back as a
 * single `updateLobbySettings` payload, while everyone else sees them
 * read-only. happy-dom stands in for the browser.
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
const { MatchSettingsDialog } = await import("./match-settings-dialog");

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
  root: HTMLElement;
  dispose: () => Promise<void>;
}

async function mount(props: Record<string, unknown>): Promise<Harness> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(createElement(MatchSettingsDialog as never, props as never));
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
    targetPlayers: 2,
    phase: "waiting",
    startedAt: 0,
    hostUserId: "user-a",
    players: [],
    pendingPlayerRequests: [],
    spectators: [],
    currentTurn: null,
    turnDeadline: 0,
    turnDurationMs: 30_000,
    ...overrides,
  };
  return base as LobbySnapshot;
}

test("the host edits player count and per-turn budget", async () => {
  const updates: { targetPlayers: number; turnDurationMs: number }[] = [];
  const { root, dispose } = await mount({
    snapshot: snapshot(),
    isAdmin: true,
    onClose: () => {},
    onUpdate: (settings: { targetPlayers: number; turnDurationMs: number }) =>
      updates.push(settings),
  });

  const playerButtons = root.querySelectorAll<HTMLButtonElement>(
    "button[aria-pressed]",
  );
  expect(playerButtons.length).toBe(3); // 2, 3, 4
  for (const button of playerButtons) expect(button.disabled).toBe(false);

  const pick3 = [...playerButtons].find(
    (button) => button.textContent?.trim() === "3",
  );
  expect(pick3).toBeDefined();

  await act(async () => pick3!.click());
  expect(updates).toEqual([{ targetPlayers: 3, turnDurationMs: 30_000 }]);
  await dispose();

  // The dialog mirrors the SERVER snapshot: once the server echoes the
  // new table size, the next edit carries it (same frame as real play).
  const echoed = [
    ...updates,
  ] as { targetPlayers: number; turnDurationMs: number }[];
  const { root: root2, dispose: dispose2 } = await mount({
    snapshot: snapshot({ targetPlayers: 3 }),
    isAdmin: true,
    onClose: () => {},
    onUpdate: (settings: { targetPlayers: number; turnDurationMs: number }) =>
      echoed.push(settings),
  });

  const select = root2.querySelector<HTMLSelectElement>("select");
  expect(select).not.toBeNull();
  expect(select!.disabled).toBe(false);
  await act(async () => {
    select!.value = "0";
    select!.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(echoed[1]).toEqual({ targetPlayers: 3, turnDurationMs: 0 });

  await dispose2();
});

test("non-hosts see the same values but can only read", async () => {
  const onUpdate = () => {
    throw new Error("a non-host must not be able to update settings");
  };
  const { root, dispose } = await mount({
    snapshot: snapshot({ targetPlayers: 4, turnDurationMs: 0 }),
    isAdmin: false,
    onClose: () => {},
    onUpdate,
  });

  // The player-count buttons and the budget select are inert.
  const playerButtons = root.querySelectorAll<HTMLButtonElement>(
    "button[aria-pressed]",
  );
  expect(playerButtons.length).toBe(3);
  for (const button of playerButtons) expect(button.disabled).toBe(true);
  const select = root.querySelector<HTMLSelectElement>("select");
  expect(select!.disabled).toBe(true);

  // The current values are still visible.
  expect(root.textContent).toContain(
    "Lecture seule — seule l'hôte peut les modifier.",
  );
  expect(select!.value).toBe("0");
  expect(root.textContent).toContain("Sans limite");
  const activePlayerButton = [...playerButtons].find(
    (button) => button.getAttribute("aria-pressed") === "true",
  );
  expect(activePlayerButton?.textContent?.trim()).toBe("4");

  await dispose();
});

test("closes via the Fermer button and the select reflects the server budget", async () => {
  let closed = false;
  const { root, dispose } = await mount({
    snapshot: snapshot({ turnDurationMs: 90_000 }),
    isAdmin: true,
    onClose: () => {
      closed = true;
    },
    onUpdate: () => {},
  });

  const select = root.querySelector<HTMLSelectElement>("select");
  expect(select!.value).toBe("90000");

  const close = root.querySelector<HTMLButtonElement>('[aria-label="Fermer"]');
  expect(close).not.toBeNull();
  await act(async () => close!.click());
  expect(closed).toBe(true);

  await dispose();
});