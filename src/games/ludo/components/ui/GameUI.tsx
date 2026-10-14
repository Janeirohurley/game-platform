"use client";

import { useState } from "react";
import type { GameState } from "../../types/game";
import AutoPlayTimer from "./AutoPlayTimer";
import MoveSelector from "./MoveSelector";
import { playSound } from "@/lib/sounds";
import { useSoundMute } from "@/lib/use-sound-mute";
import { getTrack } from "../../utils/positionUtils";
import { themeFor } from "../../data/boardTheme";
import { progressForColor } from "../../utils/progress";
import { BOT_DIFFICULTY_LABELS } from "../../bot/types";

// Interface de partie, pensée mobile d'abord.
//
// Deux zones seulement, pour ne jamais recouvrir le plateau ni se marcher
// dessus :
//   - une barre d'état en HAUT, centrée, entre « Retour » (gauche) et les
//     commandes caméra (droite) : à qui le tour, et la valeur du dé ;
//   - un dock d'action en BAS, centré et atteignable au pouce : sélection du
//     pion, lancer du dé, auto-play et classement repliable.
function GameUI({
  gameState,
  isBotTurn = false,
  onRollDice,
  onAutoPlay,
  onToggleAutoPlay,
  onSelectPiece,
}: {
  gameState: GameState;
  isBotTurn?: boolean;
  onRollDice: () => void;
  onAutoPlay: () => void;
  onToggleAutoPlay: () => void;
  onSelectPiece: (pieceIndex: number) => void;
}) {
  const [rankingOpen, setRankingOpen] = useState(false);
  const { muted, toggleMuted } = useSoundMute();

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  // Même calcul de progression que l'indicateur posé sur le plateau, pour
  // que les deux affichages ne puissent pas diverger.
  const palette = themeFor(getTrack(gameState.playerCount).shape).players;
  const ranking = gameState.players
    .map((player) => ({
      player,
      progress: progressForColor(gameState, player.color),
    }))
    .sort((a, b) => b.progress - a.progress);

  const movableCount =
    currentPlayer?.pieces.filter((piece) => piece.canMove).length ?? 0;
  const canRoll =
    !isBotTurn && (gameState.diceValue === null || gameState.canRollAgain);

  const rollLabel = isBotTurn
    ? "L'IA réfléchit…"
    : gameState.diceValue === null
      ? "Lancer le dé"
      : movableCount > 0
        ? "Choisissez un pion"
        : gameState.canRollAgain
          ? "Rejouer (6 ou arrivée)"
          : "Tour suivant…";

  return (
    <>
      {/* Barre d'état — haut centre. `px-14` réserve la place des deux
          boutons d'angle et évite tout chevauchement sur petit écran. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-24 pt-3">
        <div className="flex min-w-0 items-center gap-2 rounded-full bg-black/55 px-3.5 py-1.5 text-sm text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md">
          <span className="relative flex h-3.5 w-3.5 shrink-0">
            {/* Halo pulsé : au tour d'un humain, la pastille respire. */}
            {!isBotTurn && (
              <span
                className="absolute inset-0 animate-ping rounded-full opacity-70"
                style={{ backgroundColor: palette[currentPlayer.color] }}
              />
            )}
            <span
              className="relative h-3.5 w-3.5 rounded-full ring-2 ring-white/40"
              style={{ backgroundColor: palette[currentPlayer.color] }}
            />
          </span>
          <span className="max-w-[38vw] truncate font-semibold sm:max-w-none">
            {currentPlayer.name}
          </span>
          {isBotTurn && (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              IA · {BOT_DIFFICULTY_LABELS[currentPlayer.botDifficulty ?? "normal"]}
            </span>
          )}
          {gameState.diceValue !== null && (
            <span className="ml-0.5 rounded-md bg-white/15 px-2 py-0.5 font-mono text-xs tabular-nums">
              {gameState.diceValue}
            </span>
          )}
        </div>
      </div>

      {/* Dock d'action — bas, centré. Le padding bas respecte la zone sûre
          des téléphones (encoche / barre gestuelle). */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="pointer-events-auto w-full max-w-md space-y-2.5 rounded-2xl bg-black/60 p-3 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
          {gameState.autoPlayEnabled && gameState.turnStartTime && (
            <AutoPlayTimer
              startTime={gameState.turnStartTime}
              onAutoPlay={onAutoPlay}
              gameState={gameState}
            />
          )}

          {/* Sélection précise du pion : le chemin fiable au doigt. */}
          {!isBotTurn && movableCount > 0 && (
            <MoveSelector gameState={gameState} onSelectPiece={onSelectPiece} />
          )}

          <button
            onClick={() => {
              playSound("buttonClick");
              onRollDice();
            }}
            disabled={!canRoll}
            className={`w-full rounded-xl py-3 text-base font-bold transition-colors ${
              canRoll
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            }`}
          >
            {rollLabel}
          </button>

          {gameState.diceValue !== null && movableCount === 0 && (
            <p className="text-center text-xs text-amber-300">
              Aucun coup possible — la main passe.
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                playSound("buttonClick");
                onToggleAutoPlay();
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                gameState.autoPlayEnabled
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
            >
              Auto-play {gameState.autoPlayEnabled ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => {
                playSound("buttonClick");
                setRankingOpen((open) => !open);
              }}
              className="flex-1 rounded-lg bg-white/10 py-2 text-xs font-semibold transition-colors hover:bg-white/20"
            >
              Classement {rankingOpen ? "▲" : "▼"}
            </button>
            <button
              onClick={toggleMuted}
              aria-pressed={muted}
              aria-label={muted ? "Activer le son" : "Couper le son"}
              title={muted ? "Activer le son" : "Couper le son"}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                muted
                  ? "bg-white/5 text-white/50 hover:bg-white/10"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Son {muted ? "OFF" : "ON"}
            </button>
          </div>

          {/* Classement par progression, replié par défaut pour garder le dock
              compact sur téléphone. */}
          {rankingOpen && (
            <div className="grid gap-1 pt-0.5 text-xs">
              {ranking.map(({ player, progress }, index) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
                    player.id === currentPlayer?.id ? "bg-white/15" : ""
                  }`}
                >
                  <span className="w-4 shrink-0 text-white/50">{index + 1}.</span>
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: palette[player.color] }}
                  />
                  <span className="max-w-[7rem] truncate">{player.name}</span>
                  {player.isBot && (
                    <span className="shrink-0 rounded bg-white/20 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
                      IA
                    </span>
                  )}
                  <div
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progression de ${player.name}`}
                    className="relative ml-auto h-2 w-16 shrink-0 overflow-hidden rounded-full bg-white/20"
                  >
                    <div
                      className="h-full rounded-full duration-300 ease-out"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: palette[player.color],
                      }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right tabular-nums">
                    {progress} %
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Raccourcis clavier, utiles seulement là où un clavier existe :
              masqués au doigt, un pointeur fin n'y a pas accès. */}
          <p className="hidden text-center text-[10px] text-white/45 sm:block">
            Entrée : lancer le dé · 1‑6 : choisir un pion
          </p>
        </div>
      </div>
    </>
  );
}

export default GameUI;
