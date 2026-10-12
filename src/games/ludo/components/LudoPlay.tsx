"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useState, useEffect, useCallback } from "react";
import type { GamePiece, GameState, Player } from "../types/game";
import { getTrack } from "../utils/positionUtils";
import { destinationOf } from "../utils/rules";
import { withMove, withRoll } from "../engine/turns";
import { DEFAULT_PLAYER_COUNT } from "../data/track";
import { BOARD_THEME } from "../data/boardTheme";
import LudoBoard from "./board/LudoBoard";
import LudoScene, { LUDO_CANVAS_PROPS } from "./board/LudoScene";
import CameraController from "./camera/CameraController";
import BlockedMessageNotification from "./camera/BlockedMessageNotification";
import GameUI from "./ui/GameUI";
import PlayerSetup from "./ui/PlayerSetup";
import { useLudoBot } from "../bot/use-ludo-bot";
import { playSound } from "@/lib/sounds";

// Main Play component
export default function LudoPlay() {
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [showBlockedMessage, setShowBlockedMessage] = useState(false);
  const [resetCamera, setResetCamera] = useState(false);
  const [cameraView, setCameraView] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentPlayerIndex: 0,
    diceValue: null,
    gamePhase: "setup",
    winner: null,
    lastRoll: null,
    canRollAgain: false,
    turnStartTime: null,
    autoPlayEnabled: true,
    // Tant que la table n'est pas configurée on dessine un plateau à
    // quatre : c'est la forme par défaut de la partie locale.
    playerCount: DEFAULT_PLAYER_COUNT,
  });

  const ludoBoardRef = useRef<{
    throwDice: () => void;
    throwDiceWithValue: (value?: number) => void;
    isDiceAnimating: boolean;
  }>(null);

  // Un lancer est « en vol » entre le clic et le résultat de l'animation.
  // Tant qu'il l'est, tout nouveau lancer est refusé : c'est ce qui ferme la
  // fenêtre pendant laquelle on pouvait relancer et fausser le tour.
  const rollPendingRef = useRef(false);

  // Tour d'un bot ? Les commandes HUMAINES (lancer, clic de pion) sont
  // alors neutralisées : seul le pilote du bot agit, pour éviter qu'un
  // joueur ne joue « à la place » de l'IA ou ne double les coups.
  const isBotTurn = gameState.players[gameState.currentPlayerIndex]?.isBot ?? false;

  // Game Logic Functions
  const initializeGame = (players: Player[]) => {
    setGameState({
      players,
      currentPlayerIndex: 0,
      diceValue: null,
      gamePhase: "playing",
      winner: null,
      lastRoll: null,
      canRollAgain: false,
      turnStartTime: Date.now(),
      autoPlayEnabled: true,
      // La taille de la table EST le nombre de joueurs : c'est elle qui
      // pilote la géométrie du plateau, les décalages de départ et les
      // colonnes maison.
      playerCount: players.length,
    });
  };

  // Applique un coup par INDEX de pion chez le joueur courant. Le moteur
  // (`engine/turns.ts`) décide du reste : capture, victoire, tour suivant ou
  // tour supplémentaire. Un seul chemin pour l'humain et pour le bot, donc
  // les mêmes règles et les mêmes contrôles.
  const applyMoveIndex = (pieceIndex: number) => {
    playSound("pieceMove");
    setGameState((prev) =>
      withMove(prev, prev.currentPlayerIndex, pieceIndex, Date.now()),
    );
  };

  // Lancer brut du dé : l'action réelle, sans garde d'humain. Le bot l'appelle
  // directement ; l'humain passe par `handleRollDice`, bloqué pendant le tour
  // d'un bot. Un lancer déjà en vol est refusé, donc on ne peut pas relancer
  // pendant l'animation et fausser le tour.
  const beginRoll = useCallback((specificValue?: number) => {
    const board = ludoBoardRef.current;
    if (!board || board.isDiceAnimating) return;
    if (rollPendingRef.current) return;
    rollPendingRef.current = true;
    playSound("diceRoll");
    board.throwDiceWithValue(specificValue);
  }, []);

  const rollDice = useCallback(() => beginRoll(), [beginRoll]);

  const handleRollDice = useCallback(() => {
    if (isBotTurn) return;
    beginRoll();
  }, [isBotTurn, beginRoll]);

  const handlePieceClick = (piece: GamePiece) => {
    if (isBotTurn) return;
    if (!piece.canMove || gameState.diceValue === null) return;
    const pieceIndex = gameState.players[
      gameState.currentPlayerIndex
    ]?.pieces.findIndex((candidate) => candidate.id === piece.id);
    if (pieceIndex === undefined || pieceIndex < 0) return;
    applyMoveIndex(pieceIndex);
  };

  // Coup demandé par le bot (index de pion chez le joueur courant). Passe
  // par le même `applyMoveIndex`, mais sans la garde réservée aux humains.
  const handleBotMove = (pieceIndex: number) => {
    const player = gameState.players[gameState.currentPlayerIndex];
    const piece = player?.pieces[pieceIndex];
    if (!piece?.canMove || gameState.diceValue === null) return;
    applyMoveIndex(pieceIndex);
  };

  // Auto-play (humain inactif). Le tour d'un bot est piloté par
  // `useLudoBot` : l'auto-play ne s'en mêle pas, sinon deux pilotes
  // joueraient le même tour.
  const performAutoPlay = () => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer?.isBot) return;

    if (gameState.diceValue === null) {
      handleRollDice();
      return;
    }

    const moveable = currentPlayer.pieces
      .map((piece, index) => ({ piece, index }))
      .filter((entry) => entry.piece.canMove);

    if (moveable.length === 0) {
      // Le moteur a déjà passé la main quand aucun pion ne bouge : ceci n'est
      // qu'un filet de sécurité pour ne jamais bloquer la table.
      setGameState((prev) => ({
        ...prev,
        currentPlayerIndex:
          (prev.currentPlayerIndex + 1) % prev.players.length,
        diceValue: null,
        canRollAgain: false,
        turnStartTime: Date.now(),
      }));
      return;
    }

    const track = getTrack(gameState.playerCount);
    // Priorité : sortir de base, puis finir, puis le premier jouable.
    const priority =
      moveable.find((entry) => entry.piece.position === -1) ||
      moveable.find(
        (entry) =>
          destinationOf(
            { index: 0, position: entry.piece.position },
            gameState.diceValue!,
            track.finishedPosition,
          ) === track.finishedPosition,
      ) ||
      moveable[0];

    applyMoveIndex(priority.index);
  };

  // Résultat du dé, émis par l'animation du plateau. C'est le SEUL canal
  // d'entrée d'un lancer : un résultat n'est accepté que si un lancer est en
  // vol, donc un même lancer ne peut pas être appliqué deux fois. On applique
  // immédiatement (plus de `setTimeout`) : plus de fenêtre pendant laquelle
  // un résultat retardé s'appliquait au mauvais joueur.
  const handleDiceResult = (value: number) => {
    if (!rollPendingRef.current) return;
    rollPendingRef.current = false;
    setGameState((prev) => withRoll(prev, value, Date.now()));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Debug logging for Mac keyboard issues
      console.log("Key pressed:", {
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
      });

      // Check if dice is currently animating - if so, show blocked message and ignore key presses
      if (ludoBoardRef.current?.isDiceAnimating) {
        setShowBlockedMessage(true);
        setTimeout(() => setShowBlockedMessage(false), 2000);
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        setIsSpacePressed((prev) => !prev); // Toggle instead of just setting to true
      }

      // Handle R key for camera reset
      // if (event.code === 'KeyR') {
      //   event.preventDefault()
      //   console.log('Resetting camera to initial position')
      //   setResetCamera(true)
      //   setCameraView(null)
      //   setTimeout(() => setResetCamera(false), 100) // Reset flag after brief moment
      // }

      // Handle Enter key for random dice throw
      if (event.code === "Enter" || event.code === "NumpadEnter") {
        event.preventDefault();
        if (gameState.gamePhase === "playing") {
          handleRollDice();
        }
      }

      // Touches 1-6 : forcer une valeur précise (débogage / compat Mac). On
      // passe par `beginRoll` UNIQUEMENT : le résultat arrivera par
      // l'animation, comme pour un clic. Appeler `handleDiceResult` ici en
      // plus doublerait le lancer (c'est ce qui faisait rejouer). Neutralisé
      // pendant le tour d'un bot.
      const key = event.key;
      const code = event.code;
      const keyCode = event.keyCode;

      if (gameState.gamePhase === "playing" && !isBotTurn) {
        const forcedValue = [1, 2, 3, 4, 5, 6].find(
          (value) =>
            key === String(value) ||
            code === `Digit${value}` ||
            code === `Numpad${value}` ||
            keyCode === 48 + value,
        );
        if (forcedValue !== undefined) {
          event.preventDefault();
          beginRoll(forcedValue);
        }
      }
    };
