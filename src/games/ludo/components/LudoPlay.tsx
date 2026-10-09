"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef, useState, useEffect } from "react";
import type { GamePiece, GameState, Player } from "../types/game";
import { finishedPositionFor } from "../data/boardPositions";
import { getTrack } from "../utils/positionUtils";
import { DEFAULT_PLAYER_COUNT } from "../data/track";
import { BOARD_THEME } from "../data/boardTheme";
import LudoBoard from "./board/LudoBoard";
import LudoArena from "./board/LudoArena";
import CameraController from "./camera/CameraController";
import BlockedMessageNotification from "./camera/BlockedMessageNotification";
import GameUI from "./ui/GameUI";
import PlayerSetup from "./ui/PlayerSetup";
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

  const lastProcessedDiceRoll = useRef<{
    value: number;
    timestamp: number;
  } | null>(null);
//ajout
  // Le parcours dépend de la taille de la table : arrivée à 57 pour 2 à 4
     // joueurs, à 83 pour 5 et 6 joueurs (plateau hexagonal).
  const finishedPosition = finishedPositionFor(gameState.playerCount);

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

  const canPieceMove = (piece: GamePiece, diceValue: number): boolean => {
    // Can't move without dice value
    if (!diceValue) return false;

    // If piece is at home, need 6 to start
    if (piece.position === -1 && diceValue !== 6) return false;

    // If piece is finished, can't move
    if (piece.position === finishedPosition) return false;

    return calculateNewPosition(piece, diceValue) !== null;
  };

  // Aucun paramètre de joueur ici : la position d'arrivée ne dépend que
  // du lancer. Le départ est toujours l'index 0 du chemin, et la
  // longueur du chemin est la même pour tout le monde (57 cases).
  const calculateNewPosition = (
    piece: GamePiece,
    diceValue: number,
  ): number | null => {
    if (piece.position === -1) {
      // Sortie de la zone d'attente : uniquement un 6, et toujours sur
      // la case d'entrée du joueur, qui est l'index 0 de son chemin.
      return diceValue === 6 ? 0 : null;
    }

    if (piece.position === finishedPosition) {
      // Déjà terminé
      return null;
    }

    const newPos = piece.position + diceValue;

    // Le chemin fait 57 cases (0-56) ; la case 57 est le centre, hors
    // chemin. On l'atteint donc par un lancer EXACT depuis la 56e case,
    // sinon le pion reste bloqué sur sa dernière case de colonne maison.
    if (newPos > finishedPosition) return null;
    return newPos;
  };

  const movePiece = (piece: GamePiece, newPosition: number) => {
    playSound("pieceMove");

    setGameState((prevState) => {
  //remplacer
      // const newState = { ...prevState };
  //fin remplacer
      const newState = {
        ...prevState,
        players: prevState.players.map((p) => ({
          ...p,
          pieces: p.pieces.map((pc) => ({ ...pc }))
        })),
      };
      const playerIndex = newState.players.findIndex(
        (p) => p.id === piece.playerId,
      );
      const mover = newState.players[playerIndex];
      const pieceIndex = mover.pieces.findIndex((p) => p.id === piece.id);
      const track = getTrack(newState.playerCount);

      // Les captures ne concernent que l'anneau partagé, et seulement
      // sur une case non sûre.
      //
      // On compare des INDICES D'ANNEAU, pas des positions de chemin :
      // deux joueurs à six sur la table ont chacun un index de chemin
      // différent pour la même case, et une position de chemin n'est
      // comparable à une autre que chez un même joueur. L'ancien code
      // comparait `position` directement, ce qui revenait à dire qu'un
      // joueur ne pouvait être capturé que par son voisin d'anneau.

      //ajout
      let captured = false;
      //fin ajout
      if (newPosition >= 0 && newPosition < track.homeColumnStart) {
        const targetRing = track.ringIndexOf(mover.color, newPosition);
        if (!track.isSafeCell(targetRing)) {
          newState.players.forEach((player, pIndex) => {
            if (pIndex === playerIndex) return;
            player.pieces.forEach((opponentPiece, opIndex) => {
              if (opponentPiece.position < 0) return;
              if (opponentPiece.position >= track.homeColumnStart) return;
              const opponentRing = track.ringIndexOf(
                player.color,
                opponentPiece.position,
              );
              if (opponentRing !== targetRing) return;
              // Capture ! Le pion adverse repart en zone d'attente.
              newState.players[pIndex].pieces[opIndex].position = -1;
              //ajout
              captured = true;
              //fin ajout
              playSound("capture");
              console.log(
                `${mover.name} captured ${player.name}'s piece!`,
              );
            });
          });
        }
      }

      // Move the piece
      newState.players[playerIndex].pieces[pieceIndex].position = newPosition;

      // Check for win condition
      const finishedPieces = newState.players[playerIndex].pieces.filter(
        (p) => p.position === track.finishedPosition,
      ).length;
      if (finishedPieces === 4) {
        newState.winner = newState.players[playerIndex];
        newState.gamePhase = "finished";
        playSound("win");
        return newState;
      }

      // Determine if player gets another turn
      const rolledSix = newState.diceValue === 6;
      const justFinishedPiece = newPosition === track.finishedPosition;

      //if (rolledSix || justFinishedPiece) { à supprimer; remplacer par la ligne en bas
      if (rolledSix || justFinishedPiece || captured){
        // Player gets another turn
        newState.canRollAgain = true;
        newState.diceValue = null;
        newState.turnStartTime = Date.now();
      } else {
        // Next player's turn
        newState.currentPlayerIndex =
          (newState.currentPlayerIndex + 1) % newState.players.length;
        newState.diceValue = null;
        newState.canRollAgain = false;
        newState.turnStartTime = Date.now();
      }

      // Clear piece selection
      newState.players.forEach((player) => {
        player.pieces.forEach((piece) => {
          piece.isSelected = false;
          piece.canMove = false;
        });
      });

      return newState;
    });
  };

  const handleRollDice = () => {
    if (ludoBoardRef.current && !ludoBoardRef.current.isDiceAnimating) {
      playSound("diceRoll");
      ludoBoardRef.current.throwDice();
    }
  };

  const handlePieceClick = (piece: GamePiece) => {
    if (!piece.canMove || !gameState.diceValue) return;

    const newPosition = calculateNewPosition(piece, gameState.diceValue);

    if (newPosition !== null) {
      movePiece(piece, newPosition);
    }
  };

  // Auto-play functionality
  const performAutoPlay = () => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];

    if (!gameState.diceValue) {
      // Auto-roll dice
      console.log(`Auto-playing for ${currentPlayer.name}: rolling dice`);
      handleRollDice();
    } else {
      // Check if player has any moves available
      const moveablePieces = currentPlayer.pieces.filter((p) => p.canMove);
      if (moveablePieces.length > 0) {
        // Auto-move a piece
        // Prioritize: 1) Moving from home, 2) Finishing pieces, 3) First available piece
        const priorityPiece =
          moveablePieces.find((p) => p.position === -1) || // From home
          moveablePieces.find((p) => {
            const newPos = calculateNewPosition(p, gameState.diceValue!);
            return newPos === finishedPosition; // Finishing
          }) ||
          moveablePieces[0]; // First available

        console.log(
          `Auto-playing for ${currentPlayer.name}: moving piece ${priorityPiece.id}`,
        );
        handlePieceClick(priorityPiece);
      } else {
        // No moves available - this should have been handled by handleDiceResult
        // but adding this as a safety net
        console.log(
          `Auto-playing for ${currentPlayer.name}: no moves available, skipping turn`,
        );
        setGameState((prevState) => ({
          ...prevState,
          currentPlayerIndex:
            (prevState.currentPlayerIndex + 1) % prevState.players.length,
          diceValue: null,
          canRollAgain: false,
          turnStartTime: Date.now(),
        }));
      }
    }
  };

  // Handle dice results from the 3D dice component
  const handleDiceResult = (value: number) => {
    // Prevent duplicate calls for the same dice roll
    const now = Date.now();
    if (
      lastProcessedDiceRoll.current &&
      lastProcessedDiceRoll.current.value === value &&
      now - lastProcessedDiceRoll.current.timestamp < 1000
    ) {
      console.log("Skipping duplicate handleDiceResult call");
      return;
    }

    lastProcessedDiceRoll.current = { value, timestamp: now };

    // Debug logging
    console.log(
      `Player ${gameState.players[gameState.currentPlayerIndex]?.name} rolled ${value}`,
    );

    // Update possible moves after dice settles
    setTimeout(() => {
      setGameState((prevState) => {
        const newState = {
          ...prevState,
        };
        const currentPlayer = newState.players[newState.currentPlayerIndex];

        // Mark which pieces can move
        currentPlayer.pieces.forEach((piece) => {
          piece.canMove = canPieceMove(piece, value);
        });

        // Check if any pieces can move
        const canMovePieces = currentPlayer.pieces.some(
          (piece) => piece.canMove,
        );

        if (!canMovePieces) {
          // Check if all pieces are at home (very first scenario)
          const allPiecesAtHome = currentPlayer.pieces.every(
            (piece) => piece.position === -1,
          );
          const isFirstTurnScenario = allPiecesAtHome && value !== 6;

          // Log appropriate message
          if (isFirstTurnScenario) {
            console.log(
              `${currentPlayer.name} didn't roll 6 to start, switching to next player immediately`,
            );
          } else {
            console.log(
              `${currentPlayer.name} has no valid moves, switching to next player`,
            );
          }

          newState.currentPlayerIndex =
            (prevState.currentPlayerIndex + 1) % prevState.players.length;
          newState.diceValue = null; // Reset dice value when switching turns
          newState.canRollAgain = false;
          newState.turnStartTime = Date.now();
          newState.players = prevState.players.map((player) => ({
            ...player,
            pieces: player.pieces.map((piece) => ({
              ...piece,
              canMove: false,
              isSelected: false,
            })),
          }));
          return newState;
        }
        newState.diceValue = value;
        newState.lastRoll = value;
        newState.turnStartTime = Date.now();
        return newState;
      });
    }, 500);
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

      // Handle 1-6 keys for specific dice values (Mac compatible)
      // Use multiple detection methods for better compatibility
      const key = event.key;
      const code = event.code;
      const keyCode = event.keyCode;

      // Method 1: event.key (most reliable for Mac)
      // Method 2: event.code (backup)
      // Method 3: event.keyCode (legacy support)
      if (gameState.gamePhase === "playing") {
        if (
          key === "1" ||
          code === "Digit1" ||
          code === "Numpad1" ||
          keyCode === 49
        ) {
          event.preventDefault();
          console.log("Throwing dice with value 1");
          playSound("diceRoll");
          ludoBoardRef.current?.throwDiceWithValue(1);
          handleDiceResult(1);
        } else if (
          key === "2" ||
          code === "Digit2" ||
          code === "Numpad2" ||
          keyCode === 50
        ) {
          event.preventDefault();
          console.log("Throwing dice with value 2");
          playSound("diceRoll");
          ludoBoardRef.current?.throwDiceWithValue(2);
          handleDiceResult(2);
        } else if (
          key === "3" ||
          code === "Digit3" ||
          code === "Numpad3" ||
          keyCode === 51
        ) {
          event.preventDefault();
          console.log("Throwing dice with value 3");
          playSound("diceRoll");
          ludoBoardRef.current?.throwDiceWithValue(3);
          handleDiceResult(3);
        } else if (
          key === "4" ||
          code === "Digit4" ||
          code === "Numpad4" ||
          keyCode === 52
        ) {
          event.preventDefault();
          console.log("Throwing dice with value 4");
          playSound("diceRoll");
          ludoBoardRef.current?.throwDiceWithValue(4);
          handleDiceResult(4);
        } else if (
          key === "5" ||
          code === "Digit5" ||
          code === "Numpad5" ||
          keyCode === 53
        ) {
          event.preventDefault();
          console.log("Throwing dice with value 5");
          playSound("diceRoll");
          ludoBoardRef.current?.throwDiceWithValue(5);
          handleDiceResult(5);
        } else if (
          key === "6" ||
          code === "Digit6" ||
          code === "Numpad6" ||
          keyCode === 54
        ) {
          event.preventDefault();
          console.log("Throwing dice with value 6");
          playSound("diceRoll");
          ludoBoardRef.current?.throwDiceWithValue(6);
          handleDiceResult(6);
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
  }, [gameState.gamePhase, handleDiceResult]);
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
          onRollDice={handleRollDice}
          onPieceClick={handlePieceClick}
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

      <Canvas camera={{ position: [0, 16, 16], fov: 60 }}>
        {/* Enhanced lighting optimized for container */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 10, 5]} intensity={1.0} />
        <pointLight position={[-10, 10, -10]} intensity={0.4} />

        {/* 3D Arena Background : grille pour la croix, plancher de bois
            pour l'hexagone, comme dans les maquettes. */}
        <LudoArena playerCount={gameState.playerCount} />

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
