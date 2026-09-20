import { assertValidConfig, createPlayers } from "./config";
import {
    BASE_POSITION,
    HOME_POSITION,
    LUDO_STATE_VERSION,
    PLAYER_COLORS,
    TOKENS_PER_PLAYER,
} from "./constants";
import { advanceRng, isDiceValue, rollFromRng } from "./dice";
import { applyMove, computeLegalMoves, isPlayerFinished } from "./movement";
import { computeStandings, getNextPlayerId, isGameOver } from "./rules";
import { getTrackIndex } from "./board";
import type {
    ActionError,
    ActionErrorCode,
    ActionResult,
    CaptureRecord,
    DiceValue,
    ExtraTurnReason,
    LudoAction,
    LudoEvent,
    LudoGameConfig,
    LudoState,
    PassReason,
    Token,
    TurnChangeReason,
} from "./types";

/**
 * The Ludo reducer.
 *
 * `applyAction(state, action)` is a pure function: same state + same action => same result.
 * It never mutates its input, never touches Math.random / Date / DOM, and rejects any action
 * that is not valid for the current state (wrong phase, wrong player, illegal token, …).
 * Dice values come from the PRNG stored in the state (or are injected through the action).
 */

/* ---------------- creation ---------------- */

export function createInitialTokens(playerIds: ReadonlyMap<string, string>): Token[] {
    const tokens: Token[] = [];
    for (const color of PLAYER_COLORS) {
        const playerId = playerIds.get(color);
        if (!playerId) continue;
        for (let index = 0; index < TOKENS_PER_PLAYER; index++) {
            tokens.push({ id: `${color}-${index}`, playerId, color, index, status: "base", position: BASE_POSITION });
        }
    }
    return tokens;
}

/** Creates a new game. Throws LudoConfigError when the configuration is invalid. */
export function createLudoGame(config: LudoGameConfig, seed: number): LudoState {
    assertValidConfig(config);
    const players = createPlayers(config);
    const startColor = config.startingColor ?? PLAYER_COLORS[0];
    const starter = players.find((p) => p.color === startColor) ?? players[0];
    const tokens = createInitialTokens(new Map(players.map((p) => [p.color, p.id])));
    return {
        version: LUDO_STATE_VERSION,
        config: {
            ...config,
            players: config.players.map((p) => ({ ...p })),
            rules: { ...config.rules, safeOffsets: [...config.rules.safeOffsets] },
        },
        phase: "awaiting_roll",
        players,
        tokens,
        currentPlayerId: starter.id,
        dice: { value: null, rolledBy: null, consecutiveSixes: 0, rollCount: 0 },
        legalMoves: [],
        passReason: null,
        winner: null,
        finishedPlayerIds: [],
        ranking: [],
        turn: 1,
        rng: seed >>> 0,
        lastAction: null,
        events: [],
        captureLog: [],
    };
}

/* ---------------- helpers ---------------- */

function reject(state: LudoState, code: ActionErrorCode, message: string): ActionResult {
    const error: ActionError = { code, message };
    return { ok: false, state, error };
}

function accept(state: LudoState, events: LudoEvent[]): ActionResult {
    return { ok: true, state: { ...state, events }, events };
}

function checkTurn(state: LudoState, playerId: string): ActionResult | null {
    if (state.phase === "finished") return reject(state, "GAME_FINISHED", "The game is over.");
    if (playerId !== state.currentPlayerId) return reject(state, "NOT_YOUR_TURN", "It is not this player's turn.");
    return null;
}

/* ---------------- ROLL_DICE ---------------- */

