"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { ColorTheme, GamePiece, GameState, Player } from "../../types/game";
import { PLAYER_PATHS } from "../../data/playerPaths";
import { getPositionCoordinates } from "../../utils/positionUtils";
import { playSound } from "@/lib/sounds";

// Duration (in seconds) the piece spends hopping from one tile to the next
const STEP_DURATION = 0.18;
// Height of the little arc the piece makes while hopping between tiles
const HOP_HEIGHT = 0.3;
// Height of the idle hop that marks a piece as pickable
const BOUNCE_HEIGHT = 0.14;

// A single game piece that animates tile-by-tile instead of teleporting
// whenever its game position changes.
function AnimatedGamePiece({
  piece,
  color,
  pieceIndex,
  offset,
  pieceColor,
  bounce,
  onPieceClick,
}: {
  piece: GamePiece;
  color: "yellow" | "green" | "blue" | "red";
  pieceIndex: number;
  offset: [number, number];
  pieceColor: string;
  /** Hop gently in place to say "this one is yours to pick". */
  bounce: boolean;
  onPieceClick: (piece: GamePiece) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Tracks the game `position` value the piece last actually occupied,
  // so we can detect when it changes and build a hop path towards it.
  const prevPositionRef = useRef<number>(piece.position);
  // Queue of 3D coordinates to hop through, in order.
  const stepsRef = useRef<[number, number, number][]>([]);
  const stepIndexRef = useRef(0);
  const stepStartTimeRef = useRef<number | null>(null);
  // Coordinates the piece is currently sitting at (start of the next hop).
  const currentCoordsRef = useRef<[number, number, number]>(
    getPositionCoordinates(piece.position, color, pieceIndex),
  );

  // Whenever the piece's logical position changes, build the list of
  // intermediate tiles it needs to hop across to get there.
  useEffect(() => {
    if (piece.position === prevPositionRef.current) return;

    const from = prevPositionRef.current;
    const to = piece.position;
    const steps: [number, number, number][] = [];

    if (from === -1 || to === -1) {
      // Entering or leaving home: no track to hop along, just move there.
      steps.push(getPositionCoordinates(to, color, pieceIndex));
    } else if (to === 57) {
      // Finishing: hop through the remaining path tiles, then the center.
      for (let p = from + 1; p <= 56; p++) {
        steps.push(getPositionCoordinates(p, color, pieceIndex));
      }
      steps.push(getPositionCoordinates(57, color, pieceIndex));
    } else if (to > from) {
      for (let p = from + 1; p <= to; p++) {
        steps.push(getPositionCoordinates(p, color, pieceIndex));
      }
    } else {
      // Any other transition (e.g. captured back home) - move directly.
      steps.push(getPositionCoordinates(to, color, pieceIndex));
    }

    stepsRef.current = steps;
    stepIndexRef.current = 0;
    stepStartTimeRef.current = null;
    prevPositionRef.current = piece.position;
  }, [piece.position, color, pieceIndex]);

  useFrame((state) => {
    if (!groupRef.current) return;

    const steps = stepsRef.current;
    const [ox, oz] = offset;

    if (stepIndexRef.current < steps.length) {
      if (stepStartTimeRef.current === null) {
        stepStartTimeRef.current = state.clock.elapsedTime;
        // Play the move sound once per tile hop, right as it starts
        playSound("pieceMove");
      }

      const elapsed = state.clock.elapsedTime - stepStartTimeRef.current;
      const t = Math.min(elapsed / STEP_DURATION, 1);

      const from = currentCoordsRef.current;
      const to = steps[stepIndexRef.current];

      const x = from[0] + (to[0] - from[0]) * t;
      const y =
        from[1] + (to[1] - from[1]) * t + Math.sin(Math.PI * t) * HOP_HEIGHT;
      const z = from[2] + (to[2] - from[2]) * t;

      groupRef.current.position.set(x + ox, y, z + oz);

      if (t >= 1) {
        currentCoordsRef.current = to;
        stepIndexRef.current += 1;
        stepStartTimeRef.current = null;
      }
    } else {
      // Idle: keep the piece settled on its current tile (offset may
      // change between renders as other pieces join/leave the tile).
      const [x, y, z] = currentCoordsRef.current;

      // When the roll leaves a real choice, the eligible pieces hop in
      // place so the player can see at a glance which ones are theirs
      // to pick. Phase-shifted per piece so they do not move as a block.
      const lift = bounce
        ? Math.abs(
            Math.sin(state.clock.elapsedTime * 4 + pieceIndex * 0.7),
          ) * BOUNCE_HEIGHT
        : 0;

      groupRef.current.position.set(x + ox, y + lift, z + oz);
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={() => onPieceClick(piece)}
      onPointerOver={() =>
        (document.body.style.cursor = piece.canMove ? "pointer" : "default")
      }
      onPointerOut={() => (document.body.style.cursor = "default")}
    >
      {/* Highlight ring for moveable pieces */}
      {piece.canMove && (
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.02]} />
          <meshStandardMaterial
            color="#00FF00"
            transparent
            opacity={0.6}
            emissive="#00FF00"
            emissiveIntensity={0.2}
          />
        </mesh>
      )}

      {/* Selection ring for selected pieces */}
      {piece.isSelected && (
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.03]} />
          <meshStandardMaterial
            color="#FFFF00"
            transparent
            opacity={0.8}
            emissive="#FFFF00"
            emissiveIntensity={0.3}
          />
        </mesh>
      )}

      {/* Large pawn base */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.3, 0.12]} />
        <meshStandardMaterial color={pieceColor} roughness={0.2} metalness={0.1} />
      </mesh>

      {/* Large pawn body */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.2, 0.23, 0.24]} />
        <meshStandardMaterial color={pieceColor} roughness={0.2} metalness={0.1} />
      </mesh>

      {/* Large pawn neck */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.13, 0.16, 0.12]} />
        <meshStandardMaterial color={pieceColor} roughness={0.2} metalness={0.1} />
      </mesh>

      {/* Large pawn head */}
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.14]} />
        <meshStandardMaterial color={pieceColor} roughness={0.2} metalness={0.1} />
      </mesh>

      {/* Large pawn crown/top */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 0.06]} />
        <meshStandardMaterial color={pieceColor} roughness={0.1} metalness={0.2} />
      </mesh>
    </group>
  );
}

