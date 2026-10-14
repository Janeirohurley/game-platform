import { describe, expect, it } from "bun:test";

import { chooseMove, raceRiskFactor } from "./bot";
import { getTrack } from "../utils/positionUtils";
import { legalMoves } from "../utils/rules";
import type { LudoColor } from "../data/track";

/** Un pion adverse placé `behind` cases de ring DERRIÈRE `dest`. */
function opponentBehind(dest: number, behind: number, color: LudoColor = "red") {
  const track4 = getTrack(4);
  const destRing = track4.ringIndexOf("yellow", dest);
  const ring = (destRing - behind + track4.ringLength) % track4.ringLength;
  return { p: pathIndexOfRingOrThrow(color, ring), ring };
}

function pathIndexOfRingOrThrow(color: LudoColor, ring: number): number {
  const track4 = getTrack(4);
  for (let p = 0; p < track4.homeColumnStart; p++) {
    if (track4.ringIndexOf(color, p) === ring) return p;
  }
  throw new Error(`no path index for ${color} ring ${ring}`);
}

function context(
  piecesPositions: number[],
  dice: number,
  opponents: { color: LudoColor; pieces: number[] }[] = [],
) {
  return {
    playerCount: 4,
    color: "yellow" as LudoColor,
    dice,
    pieces: piecesPositions.map((position, index) => ({ index, position })),
    opponents: opponents.map((o) => ({
      color: o.color,
      pieces: o.pieces.map((position, index) => ({ index, position })),
    })),
  };
}

describe("chooseMove — garde-fous", () => {
  it("ne rend rien sans coup légal", () => {
    expect(chooseMove("hard", [], context([-1, -1, -1, -1], 3))).toBeNull();
    expect(chooseMove("normal", [], context([], 1))).toBeNull();
    expect(chooseMove("easy", [], context([], 1))).toBeNull();
  });

  it("rend toujours un coup légal, quel que soit le niveau", () => {
    const pieces = [20, 30, -1, 40];
    for (const difficulty of ["easy", "normal", "hard"] as const) {
      const legal = legalMoves(4, "yellow", pieces.map((position, index) => ({ index, position })), 3);
      const choice = chooseMove(difficulty, legal, context(pieces, 3), () => 0.42);
      expect(choice).not.toBeNull();
      expect(legal.some((m) => m.pieceIndex === choice!.move.pieceIndex)).toBe(true);
    }
  });
});

describe("niveau Facile", () => {
  it("est déterministe pour un RNG injecté et reste légal", () => {
    const pieces = [{ index: 0, position: -1 }, { index: 1, position: -1 }];
    const legal = [
      { pieceIndex: 0, fromPosition: -1, toPosition: 0, destinationRing: 0, captures: [], finishes: false, releaseFromBase: true, safe: true, entersHome: false },
      { pieceIndex: 1, fromPosition: -1, toPosition: 0, destinationRing: 0, captures: [], finishes: false, releaseFromBase: true, safe: true, entersHome: false },
    ];
    const ctx = {
      playerCount: 4,
      color: "yellow" as LudoColor,
      dice: 6,
      pieces,
      opponents: [],
    };
    const a = chooseMove("easy", legal, ctx, () => 0.1);
    const b = chooseMove("easy", legal, ctx, () => 0.1);
    expect(a).toEqual(b);
    expect(a!.move.pieceIndex).toBe(0);
  });
});

describe("niveau Normal", () => {
  it("préfère capturer un pion adverse", () => {
    const opponent = opponentBehind(22, 0); // rouge SUR la case 22
    const opponents = [{ color: "red" as LudoColor, pieces: [{ index: 0, position: opponent.p }] }];
    const pieces = [{ index: 0, position: 21 }, { index: 1, position: 40 }];
    const legal = legalMoves(4, "yellow", pieces, 1);
    const choice = chooseMove("normal", legal, {
      playerCount: 4,
      color: "yellow",
      dice: 1,
      pieces,
      opponents,
    });
    expect(choice!.move.pieceIndex).toBe(0);
    expect(choice!.move.toPosition).toBe(22);
  });

  it("préfère sortir un pion de base sur un 6", () => {
    const pieces = [{ index: 0, position: 20 }, { index: 1, position: -1 }];
    const legal = legalMoves(4, "yellow", pieces, 6);
    const choice = chooseMove("normal", legal, {
      playerCount: 4,
      color: "yellow",
      dice: 6,
      pieces,
      opponents: [],
    });
    expect(choice!.move.releaseFromBase).toBe(true);
  });
});

describe("niveau Difficile", () => {
  it("préfère éloigner un pion menacé plutôt qu'en avancer un autre autant", () => {
    // A en 30 est menacé par une pièce rouge 3 cases derrière.
    // Un 6 éloigne A vers 36 (hors de portée) ; B peut aussi avancer de 6.
    const threat = opponentBehind(30, 3);
    const opponents = [{ color: "red" as LudoColor, pieces: [{ index: 0, position: threat.p }] }];
    const pieces = [{ index: 0, position: 30 }, { index: 1, position: 40 }];
    const legal = legalMoves(4, "yellow", pieces, 6);
    const ctx = { playerCount: 4, color: "yellow" as LudoColor, dice: 6, pieces, opponents };

    const normal = chooseMove("normal", legal, ctx);
    const hard = chooseMove("hard", legal, ctx);

    // Normal, sans notion de sauvetage, part sur l'avance la plus lointaine.
    expect(normal!.move.pieceIndex).toBe(1);
    // Difficile sauve le pion menacé.
    expect(hard!.move.pieceIndex).toBe(0);
    expect(hard!.move.toPosition).toBe(36);
  });

  it("ne place pas un pion dans la portée d'un adversaire quand une alternative sûre existe", () => {
    // Deux coups de même gain ; l'un arrive en 32 (menacé), l'autre en 22 (sûr).
    const threat = opponentBehind(32, 4);
    const opponents = [{ color: "red" as LudoColor, pieces: [{ index: 0, position: threat.p }] }];
    const pieces = [{ index: 0, position: 30 }, { index: 1, position: 20 }];
    const legal = legalMoves(4, "yellow", pieces, 2);
    const ctx = { playerCount: 4, color: "yellow" as LudoColor, dice: 2, pieces, opponents };
    const hard = chooseMove("hard", legal, ctx);
    expect(hard!.move.pieceIndex).toBe(1);
    expect(hard!.move.toPosition).toBe(22);
  });
});

describe("raceRiskFactor — tolérance au risque selon la course", () => {
  const base = { playerCount: 4, color: "yellow" as LudoColor, dice: 1 };

  it("est audacieuse quand on est en retard", () => {
    const factor = raceRiskFactor({
      ...base,
      pieces: [{ index: 0, position: 3 }],
      opponents: [{ color: "red", pieces: [{ index: 0, position: 40 }] }],
    });
    expect(factor).toBeLessThan(1);
  });

  it("est prudente quand on est en tête", () => {
    const factor = raceRiskFactor({
      playerCount: 4,
      color: "yellow",
      dice: 1,
      pieces: [{ index: 0, position: 40 }],
      opponents: [{ color: "red", pieces: [{ index: 0, position: 3 }] }],
    });
    expect(factor).toBeGreaterThan(1);
  });

  it("reste neutre à progression égale", () => {
    const factor = raceRiskFactor({
      playerCount: 4,
      color: "yellow",
      dice: 1,
      pieces: [{ index: 0, position: 20 }],
      opponents: [{ color: "red", pieces: [{ index: 0, position: 20 }] }],
    });
    expect(factor).toBe(1);
  });
});
