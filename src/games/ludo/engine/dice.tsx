import { DICE_MAX } from "./constants";
import type { DiceValue, RandomSource } from "./types";

/**
 * Dice generation lives here, never in the UI.
 *
 * Two ways to produce a value:
 *  - `rollFromRng(state)`: the engine's own seeded PRNG (mulberry32). The PRNG state is part of
 *    LudoState, so a game is fully reproducible and a server can be authoritative.
 *  - `rollDice(source)`: for any injected RandomSource (tests, replays, a crypto-backed source…).
 */

export function isDiceValue(value: unknown): value is DiceValue {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= DICE_MAX;
}

/** mulberry32: returns a float in [0, 1) and the next uint32 state. */
export function advanceRng(state: number): { value: number; state: number } {
  const next = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(next ^ (next >>> 15), 1 | next);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next >>> 0 };
}

export function diceFromUnit(unit: number): DiceValue {
  const face = Math.min(DICE_MAX - 1, Math.max(0, Math.floor(unit * DICE_MAX))) + 1;
  return face as DiceValue;
}

export function rollFromRng(state: number): { value: DiceValue; state: number } {
  const step = advanceRng(state);
  return { value: diceFromUnit(step.value), state: step.state };
}

export function rollDice(source: RandomSource): DiceValue {
  return diceFromUnit(source.next());
}

/** Turns any RandomSource into a uint32 seed. */
export function seedFromSource(source: RandomSource): number {
  return Math.floor(source.next() * 4294967296) >>> 0;
}

/** A RandomSource backed by the same PRNG (handy in tests and bot simulations). */
export function createSeededSource(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next(): number {
      const step = advanceRng(state);
      state = step.state;
      return step.value;
    },
  };
}

/** A RandomSource that yields the given dice faces in order (looping). For tests / replays. */
export function createScriptedSource(values: readonly DiceValue[]): RandomSource {
  let i = 0;
  return {
    next(): number {
      const v = values[i % values.length];
      i += 1;
      return (v - 1) / DICE_MAX + 0.001;
    },
  };
}