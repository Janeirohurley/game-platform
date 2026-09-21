export interface LudoTiming {
  diceRollMs: number;
  diceRevealMs: number;
  stepMs: number;
  captureMs: number;
  settleMs: number;
  passDelayMs: number;
  autoMoveDelayMs: number;
  botMoveDelayMs: number;
  botRollDelayMs: number;
}

const DEFAULT_TIMING: LudoTiming = {
  diceRollMs: 900,
  diceRevealMs: 120,
  stepMs: 90,
  captureMs: 280,
  settleMs: 120,
  passDelayMs: 350,
  autoMoveDelayMs: 250,
  botMoveDelayMs: 650,
  botRollDelayMs: 500,
};

export function resolveTiming(
  overrides: Partial<LudoTiming> | undefined,
  reducedMotion: boolean,
): LudoTiming {
  const base = reducedMotion
    ? {
        ...DEFAULT_TIMING,
        diceRollMs: 0,
        stepMs: 0,
        captureMs: 0,
        settleMs: 0,
        passDelayMs: 0,
        autoMoveDelayMs: 0,
        botMoveDelayMs: 0,
        botRollDelayMs: 0,
      }
    : DEFAULT_TIMING;
  return { ...base, ...overrides };
}

export function getBotDelay(
  timing: LudoTiming,
  state: { phase: string; dice: { value: number | null } },
): number {
  if (state.phase === "awaiting_roll") return timing.botRollDelayMs;
  if (state.phase === "awaiting_move" && state.dice.value !== null) return timing.botMoveDelayMs;
  return timing.passDelayMs;
}
