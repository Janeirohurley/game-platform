/**
 * center.ts — the finish slots are pure geometry, so they get pure tests:
 * the drawing (CenterArea) and the piece placement (positionUtils) both
 * depend on them and must agree.
 */

import { describe, expect, test } from "bun:test";

import {
  CENTER_TRIANGLE_RADIUS,
  COLOR_AXES,
  finishedSlotOffset,
  type LudoColorName,
} from "./center";

const COLORS: LudoColorName[] = ["yellow", "green", "blue", "red"];

describe("centre finish zone geometry", () => {
  test("le diamant ne dépasse pas les cases de l'anneau", () => {
    // La case d'anneau après l'entrée des colonnes commence à
    // |x| + |z| = 2.55 (case (0,3)/(3,0), bord intérieur). Le rayon reste
    // en deçà pour ne jamais couvrir une case en jeu.
    expect(CENTER_TRIANGLE_RADIUS).toBeLessThan(2.55);
    expect(CENTER_TRIANGLE_RADIUS).toBeGreaterThan(1.55);
  });

  test("chaque triangle pointe vers sa zone de départ", () => {
    const quadrants: Record<LudoColorName, [number, number]> = {
      yellow: [-1, -1],
      green: [-1, 1],
      blue: [1, 1],
      red: [1, -1],
    };
    for (const color of COLORS) {
      const [qx, qz] = quadrants[color];
      const { A, B } = COLOR_AXES[color];
      expect(A[0]).toBe(qx);
      expect(A[1]).toBe(0);
      expect(B[0]).toBe(0);
      expect(B[1]).toBe(qz);
    }
  });

  test("quatre slots distincts par couleur, dans le triangle", () => {
    for (const color of COLORS) {
      const slots = COLORS.map((_, i) => finishedSlotOffset(color, i));
      // L'épingle : u + v <= R (ici |x| + |z| <= R pour des axes unitaires),
      // sans quoi une pièce déborderait du diamant vers l'anneau.
      for (const [x, z] of slots) {
        expect(Math.abs(x) + Math.abs(z)).toBeLessThanOrEqual(
          CENTER_TRIANGLE_RADIUS + 1e-9,
        );
      }
      for (let i = 0; i < slots.length; i += 1) {
        for (let j = i + 1; j < slots.length; j += 1) {
          const dx = slots[i][0] - slots[j][0];
          const dz = slots[i][1] - slots[j][1];
          // Deux pièces au même emplacement se recouvriraient toujours.
          expect(Math.hypot(dx, dz)).toBeGreaterThan(0.5);
        }
      }
    }
  });

  test("les triangles de couleurs différentes ne se chevauchent jamais", () => {
    const all = new Set<string>();
    for (const color of COLORS) {
      for (const index of [0, 1, 2, 3]) {
        const [x, z] = finishedSlotOffset(color, index);
        const key = `${x.toFixed(3)}:${z.toFixed(3)}`;
        expect(all.has(key)).toBe(false);
        all.add(key);
      }
    }
  });

  test("les slots de la dernière colonne ne cognent pas la case suivante de l'anneau", () => {
    // La case d'anneau la plus proche au-delà du diamant commence à
    // |x| + |z| >= 2.55 ; le slot le plus profond reste en deçà.
    const deepest = COLORS.map((color) => finishedSlotOffset(color, 3));
    for (const [x, z] of deepest) {
      expect(Math.abs(x) + Math.abs(z)).toBeLessThan(2.4);
    }
  });
});