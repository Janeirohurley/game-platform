import { describe, expect, it } from "bun:test";

import {
  destinationOf,
  grantsExtraTurn,
  hasWon,
  legalMoves,
  resolveCaptures,
  type RulePiece,
} from "./rules";
import { getTrack } from "./positionUtils";
import { finishedPositionFor } from "../data/boardPositions";
import type { LudoColor } from "../data/track";

const track4 = getTrack(4);

function pathIndexOfRing(color: LudoColor, ring: number): number {
  const track = getTrack(4);
  for (let p = 0; p < track.homeColumnStart; p++) {
    if (track.ringIndexOf(color, p) === ring) return p;
  }
  throw new Error(`no path index for ${color} ring ${ring}`);
}

/** Indice de chemin d'un pion rouge posé sur l'anneau que la case cible occupe. */
function redOnSameRingAs(dest: number, color: LudoColor = "yellow"): number {
  const ring = track4.ringIndexOf(color, dest);
  return pathIndexOfRing("red", ring);
}

describe("destinationOf", () => {
  it("ne sort de base que sur un 6", () => {
    const piece: RulePiece = { index: 0, position: -1 };
    expect(destinationOf(piece, 6, 57)).toBe(0);
    expect(destinationOf(piece, 5, 57)).toBeNull();
  });

  it("atteint le centre par un lancer exact depuis la dernière case", () => {
    expect(destinationOf({ index: 0, position: 56 }, 1, 57)).toBe(57);
    expect(destinationOf({ index: 0, position: 56 }, 2, 57)).toBeNull();
  });

  it("ne bouge pas un pion déjà arrivé", () => {
    expect(destinationOf({ index: 0, position: 57 }, 3, 57)).toBeNull();
  });

  it("rejette un lancer hors 1–6", () => {
    expect(destinationOf({ index: 0, position: 10 }, 0, 57)).toBeNull();
    expect(destinationOf({ index: 0, position: 10 }, 7, 57)).toBe(null);
  });

  it("utilise la fin de parcours de la table (83 en hexagonal)", () => {
    const finished = finishedPositionFor(6);
    expect(finished).toBe(83);
    expect(destinationOf({ index: 0, position: 82 }, 1, finished)).toBe(83);
    expect(destinationOf({ index: 0, position: 82 }, 2, finished)).toBeNull();
  });
});

describe("legalMoves", () => {
  it("propose une sortie de base par pion sur un 6", () => {
    const pieces: RulePiece[] = [0, 1, 2, 3].map((index) => ({ index, position: -1 }));
    const moves = legalMoves(4, "yellow", pieces, 6);
    expect(moves).toHaveLength(4);
    for (const move of moves) {
      expect(move.releaseFromBase).toBe(true);
      expect(move.toPosition).toBe(0);
    }
  });

  it("ne propose rien depuis la base sur un lancer inférieur à 6", () => {
    const pieces: RulePiece[] = [0, 1].map((index) => ({ index, position: -1 }));
    expect(legalMoves(4, "yellow", pieces, 3)).toHaveLength(0);
  });

  it("exclut un pion déjà arrivé", () => {
    const pieces: RulePiece[] = [
      { index: 0, position: 57 },
      { index: 1, position: 20 },
    ];
    const moves = legalMoves(4, "yellow", pieces, 3);
    expect(moves.map((m) => m.pieceIndex)).toEqual([1]);
  });
});

describe("resolveCaptures", () => {
  it("capture un pion adverse sur une case non sûre de l'anneau", () => {
    const dest = 22;
    expect(track4.isSafeCell(track4.ringIndexOf("yellow", dest))).toBe(false);
    const opponent: RulePiece = { index: 0, position: redOnSameRingAs(dest) };
    const captured = resolveCaptures(4, "yellow", dest, [{ color: "red", pieces: [opponent] }]);
    expect(captured).toEqual([0]);
  });

  it("ne capture pas sur une case sûre", () => {
    const dest = 8; // case sûre en classique
    expect(track4.isSafeCell(track4.ringIndexOf("yellow", dest))).toBe(true);
    const opponent: RulePiece = { index: 0, position: redOnSameRingAs(dest) };
    const captured = resolveCaptures(4, "yellow", dest, [{ color: "red", pieces: [opponent] }]);
    expect(captured).toEqual([]);
  });

  it("ne capture jamais dans une colonne maison", () => {
    const captured = resolveCaptures(4, "yellow", 53, [{ color: "red", pieces: [{ index: 0, position: 0 }] }]);
    expect(captured).toEqual([]);
  });
});

describe("grantsExtraTurn", () => {
  it("accorde un tour sur un 6, une capture ou une arrivée", () => {
    expect(grantsExtraTurn(6, { captures: [], finishes: false })).toBe(true);
    expect(grantsExtraTurn(3, { captures: [0], finishes: false })).toBe(true);
    expect(grantsExtraTurn(3, { captures: [], finishes: true })).toBe(true);
    expect(grantsExtraTurn(3, { captures: [], finishes: false })).toBe(false);
  });
});

describe("hasWon", () => {
  it("gagne quand les quatre pions sont arrivés", () => {
    const finished = finishedPositionFor(6);
    const pieces: RulePiece[] = [0, 1, 2, 3].map((index) => ({ index, position: finished }));
    expect(hasWon(pieces, finished)).toBe(true);
    expect(hasWon([...pieces, { index: 4, position: 20 }], finished)).toBe(false);
    expect(hasWon([], finished)).toBe(false);
  });
});
