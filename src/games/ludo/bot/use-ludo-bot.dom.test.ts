// Vérifie le PILOTE du bot (le hook), pas le cerveau : c'est l'intégration
// qui est fragile — détection du tour, un seul lancer puis un seul coup,
// silence total quand ce n'est pas au tour d'un bot.

import { afterAll, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { act, createElement, useState } = await import("react");
const { createRoot } = await import("react-dom/client");
const { useLudoBot } = await import("./use-ludo-bot");
type GameState = import("../types/game").GameState;

afterAll(() => {
  GlobalRegistrator.unregister();
});

function gameStateFor(isBot: boolean): GameState {
  return {
    players: [
      {
        id: "player_0",
        name: "Bot",
        color: "yellow",
        pieces: [20, -1, -1, -1].map((position, index) => ({
          id: `piece_${index}`,
          playerId: "player_0",
          position,
          isSelected: false,
          canMove: false,
        })),
        isActive: true,
        isBot,
        botDifficulty: "normal",
      },
    ],
    currentPlayerIndex: 0,
    diceValue: null,
    gamePhase: "playing",
    winner: null,
    lastRoll: null,
    canRollAgain: false,
    turnStartTime: 1000,
    autoPlayEnabled: false,
    playerCount: 4,
  };
}

interface HarnessProps {
  initial: GameState;
  log: string[];
}

function Harness({ initial, log }: HarnessProps) {
  const [state, setState] = useState<GameState>(initial);
  useLudoBot(state, {
    enabled: state.gamePhase === "playing",
    onRoll: () => {
      log.push("roll");
      setState((s) => ({ ...s, diceValue: 3, turnStartTime: (s.turnStartTime ?? 0) + 1 }));
    },
    onMove: (index: number) => {
      log.push(`move:${index}`);
      setState((s) => ({ ...s, diceValue: null, turnStartTime: (s.turnStartTime ?? 0) + 1 }));
    },
  });
  return null;
}

async function drive(initial: GameState, ms: number): Promise<string[]> {
  const log: string[] = [];
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(createElement(Harness, { initial, log }));
  });
  // Plusieurs petits cycles : `act` ne flushe les effets d'une mise à jour
  // asynchrone (nos minuteurs) qu'à la fin de son scope, donc un seul long
  // `act` empêcherait le 2e minuteur d'être programmé à temps.
  const steps = Math.ceil(ms / 200);
  for (let i = 0; i < steps; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
  }
  await act(async () => {
    root.unmount();
  });
  host.remove();
  return log;
}

test("joue un lancer puis un coup quand c'est au bot", async () => {
  const log = await drive(gameStateFor(true), 1600);
  expect(log[0]).toBe("roll");
  expect(log[1]).toMatch(/^move:\d$/);
});

test("reste silencieux quand c'est au tour d'un humain", async () => {
  const log = await drive(gameStateFor(false), 1600);
  expect(log).toEqual([]);
});
