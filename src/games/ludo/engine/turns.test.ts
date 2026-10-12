// Vérifie la TRANSITION DE TOUR, pas le rendu : c'est la partie qui faisait
// sauter ou rejouer des tours. Chaque test enchaîne des lancers/coups et
// regarde à qui revient la main.

import { describe, expect, it } from "bun:test";

import { withMove, withRoll } from "./turns";
import { getTrack } from "../utils/positionUtils";
import type { GameState, Player } from "../types/game";
import type { LudoColor } from "../data/track";

function player(color: LudoColor, positions: number[]): Player {
  return {
    id: `player_${color}`,
    name: color,
    color,
    pieces: positions.map((position, index) => ({
      id: `${color}_${index}`,
      playerId: `player_${color}`,
      position,
      isSelected: false,
      canMove: false,
    })),
    isActive: true,
  };
}

function state(players: Player[], overrides: Partial<GameState> = {}): GameState {
  return {
    players,
    currentPlayerIndex: 0,
    diceValue: null,
    gamePhase: "playing",
    winner: null,
    lastRoll: null,
    canRollAgain: false,
    turnStartTime: 1000,
    autoPlayEnabled: false,
    playerCount: players.length,
    ...overrides,
  };
}

/** Table à quatre, chaque couleur absente étant en base. */
function four(positions: Partial<Record<LudoColor, number[]>> = {}): Player[] {
  return (["yellow", "green", "blue", "red"] as LudoColor[]).map((color) =>
    player(color, positions[color] ?? [-1, -1, -1, -1]),
  );
}

function findPathIndex(color: LudoColor, ring: number): number {
  const track = getTrack(4);
  for (let path = 0; path < track.homeColumnStart; path++) {
    if (track.ringIndexOf(color, path) === ring) return path;
  }
  throw new Error(`pas d'index de chemin pour ${color} sur l'anneau ${ring}`);
}

describe("withRoll — poser le dé", () => {
  it("marque les pions jouables et efface un relance périmé", () => {
    const next = withRoll(
      state(four({ yellow: [20, -1, -1, -1] }), { canRollAgain: true }),
      2,
      2000,
    );
    expect(next.diceValue).toBe(2);
    expect(next.lastRoll).toBe(2);
    expect(next.canRollAgain).toBe(false);
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.players[0].pieces[0].canMove).toBe(true);
    // Un pion en base ne sort qu'avec un 6.
    expect(next.players[0].pieces[1].canMove).toBe(false);
  });

  it("passe la main quand le lancer n'ouvre aucun coup", () => {
    const next = withRoll(state(four()), 3, 2000);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.diceValue).toBeNull();
    expect(next.canRollAgain).toBe(false);
  });
});

describe("withMove — appliquer un coup", () => {
  it("avance d'exactement un joueur après un coup normal", () => {
    const next = withMove(
      state(four({ yellow: [10, -1, -1, -1] }), { diceValue: 3 }),
      0,
      0,
      2000,
    );
    expect(next.players[0].pieces[0].position).toBe(13);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.diceValue).toBeNull();
    expect(next.canRollAgain).toBe(false);
  });

  it("garde le même joueur après un 6", () => {
    const next = withMove(
      state(four({ yellow: [10, -1, -1, -1] }), { diceValue: 6 }),
      0,
      0,
      2000,
    );
    expect(next.players[0].pieces[0].position).toBe(16);
    expect(next.currentPlayerIndex).toBe(0);
    expect(next.canRollAgain).toBe(true);
    expect(next.diceValue).toBeNull();
  });

  it("capture un pion adverse et relance", () => {
    const track = getTrack(4);
    const destination = 22;
    const redPath = findPathIndex("red", track.ringIndexOf("yellow", destination));
    const next = withMove(
      state(four({ yellow: [21, -1, -1, -1], red: [redPath, -1, -1, -1] }), {
        diceValue: 1,
      }),
      0,
      0,
      2000,
    );
    expect(next.players[0].pieces[0].position).toBe(destination);
    expect(next.players[3].pieces[0].position).toBe(-1);
    expect(next.canRollAgain).toBe(true);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it("accorde un tour supplémentaire quand un pion arrive au centre", () => {
    const next = withMove(
      state(four({ yellow: [56, -1, -1, -1] }), { diceValue: 1 }),
      0,
      0,
      2000,
    );
    expect(next.players[0].pieces[0].position).toBe(57);
    expect(next.canRollAgain).toBe(true);
    expect(next.currentPlayerIndex).toBe(0);
  });

  it("termine la partie quand les quatre pions sont arrivés", () => {
    const next = withMove(
      state(four({ yellow: [57, 57, 57, 56] }), { diceValue: 1 }),
      0,
      3,
      2000,
    );
    expect(next.gamePhase).toBe("finished");
    expect(next.winner?.color).toBe("yellow");
    expect(next.players[0].pieces[3].position).toBe(57);
  });

  it("ne touche à rien sur un coup illégal", () => {
    const before = state(four({ yellow: [-1, -1, -1, -1] }), { diceValue: 3 });
    expect(withMove(before, 0, 0, 2000)).toBe(before);
  });
});

describe("enchaînement complet", () => {
  it("ne fait pas rejouer le même joueur après un coup normal", () => {
    let game = state(
      four({ yellow: [10, -1, -1, -1], green: [10, -1, -1, -1] }),
    );
    game = withRoll(game, 3, 1000);
    game = withMove(game, 0, 0, 1100);
    expect(game.currentPlayerIndex).toBe(1);

    game = withRoll(game, 3, 1200);
    expect(game.currentPlayerIndex).toBe(1);
    expect(game.diceValue).toBe(3);
  });
});
