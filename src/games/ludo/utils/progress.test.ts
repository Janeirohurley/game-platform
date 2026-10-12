import { describe, expect, it } from "bun:test";

import {
  maxStepsFor,
  pieceSteps,
  progressForColor,
  progressForPieces,
  progressForPositions,
  seatedColors,
} from "./progress";
import { finishedPositionFor } from "../data/boardPositions";
import type { GamePiece, GameState, Player } from "../types/game";
import type { LudoColor } from "../data/track";

function piecesAt(...positions: number[]): GamePiece[] {
  return positions.map((position, index) => ({
    id: `p${index}`,
    playerId: "player",
    position,
    isSelected: false,
    canMove: false,
  }));
}

function player(color: LudoColor, ...positions: number[]): Player {
  return {
    id: color,
    name: color,
    color,
    pieces: piecesAt(...positions),
    isActive: false,
  };
}

function gameState(playerCount: number, players: Player[]): GameState {
  return {
    players,
    currentPlayerIndex: 0,
    diceValue: null,
    gamePhase: "playing",
    winner: null,
    lastRoll: null,
    canRollAgain: false,
    turnStartTime: null,
    autoPlayEnabled: false,
    playerCount,
  };
}

describe("pieceSteps", () => {
  it("compte 0 pas pour une pièce en zone d'attente", () => {
    expect(pieceSteps(-1, 57)).toBe(0);
  });

  it("compte la sortie de base comme le premier pas", () => {
    expect(pieceSteps(0, 57)).toBe(1);
  });

  it("compte position + 1 sur le chemin", () => {
    expect(pieceSteps(56, 57)).toBe(57);
  });

  it("compte le chemin entier pour une pièce terminée", () => {
    expect(pieceSteps(57, 57)).toBe(58);
    expect(pieceSteps(83, 83)).toBe(84);
  });

  it("traite toute position négative comme le repos", () => {
    expect(pieceSteps(-42, 57)).toBe(0);
  });
});

describe("maxStepsFor", () => {
  it("vaut 58 pour la croix (2 à 4 joueurs)", () => {
    expect(maxStepsFor(2)).toBe(58);
    expect(maxStepsFor(3)).toBe(58);
    expect(maxStepsFor(4)).toBe(58);
  });

  it("vaut 84 pour l'hexagone (5 et 6 joueurs)", () => {
    expect(maxStepsFor(5)).toBe(84);
    expect(maxStepsFor(6)).toBe(84);
  });

  it("suit exactement la piste de la table", () => {
    for (const count of [2, 3, 4, 5, 6]) {
      expect(maxStepsFor(count)).toBe(finishedPositionFor(count) + 1);
    }
  });
});

describe("progressForPositions", () => {
  it("vaut 0 quand toutes les pièces sont en base", () => {
    expect(progressForPositions([-1, -1, -1, -1], 4)).toBe(0);
  });

  it("vaut 100 seulement quand toutes les pièces sont arrivées", () => {
    expect(progressForPositions([57, 57, 57, 57], 4)).toBe(100);
  });

  it("plafonne à 99 tant qu'une pièce n'est pas arrivée", () => {
    expect(progressForPositions([57, 57, 57, -1], 4)).toBe(75);
    expect(progressForPositions([57, 57, 57, 56], 4)).toBe(99);
  });

  it("reste sous 100 pour trois arrivées et une pièce à mi-chemin", () => {
    expect(progressForPositions([57, 57, 57, 28], 4)).toBe(87);
  });

  it("arrondit vers le bas", () => {
    // 1 pas sur 4 x 58 = 0,43 % → 0.
    expect(progressForPositions([0, -1, -1, -1], 4)).toBe(0);
    // 2 pas sur 232 = 0,86 % → 0 ; 12 pas = 5,17 % → 5.
    expect(progressForPositions([11, -1, -1, -1], 4)).toBe(5);
  });

  it("baisse quand une capture renvoie une pièce en base", () => {
    const before = progressForPositions([20, 30, -1, -1], 4);
    const after = progressForPositions([-1, 30, -1, -1], 4);
    expect(after).toBeLessThan(before);
  });

  it("ne décroît jamais quand une pièce avance", () => {
    const sequence = [
      [3, 10, 40, 55],
      [3, 10, 40, 56],
      [3, 10, 40, 57],
    ];
    let previous = progressForPositions(sequence[0], 4);
    for (const positions of sequence.slice(1)) {
      const next = progressForPositions(positions, 4);
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });

  it("utilise le chemin hexagonal pour 5 et 6 joueurs", () => {
    expect(progressForPositions([-1, -1, -1, -1, -1, -1], 6)).toBe(0);
    expect(progressForPositions([83, 83, 83, 83, 83, 83], 6)).toBe(100);
    expect(progressForPositions([83, 83, 83, 83, 83, -1], 6)).toBe(83);
  });

  it("vaut 0 pour un joueur sans pièce", () => {
    expect(progressForPositions([], 4)).toBe(0);
  });
});

describe("progressForPieces", () => {
  it("donne le même résultat que les positions", () => {
    expect(progressForPieces(piecesAt(10, 20, -1, 57), 4)).toBe(
      progressForPositions([10, 20, -1, 57], 4),
    );
  });
});

describe("progressForColor", () => {
  it("suit le siège de la couleur demandée", () => {
    const state = gameState(4, [
      player("yellow", 57, 57, 57, 57),
      player("red", -1, -1, -1, -1),
    ]);
    expect(progressForColor(state, "yellow")).toBe(100);
    expect(progressForColor(state, "red")).toBe(0);
  });

  it("vaut 0 pour un siège vacant", () => {
    const state = gameState(4, [player("yellow", 10, -1, -1, -1)]);
    expect(progressForColor(state, "blue")).toBe(0);
  });

  it("ignore une capture : la pièce retirée ne compte plus", () => {
    const state = gameState(4, [player("yellow", 30, 35, -1, -1)]);
    const before = progressForColor(state, "yellow");
    state.players[0].pieces[0].position = -1;
    expect(progressForColor(state, "yellow")).toBeLessThan(before);
  });
});

describe("seatedColors", () => {
  it("respecte l'ordre de la palette", () => {
    const state = gameState(6, [
      player("blue"),
      player("yellow"),
      player("purple"),
    ]);
    expect(seatedColors(state)).toEqual(["yellow", "blue", "purple"]);
  });

  it("est vide sans joueur", () => {
    expect(seatedColors(gameState(4, []))).toEqual([]);
  });
});
