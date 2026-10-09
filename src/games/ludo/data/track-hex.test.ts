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

// Contrat canonique du plateau classique : quatre bras FIXES, quatre coins de
// départ, huit cases sûres. `playerCount` ne choisit plus que les bras
// occupés — il ne modifie ni l'anneau ni les cases sûres. C'est cette
// invariance qui remplace l'ancien anneau regénéré à chaque taille de table.
const CLASSIC_ARMS = [0, 13, 26, 39];
const CLASSIC_STAR_OFFSET = 8;
const CLASSIC_CANONICAL_OFFSETS: Record<number, number[]> = {
  2: [0, 26],
  3: [0, 13, 26],
  4: [0, 13, 26, 39],
};
const CLASSIC_SAFE = CLASSIC_ARMS.flatMap((offset) => [
  offset,
  (offset + CLASSIC_STAR_OFFSET) % 52,
]).sort((a, b) => a - b);

describe("plateau classique : une croix fixe à quatre bras", () => {
  it("les 2, 3 et 4 joueurs partagent le même anneau et les mêmes 8 cases sûres", () => {
    for (const n of [2, 3, 4]) {
      const track = createTrack(n);
      expect(track.shape).toBe("classic");
      expect(track.ring.length).toBe(52);
      expect(track.ringLength).toBe(52);
      expect(track.homeColumnStart).toBe(51);
      expect(track.finishedPosition).toBe(57);
      // On épingle des cases précises plutôt que l'égalité du tableau
      // d'anneau : les pistes partagent la même constante, donc une égalité
      // de référence ne prouverait rien.
      expect(track.ring[0]).toEqual({ x: -6 * PITCH, z: -1 * PITCH });
      expect(track.ring[13]).toEqual({ x: 1 * PITCH, z: -6 * PITCH });
      expect(track.ring[26]).toEqual({ x: 6 * PITCH, z: 1 * PITCH });
      expect(track.ring[39]).toEqual({ x: -1 * PITCH, z: 6 * PITCH });
      // La 52e case referme l'anneau juste avant le départ.
      expect(track.ring[51]).toEqual({ x: -7 * PITCH, z: -1 * PITCH });
      expect([...track.safeCells].sort((a, b) => a - b)).toEqual(CLASSIC_SAFE);
      expect(track.seats.map((s) => s.offset)).toEqual(CLASSIC_CANONICAL_OFFSETS[n]);
    }
  });

  it("les quatre bras existent toujours, occupés ou non", () => {
    for (const n of [2, 3, 4]) {
      const track = createTrack(n);
      expect(track.arms.map((arm) => arm.offset)).toEqual(CLASSIC_ARMS);
      // Une table à deux joueurs garde bien quatre bras, dont deux vides :
      // c'est la croix du plateau physique, pas un anneau de deux couleurs.
      expect(track.arms.filter((arm) => arm.seat !== null)).toHaveLength(n);
      expect(track.arms.filter((arm) => arm.seat === null)).toHaveLength(4 - n);
      for (const arm of track.arms) {
        expect(arm.homeColumn).toHaveLength(6);
        expect(arm.base).toHaveLength(4);
      }
    }
  });

  it("les départs sont les quatre coins relevés sur le plateau d'origine", () => {
    // (-6,-1), (1,-6), (6,1) et (-1,6) : à deux cases du bout de leur bras,
    // et non au milieu comme le calcul par table le produisait.
    const track = createTrack(4);
    expect(track.arms.map((arm) => [arm.start.x, arm.start.z])).toEqual([
      [-6 * PITCH, -1 * PITCH],
      [1 * PITCH, -6 * PITCH],
      [6 * PITCH, 1 * PITCH],
      [-1 * PITCH, 6 * PITCH],
    ]);
  });

  it("le départ est le voisin immédiat de l'entrée de la colonne maison", () => {
    for (const n of [2, 3, 4]) {
      const track = createTrack(n);
      for (const arm of track.arms) {
        // Un pas exact : le départ et la première case privée sont
        // bord à bord, ce qui garantit que le jeton passe de l'un à l'autre
        // sans saut. Une colonne qui dérivait sur un autre bras le romprait.
        expect(dist(arm.start, arm.homeColumn[0])).toBeCloseTo(PITCH, 5);
      }
    }
  });

  it("à deux joueurs, les deux coins occupés sont opposés", () => {
    const offsets = createTrack(2).seats.map((s) => s.offset);
    expect(offsets).toEqual([0, 26]);
    expect(Math.abs(offsets[1] - offsets[0])).toBe(26);
  });

  for (const n of [2, 3, 4]) {
    it(`${n} joueurs : chemins de 57 entrées, du départ à la colonne maison`, () => {
      const track = createTrack(n);
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

    it(`${n} joueurs : les zones d'attente sont hors de l'anneau et dans l'empreinte du socle`, () => {
      const ringMax = Math.max(...track.ring.map((p) => Math.hypot(p.x, p.z)));
      for (const seat of track.seats) {
        expect(seat.base.length).toBe(4);
        for (const slot of seat.base) {
          // Les pods sont posés juste derrière le bout du bras : le premier
          // rang dégage la pointe (bord externe ≈ 6.9), le deuxième s'aligne
          // sur lui. Ils restent dans le socle hexagonal de 20.
          expect(Math.hypot(slot.x, slot.z)).toBeGreaterThan(ringMax + 1);
          expect(Math.abs(slot.x)).toBeLessThan(10);
          expect(Math.abs(slot.z)).toBeLessThan(10);
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
    // L'arrivée de rouge est dans le secteur du centre qui fait face à son
    // bras, pas au point exact (0,0) que les quatre couleurs partageaient.
    const [fx, fy, fz] = at(83);
    expect(fy).toBe(0.2);
    expect(fx * Math.cos(red.angle) + fz * Math.sin(red.angle)).toBeGreaterThan(0);
    expect(Math.hypot(fx, fz)).toBeLessThan(0.45);
    // Les quatre pions de rouge occupent quatre emplacements différents.
    expect(new Set([0, 1, 2, 3].map((p) => at(83, p).join(","))).size).toBe(4);
  });

  it("4 joueurs : la case 57 tombe dans le secteur du joueur, pas sur le point commun", () => {
    const yellow = createTrack(4).seats[0];
    // Le départ de jaune est sur le bras de gauche : son pion terminé doit
    // donc se trouver du côté négatif en x, à l'intérieur du carré central.
    const [yx, yy, yz] = getPositionCoordinates(57, yellow.color, 0, 4);
    expect(yy).toBe(0.2);
    expect(yx).toBeLessThan(0);
    expect(yx * Math.cos(yellow.angle) + yz * Math.sin(yellow.angle)).toBeGreaterThan(0);
    expect(Math.hypot(yx, yz)).toBeLessThan(0.45);
    // La 56 reste la dernière case de la colonne maison, inchangée.
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
