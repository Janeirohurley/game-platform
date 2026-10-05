import { describe, expect, it } from "bun:test";

import {
  createTrack,
  HEX_ARM_LENGTH,
  HEX_FINISHED_POSITION,
  HEX_HOME_COLUMN_START,
  HEX_RING_LENGTH,
  LUDO_PALETTE,
  type BoardPoint,
} from "./track";
import { finishedPositionFor, homeColumnStartFor } from "./boardPositions";
import {
  getPositionCoordinates,
  getTileKey,
} from "../utils/positionUtils";

/** Écart entre deux cases voisines du plateau hexagonal. */
const PITCH = 0.84;

const dist = (a: BoardPoint, b: BoardPoint) => Math.hypot(a.x - b.x, a.z - b.z);

// Valeurs relevées sur le code AVANT l'ajout du plateau hexagonal.
const CLASSIC_BEFORE: Record<number, { offsets: number[]; safe: number[] }> = {
  2: { offsets: [0, 26], safe: [0, 13, 26, 39] },
  3: { offsets: [0, 17, 35], safe: [0, 9, 17, 26, 35, 44] },
  4: { offsets: [0, 13, 26, 39], safe: [0, 7, 13, 20, 26, 33, 39, 46] },
};

describe("plateau classique 2-4 joueurs : strictement identique à avant", () => {
  for (const n of [2, 3, 4]) {
    it(`${n} joueurs : 52 cases, chemins de 57 entrées, mêmes départs et cases sûres`, () => {
      const track = createTrack(n);
      expect(track.shape).toBe("classic");
      expect(track.ring.length).toBe(52);
      expect(track.ringLength).toBe(52);
      expect(track.homeColumnStart).toBe(51);
      expect(track.finishedPosition).toBe(57);
      expect(track.seats.map((s) => s.offset)).toEqual(CLASSIC_BEFORE[n].offsets);
      expect([...track.safeCells].sort((a, b) => a - b)).toEqual(CLASSIC_BEFORE[n].safe);
      for (const seat of track.seats) {
        const path = track.pathOf(seat.color);
        expect(path.length).toBe(57);
        expect(path[0]).toEqual(track.ring[seat.offset]);
        expect(path[51]).toEqual(seat.homeColumn[0]);
      }
    });
  }
});

