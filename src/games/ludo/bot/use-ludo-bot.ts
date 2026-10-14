"use client";

// Pilote un siège BOT dans la partie LOCALE.
//
// Le cerveau (`./bot.ts`) ne sait que choisir un coup. Ce hook fait le
// reste : il attend que ce soit le tour du bot, lance le dé, attend le
// résultat, choisit UN coup légal et l'applique — une seule action à la
// fois, jamais pendant une animation.
//
// Il réutilise exactement les actions du jeu (`onRoll` / `onMove`), donc le
// bot passe par les mêmes règles et les mêmes contrôles qu'un humain : le
// jeu revérifie la légalité avant d'appliquer.
//
// Anti-double-action : chaque « point de décision » (lancer, ou coup) a une
// clé dérivée de l'état (`index du joueur`, `turnStartTime`, `dé`). Une clé
// déjà programmée n'est pas reprogrammée. Comme `movePiece` remet toujours
// `diceValue` à null, un tour supplémentaire repasse bien par un lancer.

import { useEffect, useRef } from "react";
import type { GameState, LudoColor } from "../types/game";
import { legalMoves, type RulePiece, type SeatedPlayer } from "../utils/rules";
import { chooseMove } from "./bot";
import type { BotContext, BotDifficulty } from "./types";

/** Délais purement « de présentation » : le temps que le joueur voie l'action. */
const ROLL_DELAY_MS = 700;
const MOVE_DELAY_MS = 600;

export interface LudoBotHandlers {
  /** Le bot n'agit que si la partie est en cours (mode local). */
  enabled: boolean;
  /** Identique au bouton « Lancer le dé » d'un humain. */
  onRoll: () => void;
  /** Joue le pion d'index donné chez le joueur courant (comme un clic). */
  onMove: (pieceIndex: number) => void;
}

function rulePieces(pieces: GameState["players"][number]["pieces"]): RulePiece[] {
  return pieces.map((piece, index) => ({ index, position: piece.position }));
}

/** Construit la vue « règles » de la situation, pour le cerveau. */
function buildContext(state: GameState, color: LudoColor): BotContext {
  const bot = state.players.find((player) => player.color === color);
  const opponents: SeatedPlayer[] = state.players
    .filter((player) => player.color !== color)
    .map((player) => ({ color: player.color, pieces: rulePieces(player.pieces) }));

  return {
    playerCount: state.playerCount,
    color,
    dice: state.diceValue ?? 0,
    pieces: rulePieces(bot?.pieces ?? []),
    opponents,
  };
}

export function useLudoBot(gameState: GameState, handlers: LudoBotHandlers): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledKeyRef = useRef<string | null>(null);
  const stateRef = useRef(gameState);
  const handlersRef = useRef(handlers);

  // Miroirs des dernières valeurs pour les minuteurs, mis à jour APRÈS le
  // rendu (on ne touche pas aux refs pendant le rendu).
  useEffect(() => {
    stateRef.current = gameState;
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    if (!handlers.enabled || gameState.gamePhase !== "playing") {
      clear();
      scheduledKeyRef.current = null;
      return;
    }

    const player = gameState.players[gameState.currentPlayerIndex];
    if (!player?.isBot) {
      // Pas le tour d'un bot : on oublie toute programmation en attente.
      scheduledKeyRef.current = null;
      clear();
      return;
    }

    const dice = gameState.diceValue;
    const key =
      dice === null
        ? `roll:${gameState.currentPlayerIndex}:${gameState.turnStartTime}`
        : `move:${gameState.currentPlayerIndex}:${gameState.turnStartTime}:${dice}`;
    if (scheduledKeyRef.current === key) return;

    clear();
    scheduledKeyRef.current = key;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const latest = stateRef.current;
      const bot = latest.players[latest.currentPlayerIndex];
      if (latest.gamePhase !== "playing" || !bot?.isBot) return;

      if (latest.diceValue === null) {
        handlersRef.current.onRoll();
        return;
      }

      const difficulty: BotDifficulty = bot.botDifficulty ?? "normal";
      const context = buildContext(latest, bot.color);
      const legal = legalMoves(latest.playerCount, bot.color, context.pieces, latest.diceValue);
      const choice = chooseMove(difficulty, legal, context);
      if (choice) handlersRef.current.onMove(choice.move.pieceIndex);
    }, dice === null ? ROLL_DELAY_MS : MOVE_DELAY_MS);

    // Pas de nettoyage ici : le minuteur doit survivre aux re-rendus qui
    // gardent la même clé de décision. Il est annulé plus haut dès que la
    // clé change ou que le tour quitte le bot.
  }, [gameState, handlers]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
}