//Remplacer
  //   const handleKeyUp = (event: KeyboardEvent) => {
  //     // Space key now works as toggle, no need for keyup handler
  //     // Keeping this function for potential future use
  //   };

  //   window.addEventListener("keydown", handleKeyDown);
  //   window.addEventListener("keyup", handleKeyUp);

  //   return () => {
  //     window.removeEventListener("keydown", handleKeyDown);
  //     window.removeEventListener("keyup", handleKeyUp);
  //   };
  // }, [gameState.gamePhase]);
//fin remplacer
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gameState.gamePhase, isBotTurn, handleRollDice, beginRoll]);

  // Pilote les sièges IA de la partie locale. Ne fait rien s'il n'y a pas
  // de bot assis (voir `use-ludo-bot.ts`).
  useLudoBot(gameState, {
    enabled: gameState.gamePhase === "playing",
    onRoll: rollDice,
    onMove: handleBotMove,
  });

  // Handle camera view changes
  const handleCameraView = (view: string) => {
    playSound("buttonClick");
    console.log(`Switching to ${view} view`);
    setCameraView(view);
    setResetCamera(false);
    setTimeout(() => setCameraView(null), 100); // Reset flag after brief moment
  };

  return (
    <div
      className="w-full h-full overflow-hidden relative"
      style={{ backgroundColor: "#333333" }}
    >
      {/* Player Setup Modal */}
      {gameState.gamePhase === "setup" && (
        <PlayerSetup onGameStart={initializeGame} />
      )}

      {/* Game UI */}
      {gameState.gamePhase === "playing" && (
        <GameUI
          gameState={gameState}
          isBotTurn={isBotTurn}
          onRollDice={handleRollDice}
          onAutoPlay={performAutoPlay}
          onToggleAutoPlay={() =>
            setGameState((prev) => ({
              ...prev,
              autoPlayEnabled: !prev.autoPlayEnabled,
            }))
          }
        />
      )}

      {/* Winner Announcement */}
      {gameState.gamePhase === "finished" && gameState.winner && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 text-center max-w-md">
            <h2 className="text-3xl font-bold mb-4">🎉 Game Over! 🎉</h2>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div
                className="w-8 h-8 rounded-full"
                style={{
                  backgroundColor: BOARD_THEME.players[gameState.winner.color],
                }}
              />
              <span className="text-2xl font-semibold">
                {gameState.winner.name} Wins!
              </span>
            </div>
            <button
              onClick={() => {
                playSound("buttonClick");
                window.location.reload();
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* LUDO_CANVAS_PROPS : ombres, dpr jusqu'à 2x (écrans 4K), MSAA, plan
          proche à 0.5 contre le scintillement. */}
      <Canvas {...LUDO_CANVAS_PROPS}>
        {/* Décor de jeu : table en bois, lumières, ombres, poussière. Il
            remplace les lumières ad hoc et l'ancien LudoArena (grille de
            débogage / planche coupée). */}
        <LudoScene playerCount={gameState.playerCount} />

        {/* Ludo Board */}
        <LudoBoard
          ref={ludoBoardRef}
          gameState={gameState}
          onPieceClick={handlePieceClick}
          onDiceResult={handleDiceResult}
        />

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={!isSpacePressed}
          minDistance={8}
          maxDistance={40}
        />

        {/* Camera controller */}
        <CameraController
          isSpacePressed={isSpacePressed}
          resetCamera={resetCamera}
          cameraView={cameraView}
        />

        {/* Camera-facing blocked message notification */}
        {showBlockedMessage && <BlockedMessageNotification />}
      </Canvas>

      {/* Camera View Controls - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg p-3 text-white">
          <div className="text-xs font-semibold mb-2 text-center">
            Camera Views
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            <button
              onClick={() => handleCameraView("top")}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
              title="Top View"
            >
              Top
            </button>
            <button
              onClick={() => handleCameraView("front")}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
              title="Front View"
            >
              Front
            </button>
            <button
              onClick={() => handleCameraView("left")}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
              title="Left View"
            >
              Left
            </button>
            <button
              onClick={() => handleCameraView("right")}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors"
              title="Right View"
            >
              Right
            </button>
          </div>

          {/* Auto-rotate Toggle */}
          <button
            onClick={() => {
              playSound("buttonClick");
              setIsSpacePressed(!isSpacePressed);
            }}
            className={`w-full mt-1 px-2 py-1 rounded transition-colors text-xs font-semibold ${
              isSpacePressed
                ? "bg-green-500/80 hover:bg-green-500 text-white"
                : "bg-white/20 hover:bg-white/30 text-white"
            }`}
            title="Toggle Auto-rotate (Space key)"
          >
            {isSpacePressed ? "🔄 Auto-rotate ON" : "⏸️ Auto-rotate OFF"}
          </button>
        </div>

        {/* Reset Camera Button */}
        <button
          onClick={() => {
            playSound("buttonClick");
            setResetCamera(true);
            setCameraView(null);
            setIsSpacePressed(false); // Also stop auto-rotate on reset
            setTimeout(() => setResetCamera(false), 100);
          }}
          className="bg-red-500/80 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors backdrop-blur-sm"
          title="Reset Camera (R key)"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
