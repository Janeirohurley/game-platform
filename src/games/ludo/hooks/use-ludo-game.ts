"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAction,
  createLudoGame,
  getBotAction,
  getCurrentPlayer,
  getMovePath,
  type DiceValue,
  type LudoAction,
  type LudoEvent,
  type LudoGameConfig,
  type LudoState,
} from "../engine";
import { createSeed } from "../utils/seed";
import { clearSavedGame, saveGame } from "../utils/storage";
import { getBotDelay, resolveTiming, type LudoTiming } from "../utils/timing";

export interface UseLudoGameOptions {
  config: LudoGameConfig;
  /** Start from an existing (already validated) state, e.g. a restored save. */
  initialState?: LudoState | null;
  /** Seed for a brand new game. Defaults to a random one (generated here, outside the engine). */
  seed?: number;
  timing?: Partial<LudoTiming>;
  /** Play a human's only legal move automatically (default false: humans always choose). */
  autoMoveSingle?: boolean;
  /** Persist the committed state locally (default true). */
  persist?: boolean;
  onGameOver?: (state: LudoState) => void;
}

export interface UseLudoGameResult {
  /** Committed engine state: what the HUD shows. It only changes once an animation has finished. */
  state: LudoState;
  /** Position currently displayed for each token (differs from `state` only while animating). */
  tokenPositions: Readonly<Record<string, number>>;
  /** Tokens highlighted right now because they are being captured. */
  capturedTokenIds: ReadonlySet<string>;
  /** Locked while an animation runs or a bot is acting: input is ignored. */
  busy: boolean;
  diceRolling: boolean;
  /** Face to display on the die (a cosmetic, deterministic cycle while rolling). */
  diceValue: DiceValue | null;
  /** Token ids the current human can move right now. */
  movableTokenIds: ReadonlySet<string>;
  canRoll: boolean;
  isHumanTurn: boolean;
  /** Last action rejected by the engine (defence in depth: the UI never sends illegal actions). */
  rejection: string | null;
  timing: LudoTiming;
  rollDice: () => void;
  moveToken: (tokenId: string) => void;
  restart: () => void;
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();
const EMPTY_POSITIONS: Readonly<Record<string, number>> = {};
const FACE_CYCLE: readonly DiceValue[] = [1, 4, 2, 6, 3, 5];
const FACE_INTERVAL_MS = 80;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function useLudoGame(options: UseLudoGameOptions): UseLudoGameResult {
  const { config, initialState = null, seed, timing: timingOverrides, autoMoveSingle = false, persist = true } = options;

  const reducedMotion = usePrefersReducedMotion();
  const timing = useMemo(() => resolveTiming(timingOverrides, reducedMotion), [timingOverrides, reducedMotion]);
  const timingRef = useRef(timing);
  timingRef.current = timing;
  const onGameOverRef = useRef(options.onGameOver);
  onGameOverRef.current = options.onGameOver;

  const [state, setState] = useState<LudoState>(() => initialState ?? createLudoGame(config, seed ?? createSeed()));
  const engineRef = useRef<LudoState>(state);
  const [positions, setPositions] = useState<Readonly<Record<string, number>>>(EMPTY_POSITIONS);
  const [captured, setCaptured] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [rolling, setRolling] = useState(false);
  const [faceIndex, setFaceIndex] = useState(0);
  const [rejection, setRejection] = useState<string | null>(null);

  /** Everything asynchronous is registered here so unmount / restart can cancel it. */
  const generationRef = useRef(0);
  const waitersRef = useRef(new Set<{ id: number; resolve: (completed: boolean) => void }>());
  const intervalRef = useRef<number | null>(null);

  const wait = useCallback((ms: number): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (ms <= 0) {
        resolve(true);
        return;
      }
      const waiter = { id: 0, resolve };
      waiter.id = window.setTimeout(() => {
        waitersRef.current.delete(waiter);
        resolve(true);
      }, ms);
      waitersRef.current.add(waiter);
    });
  }, []);

  const stopDiceCycle = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cancelAll = useCallback(() => {
    generationRef.current += 1;
    for (const waiter of waitersRef.current) {
      window.clearTimeout(waiter.id);
      waiter.resolve(false);
    }
    waitersRef.current.clear();
    stopDiceCycle();
  }, [stopDiceCycle]);

  const commit = useCallback((next: LudoState) => {
    engineRef.current = next;
    setState(next);
  }, []);

  /** The single entry point for every action (human, bot, auto-pass). */
  const perform = useCallback(
    async (action: LudoAction): Promise<void> => {
      if (busyRef.current) return;
      const previous = engineRef.current;
      const result = applyAction(previous, action);
      if (!result.ok) {
        setRejection(result.error.message);
        return;
      }
      const next = result.state;
      const events: readonly LudoEvent[] = result.events;
      const generation = generationRef.current;
      const t = timingRef.current;

      busyRef.current = true;
      setBusy(true);
      setRejection(null);

      let completed = true;
      if (action.type === "ROLL_DICE") {
        setRolling(true);
        stopDiceCycle();
        intervalRef.current = window.setInterval(() => setFaceIndex((i) => (i + 1) % FACE_CYCLE.length), FACE_INTERVAL_MS);
        completed = await wait(t.diceRollMs);
        stopDiceCycle();
        if (completed && generation === generationRef.current) {
          setRolling(false);
          commit(next);
          completed = await wait(t.diceRevealMs);
        }
      } else if (action.type === "MOVE_TOKEN") {
        const moved = events.find(
          (e): e is Extract<LudoEvent, { type: "token_moved" }> => e.type === "token_moved",
        );
        const capture = events.find(
          (e): e is Extract<LudoEvent, { type: "token_captured" }> => e.type === "token_captured",
        );
        if (moved) {
          for (const step of getMovePath(moved.from, moved.to)) {
            if (generation !== generationRef.current) break;
            setPositions({ [moved.tokenId]: step });
            completed = await wait(t.stepMs);
            if (!completed) break;
          }
        }
        if (completed && capture) {
          setCaptured(new Set(capture.victimTokenIds));
          completed = await wait(t.captureMs);
          if (completed && moved) {
            const back: Record<string, number> = { [moved.tokenId]: moved.to };
            for (const id of capture.victimTokenIds) back[id] = -1;
            setPositions(back);
            completed = await wait(t.captureMs);
          }
        }
        if (completed && generation === generationRef.current) {
          commit(next);
          setPositions(EMPTY_POSITIONS);
          setCaptured(EMPTY_SET);
          completed = await wait(t.settleMs);
        }
      } else {
        commit(next);
        completed = await wait(t.settleMs);
      }

      if (!completed || generation !== generationRef.current) return;
      busyRef.current = false;
      setBusy(false);
      if (next.phase === "finished") onGameOverRef.current?.(next);
    },
    [commit, stopDiceCycle, wait],
  );

  /** Automation: bots, forfeited turns, optional single-move auto-play. */
  useEffect(() => {
    if (busy || state.phase === "finished") return undefined;
    const current = getCurrentPlayer(state);
    const t = timingRef.current;
    let action: LudoAction | null = null;
    let delay = 0;
    if (state.phase === "awaiting_pass") {
      action = { type: "PASS_TURN", playerId: current.id };
      delay = t.passDelayMs;
    } else if (current.type === "bot") {
      action = getBotAction(state);
      delay = getBotDelay(t, state);
    } else if (autoMoveSingle && state.phase === "awaiting_move" && state.legalMoves.length === 1) {
      action = { type: "MOVE_TOKEN", playerId: current.id, tokenId: state.legalMoves[0].tokenId };
      delay = t.autoMoveDelayMs;
    }
    if (!action) return undefined;
    const chosen = action;
    const id = window.setTimeout(() => void perform(chosen), delay);
    return () => window.clearTimeout(id);
  }, [state, busy, perform, autoMoveSingle]);

  /** Persistence: committed state only, never animation state. */
  useEffect(() => {
    if (!persist) return;
    if (state.phase === "finished") clearSavedGame();
    else saveGame(state);
  }, [state, persist]);

  /** Cleanup. */
  useEffect(() => {
    return () => {
      cancelAll();
      busyRef.current = false;
    };
  }, [cancelAll]);

  /** Public commands. */
  const isHumanTurn = state.phase !== "finished" && getCurrentPlayer(state).type === "human";
  const canRoll = isHumanTurn && !busy && state.phase === "awaiting_roll";

  const movableTokenIds = useMemo<ReadonlySet<string>>(() => {
    if (!isHumanTurn || busy || state.phase !== "awaiting_move") return EMPTY_SET;
    return new Set(state.legalMoves.map((m) => m.tokenId));
  }, [isHumanTurn, busy, state.phase, state.legalMoves]);

  const rollDice = useCallback(() => {
    const s = engineRef.current;
    if (busyRef.current || s.phase !== "awaiting_roll") return;
    const player = getCurrentPlayer(s);
    if (player.type !== "human") return;
    void perform({ type: "ROLL_DICE", playerId: player.id });
  }, [perform]);

  const moveToken = useCallback(
    (tokenId: string) => {
      const s = engineRef.current;
      if (busyRef.current || s.phase !== "awaiting_move") return;
      const player = getCurrentPlayer(s);
      if (player.type !== "human") return;
      if (!s.legalMoves.some((m) => m.tokenId === tokenId)) return;
      void perform({ type: "MOVE_TOKEN", playerId: player.id, tokenId });
    },
    [perform],
  );

  const restart = useCallback(() => {
    cancelAll();
    busyRef.current = false;
    setBusy(false);
    setRolling(false);
    setPositions(EMPTY_POSITIONS);
    setCaptured(EMPTY_SET);
    setRejection(null);
    const result = applyAction(engineRef.current, { type: "RESET_GAME", seed: createSeed() });
    commit(result.state);
  }, [cancelAll, commit]);

  const tokenPositions = useMemo<Readonly<Record<string, number>>>(() => {
    const map: Record<string, number> = {};
    for (const token of state.tokens) map[token.id] = positions[token.id] ?? token.position;
    return map;
  }, [state.tokens, positions]);

  const diceValue: DiceValue | null = rolling ? FACE_CYCLE[faceIndex] : state.dice.value;

  return {
    state,
    tokenPositions,
    capturedTokenIds: captured,
    busy,
    diceRolling: rolling,
    diceValue,
    movableTokenIds,
    canRoll,
    isHumanTurn,
    rejection,
    timing,
    rollDice,
    moveToken,
    restart,
  };
}
