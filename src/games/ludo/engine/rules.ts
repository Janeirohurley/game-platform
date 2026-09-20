import { getTokenProgress } from "./movement";
import type { LudoGameConfig, Player, Token } from "./types";

export interface StandingEntry {
    playerId: string;
    /** 1-based. */
    rank: number;
    tokensHome: number;
    /** Sum of token progress (0..228). Used to order players who did not finish. */
    progress: number;
    finished: boolean;
}

/** Next player in seat order that has not finished yet, or null when everybody has finished. */
export function getNextPlayerId(
    players: readonly Player[],
    fromPlayerId: string,
    finishedPlayerIds: readonly string[],
): string | null {
    const start = players.findIndex((p) => p.id === fromPlayerId);
    if (start === -1) return null;
    for (let step = 1; step <= players.length; step++) {
        const candidate = players[(start + step) % players.length];
        if (!finishedPlayerIds.includes(candidate.id)) return candidate.id;
    }
    return null;
}

/** Is the game over, given who has finished so far? */
export function isGameOver(
    config: LudoGameConfig,
    players: readonly Player[],
    finishedPlayerIds: readonly string[],
): boolean {
    if (finishedPlayerIds.length === 0) return false;
    if (config.rules.gameEnd === "first_winner") return true;
    const remaining = players.filter((p) => !finishedPlayerIds.includes(p.id));
    if (remaining.length <= 1) return true;
    if (config.rules.stopWhenHumansFinished) {
        const humans = players.filter((p) => p.type === "human");
        if (humans.every((p) => finishedPlayerIds.includes(p.id))) return true;
    }
    return false;
}

/**
 * Standings: players that finished come first in finishing order, the others are ordered by
 * tokens home, then total progress, then seat (deterministic).
 */
export function computeStandings(
    players: readonly Player[],
    tokens: readonly Token[],
    finishedPlayerIds: readonly string[],
): StandingEntry[] {
    const stats = players.map((p) => {
        const own = tokens.filter((t) => t.playerId === p.id);
        return {
            player: p,
            tokensHome: own.filter((t) => t.status === "home").length,
            progress: own.reduce((sum, t) => sum + getTokenProgress(t), 0),
            finished: finishedPlayerIds.includes(p.id),
        };
    });
    const finished = finishedPlayerIds
        .map((id) => stats.find((s) => s.player.id === id))
        .filter((s): s is (typeof stats)[number] => s !== undefined);
    const rest = stats
        .filter((s) => !s.finished)
        .sort((a, b) => b.tokensHome - a.tokensHome || b.progress - a.progress || a.player.seat - b.player.seat);
    return [...finished, ...rest].map((s, i) => ({
        playerId: s.player.id,
        rank: i + 1,
        tokensHome: s.tokensHome,
        progress: s.progress,
        finished: s.finished,
    }));
}