describe("plateau hexagonal 5-6 joueurs : géométrie", () => {
  for (const n of [5, 6]) {
    const track = createTrack(n);

    it(`${n} joueurs : 78 cases d'anneau, maison 77-82, arrivée 83`, () => {
      expect(track.shape).toBe("hex");
      expect(track.ring.length).toBe(HEX_RING_LENGTH);
      expect(track.ringLength).toBe(78);
      expect(track.homeColumnStart).toBe(HEX_HOME_COLUMN_START);
      expect(track.finishedPosition).toBe(HEX_FINISHED_POSITION);
      expect(track.seats.length).toBe(n);
      expect(track.colors).toEqual(LUDO_PALETTE.slice(0, n));
    });

    it(`${n} joueurs : deux cases voisines de l'anneau sont toujours à un pas, y compris à la jonction des bras`, () => {
      for (let i = 0; i < HEX_RING_LENGTH; i += 1) {
        const a = track.ring[i];
        const b = track.ring[(i + 1) % HEX_RING_LENGTH];
        expect(Math.abs(dist(a, b) - PITCH)).toBeLessThan(0.005);
      }
    });

    it(`${n} joueurs : aucune case n'en recouvre une autre`, () => {
      const cells: BoardPoint[] = [...track.ring];
      for (const seat of track.seats) cells.push(...seat.homeColumn);
      let min = Infinity;
      for (let i = 0; i < cells.length; i += 1) {
        for (let j = i + 1; j < cells.length; j += 1) {
          min = Math.min(min, dist(cells[i], cells[j]));
        }
      }
      expect(min).toBeGreaterThan(PITCH * 0.95);
    });

    it(`${n} joueurs : chaque chemin fait 83 entrées, de la case de départ à la colonne maison`, () => {
      for (const seat of track.seats) {
        const path = track.pathOf(seat.color);
        expect(path.length).toBe(83);
        expect(path[0]).toEqual(seat.start);
        // Le 77e pas d'anneau est le bout du bras, voisin du 1er pas de maison.
        expect(Math.abs(dist(path[76], path[77]) - PITCH)).toBeLessThan(0.005);
        for (let k = 77; k < 82; k += 1) {
          expect(Math.abs(dist(path[k], path[k + 1]) - PITCH)).toBeLessThan(0.005);
        }
      }
    });

    it(`${n} joueurs : la colonne maison pointe vers le centre`, () => {
      for (const seat of track.seats) {
        const radii = seat.homeColumn.map((p) => Math.hypot(p.x, p.z));
        for (let k = 0; k < 5; k += 1) expect(radii[k]).toBeGreaterThan(radii[k + 1]);
        expect(radii[5]).toBeLessThan(2);
      }
    });

    it(`${n} joueurs : les zones d'attente sont hors de l'anneau et dans le socle de 24`, () => {
      const ringMax = Math.max(...track.ring.map((p) => Math.hypot(p.x, p.z)));
      for (const seat of track.seats) {
        expect(seat.base.length).toBe(4);
        for (const slot of seat.base) {
          expect(Math.hypot(slot.x, slot.z)).toBeGreaterThan(ringMax + 1);
          expect(Math.abs(slot.x)).toBeLessThan(11);
          expect(Math.abs(slot.z)).toBeLessThan(11);
        }
      }
    });
  }

  it("5 et 6 joueurs ont les mêmes 12 cases sûres, étoile à 8 cases du départ", () => {
    const five = [...createTrack(5).safeCells].sort((a, b) => a - b);
    const six = [...createTrack(6).safeCells].sort((a, b) => a - b);
    expect(five).toEqual(six);
    expect(six).toEqual([0, 8, 13, 21, 26, 34, 39, 47, 52, 60, 65, 73]);
    expect(HEX_ARM_LENGTH).toBe(13);
  });

  it("les départs sont à 13 cases les uns des autres", () => {
    const track = createTrack(6);
    expect(track.seats.map((s) => s.offset)).toEqual([0, 13, 26, 39, 52, 65]);
  });

  it("les six bras sont régulièrement répartis autour du centre", () => {
    const track = createTrack(6);
    for (let k = 0; k < 6; k += 1) {
      const a = track.seats[k].angle;
      const b = track.seats[(k + 1) % 6].angle;
      const step = (((b - a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      expect(Math.abs(step - Math.PI / 3)).toBeLessThan(1e-9);
    }
  });
});

describe("positions 3D", () => {
  it("6 joueurs : base, départ, colonne maison et centre", () => {
    const track = createTrack(6);
    const red = track.seats[1];
    const at = (position: number, piece = 0) =>
      getPositionCoordinates(position, red.color, piece, 6);
    expect(at(-1, 2)).toEqual([red.base[2].x, 0.2, red.base[2].z]);
    expect(at(0)).toEqual([red.start.x, 0.2, red.start.z]);
    expect(at(77)).toEqual([red.homeColumn[0].x, 0.2, red.homeColumn[0].z]);
    expect(at(82)).toEqual([red.homeColumn[5].x, 0.2, red.homeColumn[5].z]);
    expect(at(83)).toEqual([0, 0.2, 0]);
  });

  it("4 joueurs : la case 57 reste le centre et la 56 reste la dernière case de maison", () => {
    const yellow = createTrack(4).seats[0];
    expect(getPositionCoordinates(57, yellow.color, 0, 4)).toEqual([0, 0.2, 0]);
    expect(getPositionCoordinates(56, yellow.color, 0, 4)).toEqual([
      yellow.homeColumn[5].x,
      0.2,
      yellow.homeColumn[5].z,
    ]);
  });

  it("une position hors contrat revient au centre au lieu de flotter", () => {
    expect(getPositionCoordinates(84, "yellow", 0, 6)).toEqual([0, 0.2, 0]);
  });

  it("deux couleurs sur la même case d'anneau ont la même clé de regroupement", () => {
    // Siège 0 au pas 15 et siège 1 au pas 2 : même case d'anneau (15).
    expect(getTileKey(15, "yellow", 6)).toBe(getTileKey(2, "red", 6));
    expect(getTileKey(-1, "yellow", 6)).toBeNull();
    expect(getTileKey(83, "yellow", 6)).toBeNull();
    expect(getTileKey(77, "yellow", 6)).not.toBeNull();
  });
});

describe("constantes par taille de table", () => {
  it("classique jusqu'à 4, hexagonal à partir de 5", () => {
    expect([2, 3, 4].map(homeColumnStartFor)).toEqual([51, 51, 51]);
    expect([2, 3, 4].map(finishedPositionFor)).toEqual([57, 57, 57]);
    expect([5, 6].map(homeColumnStartFor)).toEqual([77, 77]);
    expect([5, 6].map(finishedPositionFor)).toEqual([83, 83]);
  });

  it("une taille invalide est refusée", () => {
    expect(() => createTrack(7)).toThrow();
    expect(() => createTrack(1)).toThrow();
  });
});
