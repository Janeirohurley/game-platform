"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type {
  ColorTheme,
  GamePiece,
  GameState,
  LudoColor,
  Player,
} from "../../types/game";
import {
  getPositionCoordinates,
  getTileKey,
  getTrack,
} from "../../utils/positionUtils";
import { destinationOf } from "../../utils/rules";
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
  playerCount,
  offset,
  pieceColor,
  bounce,
  onPieceClick,
  onHover,
}: {
  piece: GamePiece;
  color: LudoColor;
  pieceIndex: number;
  /** Nombre de joueurs de la table : nécessaire pour situer la case. */
  playerCount: number;
  offset: [number, number];
  pieceColor: string;
  /** Hop gently in place to say "this one is yours to pick". */
  bounce: boolean;
  onPieceClick: (piece: GamePiece) => void;
  /** Signale au plateau le survol (souris) pour l'aperçu d'arrivée. */
  onHover?: (hovered: boolean) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Position du centre : 57 (2 à 4 joueurs) ou 83 (plateau hexagonal).
  const finishedPosition = getTrack(playerCount).finishedPosition;

  // Tracks the game `position` value the piece last actually occupied,
  // so we can detect when it changes and build a hop path towards it.
  const prevPositionRef = useRef<number>(piece.position);
  // Queue of 3D coordinates to hop through, in order.
  const stepsRef = useRef<[number, number, number][]>([]);
  const stepIndexRef = useRef(0);
  const stepStartTimeRef = useRef<number | null>(null);
  // Coordinates the piece is currently sitting at (start of the next hop).
  const currentCoordsRef = useRef<[number, number, number]>(
    getPositionCoordinates(piece.position, color, pieceIndex, playerCount),
  );

  // Whenever the piece's logical position changes, build the list of
  // intermediate tiles it needs to hop across to get there.
  useEffect(() => {
    if (piece.position === prevPositionRef.current) return;

    const from = prevPositionRef.current;
    const to = piece.position;
    const steps: [number, number, number][] = [];

    const at = (position: number) =>
      getPositionCoordinates(position, color, pieceIndex, playerCount);

    if (from === -1 || to === -1) {
      // Entering or leaving home: no track to hop along, just move there.
      steps.push(at(to));
    } else if (to === finishedPosition) {
      // Finishing: hop through the remaining path tiles, then the center.
      for (let p = from + 1; p < finishedPosition; p++) {
        steps.push(at(p));
      }
      steps.push(at(finishedPosition));
    } else if (to > from) {
      for (let p = from + 1; p <= to; p++) {
        steps.push(at(p));
      }
    } else {
      // Any other transition (e.g. captured back home) - move directly.
      steps.push(at(to));
    }

    stepsRef.current = steps;
    stepIndexRef.current = 0;
    stepStartTimeRef.current = null;
    prevPositionRef.current = piece.position;
  }, [piece.position, color, pieceIndex, playerCount, finishedPosition]);

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
      onPointerOver={() => {
        document.body.style.cursor = piece.canMove ? "pointer" : "default";
        onHover?.(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
        onHover?.(false);
      }}
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

      {/* Zone tactile élargie, invisible : le pion reste petit à l'écran mais
          devient facile à viser au doigt (le dé utilise déjà le même procédé,
          voir `DiceComponent`). `opacity 0` et non `visible={false}` pour
          rester une cible de raycast. On ne l'ajoute QU'AUX pions jouables :
          un pion inerte ne doit pas intercepter le tap d'un pion jouable
          situé derrière lui dans l'axe de la caméra. */}
      {piece.canMove && (
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 1.1, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// Game pieces positioned based on game state
function GamePieces({
  colors,
  gameState,
  playerCount,
  onPieceClick,
}: {
  colors: ColorTheme;
  gameState: GameState;
  playerCount: number;
  onPieceClick: (piece: GamePiece) => void;
}) {
  // Pion survolé à la souris — sert à dessiner l'aperçu d'arrivée.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (gameState.gamePhase === "setup") {
    return null; // Don't show pieces during setup
  }

  // Build occupancy map for tiles so we can offset pieces sharing the same tile
  // Compute every render to account for potential nested mutations in state
  //
  // La clé est la case GÉOMÉTRIQUE et non la position logique : deux
  // joueurs d'offsets différents peuvent avoir le même index de chemin
  // tout en étant sur deux cases distinctes, et réciproquement deux
  // pions réellement voisins doivent être rapprochement.
  const tileOccupancy = (() => {
    const map = new Map<string, Array<{ piece: GamePiece; playerId: string }>>();
    gameState.players.forEach((player) => {
      player.pieces.forEach((piece) => {
        // La zone d'attente et les pions terminés ont chacun leurs propres
        // emplacements (un secteur du centre par bras) : rien à regrouper.
        const key = getTileKey(piece.position, player.color, playerCount);
        if (key === null) return;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ piece, playerId: player.id });
      });
    });
    return map;
  })();

  // Compute small radial offset for pieces sharing a tile
  const getOffsetForPiece = (
    piece: GamePiece,
    player: Player,
  ): [number, number] => {
    const key = getTileKey(piece.position, player.color, playerCount);
    if (key === null) return [0, 0];

    const group = tileOccupancy.get(key) || [];
    const count = group.length;
    if (count < 2) return [0, 0];

    const index = group.findIndex((g) => g.piece.id === piece.id);
    // Le centre est plus exigu que les cases du circuit : un rayon
    // légèrement plus petit évite que les pions terminés débordent.
    const radius = key === "center" ? 0.35 : 0.3;
    const angle = (index / count) * Math.PI * 2;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  };

  // Aperçu d'arrivée : au survol d'un pion jouable, on dessine un anneau
  // sur la case où il se poserait. Purement indicatif — le moteur (et le
  // serveur) reste seul juge du coup, on lit la même règle que lui.
  const track = getTrack(playerCount);
  const dice = gameState.diceValue;
  let preview: {
    coordinates: [number, number, number];
    color: string;
  } | null = null;

  if (hoveredId !== null && dice !== null) {
    for (const player of gameState.players) {
      const pieceIndex = player.pieces.findIndex(
        (piece) => piece.id === hoveredId,
      );
      if (pieceIndex < 0) continue;
      const piece = player.pieces[pieceIndex];
      if (piece.canMove) {
        const destination = destinationOf(
          { index: pieceIndex, position: piece.position },
          dice,
          track.finishedPosition,
        );
        if (destination !== null) {
          preview = {
            coordinates: getPositionCoordinates(
              destination,
              player.color,
              pieceIndex,
              playerCount,
            ),
            color: colors.players[player.color],
          };
        }
      }
      break;
    }
  }

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
              playerCount={playerCount}
              offset={[dx, dz]}
              pieceColor={pieceColor}
              bounce={piece.canMove}
              onPieceClick={onPieceClick}
              onHover={(hovered) =>
                setHoveredId((current) =>
                  hovered ? piece.id : current === piece.id ? null : current,
                )
              }
            />
          );
        }),
      )}

      {preview && (
        <mesh
          position={[
            preview.coordinates[0],
            preview.coordinates[1] + 0.04,
            preview.coordinates[2],
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.24, 0.36, 32]} />
          <meshBasicMaterial color={preview.color} transparent opacity={0.9} />
        </mesh>
      )}
    </>
  );
}

export default GamePieces;
