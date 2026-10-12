import { describe, expect, it } from "bun:test";

import { getBaseCenter, getTrack } from "./positionUtils";
import type { LudoColor } from "../data/track";

const SEATED_COUNTS = [2, 3, 4, 5, 6];

describe("getBaseCenter", () => {
  it("renvoie le barycentre des emplacements de base du siège", () => {
    for (const playerCount of SEATED_COUNTS) {
      const track = getTrack(playerCount);
      for (const arm of track.arms) {
        if (!arm.seat) continue;
        const expected = arm.base.reduce(
          (acc, point) => ({
            x: acc.x + point.x / arm.base.length,
            z: acc.z + point.z / arm.base.length,
          }),
          { x: 0, z: 0 },
        );
        const center = getBaseCenter(playerCount, arm.seat.color);
        expect(center.x).toBeCloseTo(expected.x, 10);
        expect(center.z).toBeCloseTo(expected.z, 10);
      }
    }
  });

  it("situe chaque siège à distance non nulle du centre du plateau", () => {
    for (const playerCount of SEATED_COUNTS) {
      const track = getTrack(playerCount);
      for (const arm of track.arms) {
        if (!arm.seat) continue;
        const center = getBaseCenter(playerCount, arm.seat.color);
        expect(Math.hypot(center.x, center.z)).toBeGreaterThan(1);
      }
    }
  });

  it("renvoie l'origine pour une couleur sans siège", () => {
    // Tables de 2 joueurs : seules deux des six couleurs sont assises.
    const track = getTrack(2);
    const seated = new Set(
      track.arms
        .filter((arm) => arm.seat)
        .map((arm) => arm.seat?.color as LudoColor),
    );
    const all: LudoColor[] = [
      "yellow",
      "red",
      "blue",
      "green",
      "orange",
      "purple",
    ];
    const vacant = all.filter((color) => !seated.has(color));
    expect(vacant.length).toBeGreaterThan(0);
    for (const color of vacant) {
      expect(getBaseCenter(2, color)).toEqual({ x: 0, z: 0 });
    }
  });

  it("est stable : deux appels donnent le même point", () => {
    const first = getBaseCenter(6, "yellow");
    const second = getBaseCenter(6, "yellow");
    expect(second).toEqual(first);
  });
});