function handleRoll(state: LudoState, action: Extract<LudoAction, { type: "ROLL_DICE" }>): ActionResult {
    const turnError = checkTurn(state, action.playerId);
    if (turnError) return turnError;
    if (state.phase !== "awaiting_roll") {
        return reject(state, "INVALID_PHASE", "The dice cannot be rolled right now.");
    }
    if (action.value !== undefined && !isDiceValue(action.value)) {
        return reject(state, "INVALID_DICE_VALUE", "Dice value must be an integer between 1 and 6.");
    }

    let rng = state.rng;
    let value: DiceValue;
    if (action.value !== undefined) {
        value = action.value;
    } else {
        const roll = rollFromRng(rng);
        value = roll.value;
        rng = roll.state;
    }

    const rules = state.config.rules;
    const sixes = value === 6 ? state.dice.consecutiveSixes + 1 : 0;
    const forfeits = value === 6 && rules.maxConsecutiveSixes > 0 && sixes >= rules.maxConsecutiveSixes;
    const legalMoves = forfeits ? [] : computeLegalMoves(state.tokens, action.playerId, value, rules);

    const events: LudoEvent[] = [{ type: "dice_rolled", playerId: action.playerId, value }];
    let phase: LudoState["phase"] = "awaiting_move";
    let passReason: PassReason | null = null;
    if (legalMoves.length === 0) {
        phase = "awaiting_pass";
        passReason = forfeits ? "three_sixes" : "no_legal_moves";
        events.push({ type: "no_legal_moves", playerId: action.playerId, reason: passReason });
    }

    return accept(
        {
            ...state,
            phase,
            rng,
            legalMoves,
            passReason,
            dice: {
                value,
                rolledBy: action.playerId,
                consecutiveSixes: sixes,
                rollCount: state.dice.rollCount + 1,
            },
            lastAction: { type: "ROLL_DICE", playerId: action.playerId, value },
        },
        events,
    );
}

/* ---------------- MOVE_TOKEN ---------------- */

function handleMove(state: LudoState, action: Extract<LudoAction, { type: "MOVE_TOKEN" }>): ActionResult {
    const turnError = checkTurn(state, action.playerId);
    if (turnError) return turnError;
    if (state.phase !== "awaiting_move" || state.dice.value === null) {
        return reject(state, "INVALID_PHASE", "A token can only be moved after rolling the dice.");
    }
    const token = state.tokens.find((t) => t.id === action.tokenId);
    if (!token) return reject(state, "UNKNOWN_TOKEN", "This token does not exist.");
    if (token.playerId !== action.playerId) return reject(state, "TOKEN_NOT_OWNED", "This token belongs to another player.");

    // Never trust the stored list nor the UI: legality is recomputed from the tokens and the die.
    const rules = state.config.rules;
    const legal = computeLegalMoves(state.tokens, action.playerId, state.dice.value, rules);
    const move = legal.find((m) => m.tokenId === action.tokenId);
    if (!move) return reject(state, "ILLEGAL_MOVE", "This token cannot move with the current roll.");

    const roll = state.dice.value;
    const tokens = applyMove(state.tokens, move);
    const events: LudoEvent[] = [
        { type: "token_moved", playerId: action.playerId, tokenId: move.tokenId, from: move.from, to: move.to, kind: move.kind },
    ];

    let captureLog = state.captureLog;
    if (move.captures.length > 0) {
        events.push({ type: "token_captured", playerId: action.playerId, tokenId: move.tokenId, victimTokenIds: move.captures });
        const trackIndex = getTrackIndex(token.color, move.to) ?? -1;
        const records: CaptureRecord[] = move.captures.map((victimId) => {
            const victim = state.tokens.find((t) => t.id === victimId);
            return {
                turn: state.turn,
                byPlayerId: action.playerId,
                byTokenId: move.tokenId,
                victimPlayerId: victim ? victim.playerId : "",
                victimTokenId: victimId,
                trackIndex,
            };
        });
        captureLog = [...state.captureLog, ...records];
    }
    if (move.to === HOME_POSITION) {
        events.push({ type: "token_finished", playerId: action.playerId, tokenId: move.tokenId });
    }

    let finishedPlayerIds = state.finishedPlayerIds;
    const playerFinished = isPlayerFinished(tokens, action.playerId);
    if (playerFinished) {
        finishedPlayerIds = [...finishedPlayerIds, action.playerId];
        events.push({ type: "player_finished", playerId: action.playerId, rank: finishedPlayerIds.length });
    }

    const base: LudoState = {
        ...state,
        tokens,
        captureLog,
        finishedPlayerIds,
        legalMoves: [],
        passReason: null,
        lastAction: { type: "MOVE_TOKEN", playerId: action.playerId, tokenId: move.tokenId },
    };

    /* game over? */
    if (isGameOver(state.config, state.players, finishedPlayerIds)) {
        return accept(finishGame(base, events), events.concat(gameOverEvent(finishGame(base, events))));
    }

    /* extra turn? (a player who just finished never rolls again) */
    let extra: ExtraTurnReason | null = null;
    if (!playerFinished) {
        if (rules.extraTurnOnSix && roll === 6) extra = "six";
        else if (rules.extraTurnOnCapture && move.captures.length > 0) extra = "capture";
        else if (rules.extraTurnOnHome && move.kind === "finish") extra = "home";
    }
    if (extra) {
        events.push({ type: "extra_turn", playerId: action.playerId, reason: extra });
        return accept({ ...base, phase: "awaiting_roll" }, events);
    }

    return accept(...handOver(base, events, "move_complete"));
}

