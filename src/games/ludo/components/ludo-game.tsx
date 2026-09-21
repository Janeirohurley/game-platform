"use client";

import { useCallback, useMemo, useState } from "react";
import type { LudoGameConfig, LudoState } from "../engine";
import { LudoSetup } from "./ludo-setup";
import { LudoBoard } from "./ludo-board";
import { LudoDice } from "./ludo-dice";
import { LudoPlayerPanel } from "./ludo-player-panel";
import { LudoGameHeader } from "./ludo-game-header";
import { LudoGameOver } from "./ludo-game-over";
import { useLudoGame } from "../hooks/use-ludo-game";
import { buttonPrimary } from "../utils/ui";
import { LABELS, PLAYER_COLOR_NAMES } from "../utils/labels";
import { PLAYER_PALETTE } from "../utils/colors";

export interface LudoGameProps {
  config: LudoGameConfig;
  /** Start from a saved state, if any. */
  savedState?: LudoState | null;
}

export function LudoGame({ config, savedState = null }: LudoGameProps) {
  const [phase, setPhase] = useState<"setup" | "play">("setup");
  const [currentConfig, setCurrentConfig] = useState<LudoGameConfig | null>(null);

  const start = useCallback((nextConfig: LudoGameConfig) => {
    setCurrentConfig(nextConfig);
    setPhase("play");
  }, []);

  const resume = useCallback((state: LudoState) => {
    setCurrentConfig(state.config);
    setPhase("play");
  }, []);

  const game = useLudoGame({
    config: currentConfig ?? config,
    initialState: savedState,
    onGameOver: () => {},
  });

  const handleTokenSelect = useCallback(
    (tokenId: string) => {
      game.moveToken(tokenId);
    },
    [game],
  );

  const handleTokenHover = useCallback(
    (tokenId: string | null) => {
      // Could highlight hover state if desired
      void tokenId;
    },
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      {phase === "setup" ? (
        <LudoSetup onStart={start} savedGame={savedState} onResume={resume} />
      ) : (
        <>
          <LudoGameHeader state={game.state} />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex-1">
              <LudoBoard
                state={game.state}
                tokenPositions={game.tokenPositions}
                capturedTokenIds={game.capturedTokenIds}
                movableTokenIds={game.movableTokenIds}
                onTokenSelect={handleTokenSelect}
                onTokenHover={handleTokenHover}
              />
            </div>

            <div className="ml-6 w-full max-w-sm flex flex-col gap-4">
              <LudoPlayerPanel
                state={game.state}
                isHumanTurn={game.isHumanTurn}
                canRoll={game.canRoll}
                busy={game.busy}
              />

              <LudoDice value={game.diceValue} rolling={game.diceRolling} canRoll={game.canRoll} onRoll={game.rollDice} />

              {game.state.phase !== "finished" &&
                game.isHumanTurn &&
                game.movableTokenIds.size > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Array.from(game.movableTokenIds).map((tokenId) => {
                      const token = game.state.tokens.find((t) => t.id === tokenId);
                      const color = token?.color ?? "red";
                      const palette = PLAYER_PALETTE[color];
                      return (
                        <button
                          key={tokenId}
                          type="button"
                          className={buttonPrimary}
                          disabled={game.busy}
                          onClick={() => handleTokenSelect(tokenId)}
                          aria-label={`Move ${PLAYER_COLOR_NAMES[color]} token ${token!.index + 1}`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: palette.main }} aria-hidden="true" />
                            {LABELS.chooseToken}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

              {game.rejection && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {game.rejection}
                </p>
              )}

              <button
                type="button"
                className="mt-2 rounded-lg border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                onClick={game.restart}
              >
                {LABELS.restart}
              </button>
            </div>
          </div>

          {game.state.phase === "finished" && (
            <LudoGameOver state={game.state} onRestart={game.restart} />
          )}
        </>
      )}
    </div>
  );
}
