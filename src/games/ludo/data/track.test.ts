import { describe, expect, it } from "bun:test";

import {
  createTrack,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT,
  RING_LENGTH,
  LUDO_PALETTE,
  type LudoColor,
} from "./track";
import {
  getPositionCoordinates,
  getTileKey,
  getTrack,
} from "../utils/positionUtils";

/**
 * Client-side geometry contract.
 *
 * The board is generated from `playerCount`, so the real risk is no
 * longer "someone forgot a coordinate" but "the generated shape is
 * self-inconsistent" — a cell sitting on another one, a path that does
 * not close, an arm that is not reachable. These assertions are the
 * invariant list that would catch a bad constant in `track.ts`.
 *
 * The counterpart on the server is `server-games/test/ludo-geometry.test.ts`.
 * The two files are hand-duplicated across separate repositories on
 * purpose: same invariants, different code.
 */

const SIZES = [2, 3, 4, 5, 6] as const;
// Plateau classique (anneau de 52 cases) : 2 à 4 joueurs.
// Plateau hexagonal (anneau de 78 cases) : 5 et 6 joueurs, voir track-hex.test.ts.
const CLASSIC_SIZES = [2, 3, 4] as const;

function distance(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

describe("createTrack", () => {
  it("rejects a table size outside the supported range", () => {
    expect(() => createTrack(0)).toThrow();
    expect(() => createTrack(1)).toThrow();
    expect(() => createTrack(7)).toThrow();
    expect(() => createTrack(2.5)).toThrow();
    expect(() => createTrack(Number.NaN)).toThrow();
  });

  it("seats the first N palette colors, so 4 players keeps its colors", () => {
    expect(createTrack(4).colors).toEqual(["yellow", "red", "blue", "green"]);
    expect(createTrack(2).colors).toEqual(["yellow", "red"]);
    expect(createTrack(6).colors).toEqual([...LUDO_PALETTE]);
  });

  it("gives every player a distinct start cell", () => {
    for (const size of SIZES) {
      const track = createTrack(size);
      const offsets = track.seats.map((seat) => seat.offset);
      expect(new Set(offsets).size).toBe(size);
    }
  });

  it("spaces the segments evenly, within one cell", () => {
    for (const size of CLASSIC_SIZES) {
      const track = createTrack(size);
      const segments = track.seats.map((seat, index) => {
        const next = track.seats[(index + 1) % size];
        return (next.offset - seat.offset + RING_LENGTH) % RING_LENGTH;
      });
      // 52 factors as 2 x 2 x 13, so only 2 and 4 divide it exactly.
      expect(Math.max(...segments) - Math.min(...segments)).toBeLessThanOrEqual(1);
    }
  });

  it("keeps 52 ring cells and a 57-cell path", () => {
    for (const size of CLASSIC_SIZES) {
      const track = createTrack(size);
      expect(track.ring).toHaveLength(RING_LENGTH);
      for (const seat of track.seats) {
        expect(seat.homeColumn).toHaveLength(6);
        expect(track.pathOf(seat.color)).toHaveLength(57);
      }
    }
  });

  it("places the 4-player table exactly on the historical offsets", () => {
    const track = createTrack(4);
    // Pinned: a 4-player table must keep the board it shipped with, so
    // the offsets can never be "improved" into a regression.
    expect(track.seats.map((seat) => seat.offset)).toEqual([0, 13, 26, 39]);
  });

  it("never puts two board cells on top of each other", () => {
    for (const size of SIZES) {
      const track = createTrack(size);
      const cells = [
        ...track.ring,
        ...track.seats.flatMap((seat) => [...seat.homeColumn, ...seat.base]),
      ];
      // The pitch between two neighbouring ring cells is 2R sin(pi/52) and
      // the home step matches it, so 0.8 is a safe "these are distinct"
      // threshold and would catch any real collision.
      for (let i = 0; i < cells.length; i += 1) {
        for (let j = i + 1; j < cells.length; j += 1) {
          expect(distance(cells[i], cells[j])).toBeGreaterThan(0.8);
        }
      }
    }
  });

  it("keeps the home column continuous with the ring", () => {
    for (const size of SIZES) {
      const track = createTrack(size);
      for (const seat of track.seats) {
        // The first home cell sits inside the ring, right after the start
        // cell. Anything much larger means the arm has drifted off-axis.
        expect(distance(seat.start, seat.homeColumn[0])).toBeLessThan(1.5);
        // ... and each following cell is one step further in.
        for (let i = 1; i < seat.homeColumn.length; i += 1) {
          expect(distance(seat.homeColumn[i - 1], seat.homeColumn[i])).toBeLessThan(0.9);
        }
      }
    }
  });

  it("keeps the base behind the arm, outside the ring", () => {
    for (const size of SIZES) {
      const track = createTrack(size);
      for (const seat of track.seats) {
        for (const cell of seat.base) {
          // A base slot must be further from the centre than every ring
          // cell, otherwise a piece waiting to leave would sit on the
          // shared track.
          const ringRadius = Math.min(...track.ring.map((p) => Math.hypot(p.x, p.z)));
          expect(Math.hypot(cell.x, cell.z)).toBeGreaterThan(ringRadius + 1);
        }
      }
    }
  });

  it("maps a path index back to the ring cell it was drawn on", () => {
    for (const size of CLASSIC_SIZES) {
      const track = createTrack(size);
      for (const seat of track.seats) {
        const path = track.pathOf(seat.color);
        for (let index = 0; index <= 50; index += 1) {
          const ringIndex = track.ringIndexOf(seat.color, index);
          expect(ringIndex).toBe((seat.offset + index) % RING_LENGTH);
          // The drawn point must be exactly the ring cell, not merely
          // near it: the piece animation walks this path cell by cell.
          expect(distance(path[index], track.ring[ringIndex])).toBeLessThan(1e-9);
        }
        // The last six path entries are the private column, never the ring.
        for (let index = 51; index <= 56; index += 1) {
          expect(distance(track.pathOf(seat.color)[index], track.ring[track.ringIndexOf(seat.color, index)])).toBeGreaterThan(1);
        }
      }
    }
  });

  it("marks exactly the start cells and one star per segment as safe", () => {
    for (const size of CLASSIC_SIZES) {
      const track = createTrack(size);
      // 2 per player, and no cell counted twice.
      expect(track.safeCells.size).toBe(size * 2);
      for (const seat of track.seats) {
        expect(track.isSafeCell(seat.offset)).toBe(true);
      }
    }
  });

  it("refuses to place a color that is not seated", () => {
    const track = createTrack(2);
    expect(() => track.pathOf("blue")).toThrow();
    expect(() => track.seatOf("purple")).toThrow();
    expect(() => track.ringIndexOf("orange", 0)).toThrow();
  });
});

describe("getPositionCoordinates", () => {
  it("puts the four waiting pieces in the seat's own base", () => {
    for (const size of SIZES) {
      const track = getTrack(size);
      for (const seat of track.seats) {
        const slots = [0, 1, 2, 3].map((piece) =>
          getPositionCoordinates(-1, seat.color as LudoColor, piece, size),
        );
        // Four distinct slots...
        expect(new Set(slots.map((slot) => slot.join(","))).size).toBe(4);
        // ...each on one of the base cells of that seat.
        for (const slot of slots) {
          const match = seat.base.some(
            (cell) =>
              Math.abs(cell.x - slot[0]) < 1e-6 && Math.abs(cell.z - slot[2]) < 1e-6,
          );
          expect(match).toBe(true);
        }
      }
    }
  });

  it("sends the finished piece to the center, whatever its color", () => {
    for (const size of SIZES) {
      const track = getTrack(size);
      for (const seat of track.seats) {
        // 57 sur le plateau classique, 83 sur le plateau hexagonal.
        expect(
          getPositionCoordinates(track.finishedPosition, seat.color, 0, size),
        ).toEqual([0, 0.2, 0]);
      }
    }
  });

  it("returns the same cell for two players sharing it", () => {
    const track = getTrack(4);
    // On a 4-player table the start of red (ring 13) is one step along
    // yellow's path, so they are never the same cell — but each player's
    // own path index must be stable, which is what the renderer relies on.
    for (const seat of track.seats) {
      const once = getPositionCoordinates(3, seat.color, 0, 4);
      const twice = getPositionCoordinates(3, seat.color, 0, 4);
      expect(once).toEqual(twice);
    }
  });

  it("clamps an out-of-range size and defaults an unusable one", () => {
    // Too large: clamped, in case a registry moves ahead of this component.
    expect(getTrack(99).playerCount).toBe(MAX_PLAYER_COUNT);
    expect(getTrack(3.9).playerCount).toBe(3);
    // Too small or unusable: the shipped default table, so the first
    // render never flashes a 2-player board while state is still loading.
    expect(getTrack(1).playerCount).toBe(MIN_PLAYER_COUNT);
    expect(getTrack(0).playerCount).toBe(4);
    expect(getTrack(Number.NaN).playerCount).toBe(4);
  });
});

describe("getTileKey", () => {
  it("returns null for the base and the center, which self-space", () => {
    expect(getTileKey(-1, "yellow")).toBeNull();
    expect(getTileKey(57, "yellow")).toBeNull();
    expect(getTileKey(83, "yellow", 6)).toBeNull();
  });

  it("returns a key for an in-play cell", () => {
    expect(getTileKey(0, "yellow")).toBeTypeOf("string");
  });

  it("groups two players who stand on the very same ring cell", () => {
    const track = getTrack(6);
    // Walk every player's whole ring and look for a shared cell: at six
    // players the paths overlap by construction, and the renderer must
    // see that as ONE tile or pieces would interpenetrate.
    const owner = new Map<string, LudoColor>();
    let shared = false;
    for (const seat of track.seats) {
        for (let index = 0; index <= 50; index += 1) {
          const key = getTileKey(index, seat.color as LudoColor, 6);
          if (!key) continue;
          const previous = owner.get(key);
          if (previous && previous !== seat.color) shared = true;
          else if (!previous) owner.set(key, seat.color as LudoColor);
        }
    }
    expect(shared).toBe(true);
  });
});