// Game pieces positioned based on game state
function GamePieces({
  colors,
  gameState,
  onPieceClick,
}: {
  colors: ColorTheme;
  gameState: GameState;
  onPieceClick: (piece: GamePiece) => void;
}) {
  if (gameState.gamePhase === "setup") {
    return null; // Don't show pieces during setup
  }

  // Build occupancy map for tiles so we can offset pieces sharing the same tile
  // Compute every render to account for potential nested mutations in state
  const tileOccupancy = (() => {
    const map = new Map<
      string,
      Array<{ piece: GamePiece; playerId: string }>
    >();
    gameState.players.forEach((player) => {
      player.pieces.forEach((piece) => {
        if (piece.position >= 0 && piece.position !== 57) {
          const playerPath = PLAYER_PATHS[
            `${player.color}_path` as keyof typeof PLAYER_PATHS
          ] as number[][];
          const [x, z] = playerPath?.[piece.position] || [0, 0];
          const key = `${x}:${z}`;
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push({ piece, playerId: player.id });
        } else if (piece.position === 57) {
          const key = "center";
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push({ piece, playerId: player.id });
        }
      });
    });
    return map;
  })();

  // Compute small radial offset for pieces sharing a tile
  const getOffsetForPiece = (
    piece: GamePiece,
    player: Player,
  ): [number, number] => {
    // Finished center tile
    if (piece.position === 57) {
      const key = "center";
      const group = tileOccupancy.get(key) || [];
      const index = group.findIndex((g) => g.piece.id === piece.id);
      const count = group.length;
      if (count > 1) {
        const radius = 0.35;
        const angle = (index / count) * Math.PI * 2;
        return [radius * Math.cos(angle), radius * Math.sin(angle)];
      }
      return [0, 0];
    }

    // In-play tiles (non-home, non-finished)
    if (piece.position >= 0) {
      const playerPath = PLAYER_PATHS[
        `${player.color}_path` as keyof typeof PLAYER_PATHS
      ] as number[][];
      const [x, z] = playerPath?.[piece.position] || [0, 0];
      const key = `${x}:${z}`;
      const group = tileOccupancy.get(key) || [];
      const index = group.findIndex((g) => g.piece.id === piece.id);
      const count = group.length;
      if (count > 1) {
        const radius = 0.3;
        const angle = (index / count) * Math.PI * 2;
        return [radius * Math.cos(angle), radius * Math.sin(angle)];
      }
    }

    // Home positions use dedicated slots already
    return [0, 0];
  };

  return (
    <>
      {gameState.players.map((player) =>
        player.pieces.map((piece, pieceIndex) => {
          const [dx, dz] = getOffsetForPiece(piece, player);
          const pieceColor = colors.players[player.color];

          return (
            <AnimatedGamePiece
              key={piece.id}
              piece={piece}
              color={player.color}
              pieceIndex={pieceIndex}
              offset={[dx, dz]}
              pieceColor={pieceColor}
              // Every piece the roll can actually move hops, whatever
              // the number. `canMove` already carries the rule: on a 6
              // that includes the ones still in base, on anything less
              // only those already on the track. It is also set for the
              // viewer's own pieces only, so nobody sees the opponent's
              // options.
              bounce={piece.canMove}
              onPieceClick={onPieceClick}
            />
          );
        }),
      )}
    </>
  );
}

export default GamePieces;