/* ---------------- PASS_TURN ---------------- */

function handlePass(state: LudoState, action: Extract<LudoAction, { type: "PASS_TURN" }>): ActionResult {
    const turnError = checkTurn(state, action.playerId);
    if (turnError) return turnError;
    const timeout = action.reason === "timeout";
    if (state.phase !== "awaiting_pass" && !timeout) {
        return reject(state, "INVALID_PHASE", "The turn can only be passed when no move is possible.");
    }
    const reason: TurnChangeReason = state.phase === "awaiting_pass" && state.passReason ? state.passReason : "timeout";
    const base: LudoState = {
        ...state,
        legalMoves: [],
        lastAction: { type: "PASS_TURN", playerId: action.playerId },
    };
    return accept(...handOver(base, [], reason));
}

/** Passes control to the next unfinished player (or ends the game if nobody is left). */
function handOver(state: LudoState, events: LudoEvent[], reason: TurnChangeReason): [LudoState, LudoEvent[]] {
    const next = getNextPlayerId(state.players, state.currentPlayerId, state.finishedPlayerIds);
    if (next === null) {
        const finished = finishGame(state, events);
        return [finished, events.concat(gameOverEvent(finished))];
    }
    const out = events.concat({ type: "turn_changed", fromPlayerId: state.currentPlayerId, toPlayerId: next, reason });
    return [
        {
            ...state,
            phase: "awaiting_roll",
            currentPlayerId: next,
            passReason: null,
            legalMoves: [],
            turn: state.turn + 1,
            dice: { ...state.dice, consecutiveSixes: 0 },
        },
        out,
    ];
}

/* ---------------- game over ---------------- */

function finishGame(state: LudoState, _events: LudoEvent[]): LudoState {
    const standings = computeStandings(state.players, state.tokens, state.finishedPlayerIds);
    return {
        ...state,
        phase: "finished",
        legalMoves: [],
        passReason: null,
        winner: state.finishedPlayerIds[0] ?? standings[0]?.playerId ?? null,
        ranking: standings.map((s) => s.playerId),
    };
}

function gameOverEvent(state: LudoState): LudoEvent {
    return { type: "game_over", winnerId: state.winner ?? "", ranking: state.ranking };
}

/* ---------------- RESET_GAME ---------------- */

function handleReset(state: LudoState, action: Extract<LudoAction, { type: "RESET_GAME" }>): ActionResult {
    const seed = action.seed ?? advanceRng(state.rng).state;
    const fresh = createLudoGame(state.config, seed);
    return accept({ ...fresh, lastAction: { type: "RESET_GAME", playerId: null } }, [{ type: "game_reset" }]);
}

/* ---------------- public entry points ---------------- */

/**
 * Applies an action. Returns `{ ok: true, state, events }`, or `{ ok: false, state, error }`
 * with the untouched input state when the action is rejected.
 */
export function applyAction(state: LudoState, action: LudoAction): ActionResult {
    switch (action.type) {
        case "ROLL_DICE":
            return handleRoll(state, action);
        case "MOVE_TOKEN":
            return handleMove(state, action);
        case "PASS_TURN":
            return handlePass(state, action);
        case "RESET_GAME":
            return handleReset(state, action);
        default: {
            // Runtime guard for untyped payloads (network, storage).
            const unknownAction: never = action;
            void unknownAction;
            return reject(state, "INVALID_ACTION", "Unknown action.");
        }
    }
}

/** Reducer-shaped wrapper (state, action) => state. Rejected actions return the same state object. */
export function ludoReducer(state: LudoState, action: LudoAction): LudoState {
    return applyAction(state, action).state;
}