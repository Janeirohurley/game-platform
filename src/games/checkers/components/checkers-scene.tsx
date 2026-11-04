"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { BOARD_SIZE, colOf, isPlayable, rowOf } from "../engine/board";
import type { Board, Color, Piece } from "../engine/types";

export interface CheckersSceneProps {
  board: Board;
  orientation: Color;
  from: number | null;
  pending: readonly number[];
  targets: ReadonlySet<number>;
  movableFrom: ReadonlySet<number>;
  rejected: number | null;
  lastMove: readonly number[];
  disabled: boolean;
  onSelect: (square: number) => void;
}

const SQUARE_SIZE = 0.94;
const BOARD_SPAN = BOARD_SIZE * SQUARE_SIZE;
const FRAME_WIDTH = 0.4;
/** Fin liseré clair qui court entre les cases et le cadre sombre. */
const INLAY_WIDTH = 0.05;
/** The bottom cylinder meets the top surface of a square at this height. */
const PIECE_REST_HEIGHT = 0.06;
/** Épaisseur d'un pion : un roi en empile deux. */
const PIECE_LAYER = 0.19;

/** Dessus de la table et sol : repères communs à tout le décor. */
const TABLE_TOP_Y = -0.55;
const FLOOR_TOP_Y = -2.1;

/** La table est centrée sur x = 0 comme le damier ; seul son milieu en z est décalé vers la caméra. */
const TABLE_WIDTH = 15;
const TABLE_DEPTH = 9.4;
const TABLE_CENTER_Z = 0.3;
const TABLE_THICKNESS = 0.2;

/** Map the wire-format square to the player's visible side of the board. */
function squarePosition(square: number, orientation: Color): [number, number] {
  const row = rowOf(square);
  const col = colOf(square);
  const visibleRow = orientation === "white" ? row : BOARD_SIZE - 1 - row;
  const visibleCol = orientation === "white" ? col : BOARD_SIZE - 1 - col;

  return [
    (visibleCol - (BOARD_SIZE - 1) / 2) * SQUARE_SIZE,
    (visibleRow - (BOARD_SIZE - 1) / 2) * SQUARE_SIZE,
  ];
}

/**
 * Générateur pseudo-aléatoire déterministe (mulberry32). Le décor ne doit
 * jamais utiliser `Math.random()` au rendu : les livres, les veines du bois
 * et les lumières de la fenêtre changeraient à chaque re-render de React.
 */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/*  Textures procédurales                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Aucune image n'est chargée : chaque matière est dessinée une fois sur un
 * canvas 2D puis envoyée au GPU. Pas de requête réseau, pas de fichier à
 * versionner, et le rendu reste identique d'une session à l'autre grâce au
 * générateur déterministe.
 */
type Painter = (
  ctx: CanvasRenderingContext2D,
  size: number,
  random: () => number,
) => void;

/** Veines de bois : lignes ondulées, claires ou sombres, à faible opacité. */
function makeWoodPainter(
  base: string,
  shade: string,
  light: string,
  vertical = false,
): Painter {
  return (ctx, size, random) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    if (vertical) {
      ctx.translate(size, 0);
      ctx.rotate(Math.PI / 2);
    }

    for (let line = 0; line < 160; line++) {
      const y = random() * size;
      const wobble = 2 + random() * 6;
      const frequency = 0.01 + random() * 0.03;
      const phase = random() * Math.PI * 2;

      ctx.strokeStyle = random() < 0.55 ? shade : light;
      ctx.globalAlpha = 0.05 + random() * 0.16;
      ctx.lineWidth = 0.6 + random() * 2.4;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 8) {
        const yy = y + Math.sin(x * frequency + phase) * wobble;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  };
}

const paintMaple = makeWoodPainter("#e6cb94", "#c9a56a", "#f3e1b4");
const paintWalnut = makeWoodPainter("#6e3f24", "#4a2814", "#8a5232");
const paintFrame = makeWoodPainter("#5a2f17", "#3a1d0e", "#7a4626");
const paintTable = makeWoodPainter("#4a2813", "#2e170a", "#6a3d1f", true);
const paintDarkWood = makeWoodPainter("#3b2216", "#22120b", "#5b351f");

/** Parquet : six rangées de lames de teintes différentes, joints décalés. */
const paintFloor: Painter = (ctx, size, random) => {
  const rows = 6;
  const height = size / rows;

  for (let row = 0; row < rows; row++) {
    const y = row * height;

    ctx.fillStyle = `hsl(${18 + random() * 8}, ${35 + random() * 15}%, ${7 + random() * 6}%)`;
    ctx.fillRect(0, y, size, height);

    ctx.strokeStyle = "rgba(255, 190, 130, 0.09)";
    ctx.lineWidth = 1;
    for (let grain = 0; grain < 14; grain++) {
      const gy = y + random() * height;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(size, gy + (random() - 0.5) * 6);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(4, 2, 1, 0.85)";
    ctx.fillRect(0, y, size, 2);
    ctx.fillRect(random() * size, y, 2, height);
  }
};

/** Tapis d'orient simplifié : bordures dorées, treillis et médaillon central. */
const paintRug: Painter = (ctx, size) => {
  ctx.fillStyle = "#4a1d1b";
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "#b58a4a";
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, size - 28, size - 28);
  ctx.lineWidth = 2;
  ctx.strokeRect(30, 30, size - 60, size - 60);

  ctx.fillStyle = "#5d2420";
  ctx.fillRect(44, 44, size - 88, size - 88);

  ctx.save();
  ctx.beginPath();
  ctx.rect(44, 44, size - 88, size - 88);
  ctx.clip();
  ctx.strokeStyle = "rgba(181, 138, 74, 0.35)";
  ctx.lineWidth = 1.5;
  for (let i = -size; i < size * 2; i += 48) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, size);
    ctx.lineTo(i + size, 0);
    ctx.stroke();
  }
  ctx.restore();

  const center = size / 2;
  const diamond = (radius: number, fill: string, stroke?: string) => {
    ctx.beginPath();
    ctx.moveTo(center, center - radius);
    ctx.lineTo(center + radius, center);
    ctx.lineTo(center, center + radius);
    ctx.lineTo(center - radius, center);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };

  diamond(170, "#2f1513", "#b58a4a");
  diamond(120, "#7a3a2a", "#b58a4a");
  diamond(60, "#2f1513");
  ctx.beginPath();
  ctx.arc(center, center, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#b58a4a";
  ctx.fill();
};

/** Papier peint rayé à damassé discret : il casse l'aplat du mur sans le charger. */
const paintWall: Painter = (ctx, size) => {
  ctx.fillStyle = "#2a1913";
  ctx.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x += 64) {
    ctx.fillStyle = "rgba(255, 220, 180, 0.035)";
    ctx.fillRect(x, 0, 28, size);

    ctx.fillStyle = "rgba(255, 220, 180, 0.06)";
    for (let y = 16; y < size; y += 64) {
      ctx.beginPath();
      ctx.moveTo(x + 46, y - 8);
      ctx.lineTo(x + 54, y);
      ctx.lineTo(x + 46, y + 8);
      ctx.lineTo(x + 38, y);
      ctx.closePath();
      ctx.fill();
    }
  }
};

/** Grain du cuir : piqûre fine et plis souples. `bump` renvoie la carte de relief. */
function makeLeatherPainter(bump: boolean): Painter {
  return (ctx, size, random) => {
    ctx.fillStyle = bump ? "#808080" : "#7b4426";
    ctx.fillRect(0, 0, size, size);

    for (let speck = 0; speck < 9000; speck++) {
      const dark = random() < 0.5;

      ctx.fillStyle = bump
        ? dark
          ? "rgba(0, 0, 0, 0.35)"
          : "rgba(255, 255, 255, 0.25)"
        : dark
          ? "rgba(0, 0, 0, 0.1)"
          : "rgba(255, 200, 150, 0.06)";
      ctx.fillRect(random() * size, random() * size, 1.6, 1.6);
    }

    for (let wrinkle = 0; wrinkle < 40; wrinkle++) {
      const x = random() * size;
      const y = random() * size;

      ctx.strokeStyle = bump ? "rgba(0, 0, 0, 0.45)" : "rgba(0, 0, 0, 0.12)";
      ctx.lineWidth = 1 + random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + (random() - 0.5) * 120,
        y + (random() - 0.5) * 120,
        x + (random() - 0.5) * 200,
        y + (random() - 0.5) * 200,
      );
      ctx.stroke();
    }
  };
}

/** Paysage de crépuscule pour les tableaux accrochés au mur. */
const paintLandscape: Painter = (ctx, size, random) => {
  const sky = ctx.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, "#1f2b44");
  sky.addColorStop(0.6, "#c98b5a");
  sky.addColorStop(1, "#3a2a22");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, size);

  ctx.beginPath();
  ctx.arc(size * 0.72, size * 0.22, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#f3e2b8";
  ctx.fill();

  ["#2b2a3a", "#1d1d28", "#12121a"].forEach((tone, layer) => {
    const phase = random() * 6;

    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(0, size);
    for (let x = 0; x <= size; x += 16) {
      ctx.lineTo(x, size * (0.58 + layer * 0.12) + Math.sin(x * 0.02 + phase) * 28);
    }
    ctx.lineTo(size, size);
    ctx.closePath();
    ctx.fill();
  });
};

function createCanvasTexture(
  paint: Painter,
  seed: number,
  repeatX: number,
  repeatY: number,
): THREE.CanvasTexture | null {
  // Le premier rendu peut avoir lieu côté serveur : pas de `document` là-bas.
  if (typeof document === "undefined") return null;

  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  paint(ctx, size, createRandom(seed));

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

/** Une texture dessinée, libérée du GPU quand le composant disparaît. */
function useCanvasTexture(
  paint: Painter,
  seed: number,
  repeatX: number,
  repeatY: number,
): THREE.CanvasTexture | null {
  const texture = useMemo(
    () => createCanvasTexture(paint, seed, repeatX, repeatY),
    [paint, seed, repeatX, repeatY],
  );

  useEffect(() => () => texture?.dispose(), [texture]);

  return texture;
}

/** Un matériau partagé par plusieurs maillages : une seule texture, un seul programme. */
function useTexturedMaterial(
  paint: Painter,
  seed: number,
  repeatX: number,
  repeatY: number,
  roughness: number,
): THREE.MeshStandardMaterial {
  const texture = useCanvasTexture(paint, seed, repeatX, repeatY);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture ?? undefined,
        roughness,
        metalness: 0.04,
      }),
    [texture, roughness],
  );

  useEffect(() => () => material.dispose(), [material]);

  return material;
}

const paintLeather = makeLeatherPainter(false);
const paintLeatherBump = makeLeatherPainter(true);

/** Cuir : couleur + relief, avec un léger vernis pour accrocher la lumière. */
function useLeatherMaterial(): THREE.MeshPhysicalMaterial {
  const color = useCanvasTexture(paintLeather, 31, 2, 2);
  const bump = useCanvasTexture(paintLeatherBump, 31, 2, 2);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: color ?? undefined,
        bumpMap: bump ?? undefined,
        bumpScale: 0.6,
        roughness: 0.5,
        metalness: 0.03,
        clearcoat: 0.18,
        clearcoatRoughness: 0.5,
      }),
    [color, bump],
  );

  useEffect(() => () => material.dispose(), [material]);

  return material;
}

/**
 * Presentational Three.js scene for the checkers board.
 *
 * It never infers a legal move: the scene only reflects the authoritative
 * board passed by its owner and returns an intent when a square is clicked.
 */
export function CheckersScene({
  board,
  orientation,
  from,
  pending,
  targets,
  movableFrom,
  rejected,
  lastMove,
  disabled,
  onSelect,
}: CheckersSceneProps) {
  const chainHead = pending.length > 0 ? pending[pending.length - 1] : from;
  const lightMap = useCanvasTexture(paintMaple, 3, 1, 1);
  const darkMap = useCanvasTexture(paintWalnut, 4, 1, 1);

  return (
    <>
      <CameraFocus />
      <DrawingRoom />

      <group>
        <BoardFrame />

        {board.map((_piece, square) => {
          const row = rowOf(square);
          const col = colOf(square);
          const dark = isPlayable(row, col);
          const isOrigin = square === from;
          const isChainHead = square === chainHead;
          const isTarget = targets.has(square);
          const isSteppedThrough = pending.includes(square);
          const isMovable = movableFrom.has(square) && from === null;
          const isRejected = square === rejected;
          const inLastMove = lastMove.includes(square);

          return (
            <SquareTile
              key={square}
              square={square}
              orientation={orientation}
              dark={dark}
              map={dark ? darkMap : lightMap}
              isOrigin={isOrigin}
              isChainHead={isChainHead}
              isTarget={isTarget}
              isSteppedThrough={isSteppedThrough}
              isMovable={isMovable}
              isRejected={isRejected}
              inLastMove={inLastMove}
              disabled={disabled}
              onSelect={onSelect}
            />
          );
        })}

        {board.map(
          (piece, square) =>
            piece && (
              <CheckersPiece
                key={square}
                square={square}
                piece={piece}
                orientation={orientation}
                selected={square === from || square === chainHead}
                disabled={disabled}
                onSelect={onSelect}
              />
            ),
        )}
      </group>
    </>
  );
}

interface SquareTileProps {
  square: number;
  orientation: Color;
  dark: boolean;
  map: THREE.Texture | null;
  isOrigin: boolean;
  isChainHead: boolean;
  isTarget: boolean;
  isSteppedThrough: boolean;
  isMovable: boolean;
  isRejected: boolean;
  inLastMove: boolean;
  disabled: boolean;
  onSelect: (square: number) => void;
}

function SquareTile({
  square,
  orientation,
  dark,
  map,
  isOrigin,
  isChainHead,
  isTarget,
  isSteppedThrough,
  isMovable,
  isRejected,
  inLastMove,
  disabled,
  onSelect,
}: SquareTileProps) {
  const [x, z] = squarePosition(square, orientation);
  const clickable = !disabled && dark;

  return (
    <group position={[x, 0, z]}>
      <mesh
        castShadow
        receiveShadow
        onClick={clickable ? () => onSelect(square) : undefined}
      >
        <boxGeometry args={[SQUARE_SIZE, 0.12, SQUARE_SIZE]} />
        {/* Érable clair contre noyer, verni : le contraste de l'image de référence. */}
        <meshPhysicalMaterial
          map={map ?? undefined}
          roughness={dark ? 0.5 : 0.44}
          metalness={0.03}
          clearcoat={0.28}
          clearcoatRoughness={0.35}
        />
      </mesh>

      {inLastMove && (
        <mesh position={[0, 0.064, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[SQUARE_SIZE * 0.88, SQUARE_SIZE * 0.88]} />
          <meshBasicMaterial color="#f6cb73" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}

      {(isOrigin || isChainHead || isMovable || isSteppedThrough || isRejected) && (
        <mesh position={[0, 0.068, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.26, 0.39, 36]} />
          <meshBasicMaterial
            color={
              isRejected
                ? "#ef4444"
                : isSteppedThrough
                  ? "#4ade80"
                  : isOrigin || isChainHead
                    ? "#f7d47b"
                    : "#7dd3fc"
            }
            transparent
            opacity={isMovable && !isOrigin ? 0.42 : 0.88}
            depthWrite={false}
          />
        </mesh>
      )}

      {isTarget && (
        <mesh position={[0, 0.075, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.1, 0.19, 28]} />
          <meshBasicMaterial color="#f7d47b" transparent opacity={0.96} depthWrite={false} />
        </mesh>
      )}

    </group>
  );
}

/** Couronne dorée posée sur le dessus d'un roi. */
function Crown({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.025, 10, 32]} />
        <meshStandardMaterial color="#f0c24f" metalness={0.85} roughness={0.25} />
      </mesh>
      {Array.from({ length: 5 }, (_, index) => {
        const angle = (index / 5) * Math.PI * 2;

        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.14, 0.085, Math.sin(angle) * 0.14]}
          >
            <coneGeometry args={[0.032, 0.1, 8]} />
            <meshStandardMaterial color="#f0c24f" metalness={0.85} roughness={0.25} />
          </mesh>
        );
      })}
    </group>
  );
}

interface PieceMeshProps {
  light: boolean;
  king: boolean;
}

/** Le pion lui-même, sans position ni interaction. */
function PieceMesh({ light, king }: PieceMeshProps) {
  const layers = king ? 2 : 1;
  const topY = layers * PIECE_LAYER;
  const groove = light ? "#b8975a" : "#0b0605";

  return (
    <>
      {Array.from({ length: layers }, (_, index) => (
        <mesh
          key={index}
          position={[0, PIECE_LAYER * index + PIECE_LAYER / 2, 0]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.35, 0.38, PIECE_LAYER, 48]} />
          <meshPhysicalMaterial
            color={light ? "#ecd9a8" : "#201511"}
            roughness={light ? 0.34 : 0.26}
            metalness={light ? 0.08 : 0.2}
            clearcoat={0.3}
            clearcoatRoughness={0.28}
          />
        </mesh>
      ))}

      <mesh position={[0, topY + 0.01, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.31, 0.055, 48]} />
        <meshStandardMaterial
          color={light ? "#f4e4b8" : "#33201a"}
          roughness={0.32}
          metalness={0.12}
        />
      </mesh>

      {/* Deux sillons concentriques, comme les pions tournés de l'image. */}
      {[0.22, 0.14].map((radius) => (
        <mesh
          key={radius}
          position={[0, topY + 0.0385, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[radius, 0.011, 8, 48]} />
          <meshStandardMaterial color={groove} roughness={0.5} />
        </mesh>
      ))}

      {king && <Crown y={topY + 0.04} />}
    </>
  );
}

interface CheckersPieceProps {
  square: number;
  piece: Piece;
  orientation: Color;
  selected: boolean;
  disabled: boolean;
  onSelect: (square: number) => void;
}

function CheckersPiece({
  square,
  piece,
  orientation,
  selected,
  disabled,
  onSelect,
}: CheckersPieceProps) {
  const group = useRef<THREE.Group>(null);
  const [x, z] = squarePosition(square, orientation);

  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;

    // Le relief vient de la scene elle-meme : aucune animation DOM ne pilote le pion.
    node.position.y = THREE.MathUtils.damp(
      node.position.y,
      PIECE_REST_HEIGHT + (selected ? 0.16 : 0),
      18,
      delta,
    );
  });

  return (
    <group
      ref={group}
      position={[x, PIECE_REST_HEIGHT, z]}
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onSelect(square);
      }}
    >
      <PieceMesh light={piece.color === "white"} king={piece.kind === "king"} />
    </group>
  );
}

function BoardFrame() {
  const inner = BOARD_SPAN + INLAY_WIDTH * 2;
  const outerSize = inner + FRAME_WIDTH * 2;
  const railOffset = inner / 2 + FRAME_WIDTH / 2;
  const inlayOffset = BOARD_SPAN / 2 + INLAY_WIDTH / 2;
  const frame = useTexturedMaterial(paintFrame, 8, 1, 1, 0.42);
  const body = useTexturedMaterial(paintDarkWood, 9, 2, 2, 0.5);

  return (
    <>
      {/* Le socle touche exactement le plateau de la table : -0.29 - 0.52 / 2 = TABLE_TOP_Y. */}
      <mesh position={[0, -0.29, 0]} castShadow receiveShadow material={body}>
        <boxGeometry args={[outerSize + 0.36, 0.52, outerSize + 0.36]} />
      </mesh>

      {/* Liseré clair : il détache le damier du cadre, comme sur la photo. */}
      {[-1, 1].map((side) => (
        <mesh key={`inlay-h-${side}`} position={[0, 0, side * inlayOffset]}>
          <boxGeometry args={[inner, 0.12, INLAY_WIDTH]} />
          <meshStandardMaterial color="#efd9a6" roughness={0.45} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`inlay-v-${side}`} position={[side * inlayOffset, 0, 0]}>
          <boxGeometry args={[INLAY_WIDTH, 0.12, BOARD_SPAN]} />
          <meshStandardMaterial color="#efd9a6" roughness={0.45} />
        </mesh>
      ))}

      {[-1, 1].map((side) => (
        <mesh
          key={`horizontal-${side}`}
          position={[0, 0.04, side * railOffset]}
          castShadow
          receiveShadow
          material={frame}
        >
          <boxGeometry args={[outerSize, 0.16, FRAME_WIDTH]} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`vertical-${side}`}
          position={[side * railOffset, 0.04, 0]}
          castShadow
          receiveShadow
          material={frame}
        >
          <boxGeometry args={[FRAME_WIDTH, 0.16, inner]} />
        </mesh>
      ))}
    </>
  );
}

/**
 * Un salon de jeu de nuit pluvieux : la lampe suspendue est la seule vraie
 * source chaude, la fenêtre et la cheminée ajoutent chacune une teinte
 * (bleue, orange) qui donne du relief au mur du fond. Le fond reste sombre
 * mais pas noir : un décor trop éteint disparaissait dans le brouillard sur
 * les écrans de portable.
 */
function DrawingRoom() {
  const floor = useTexturedMaterial(paintFloor, 5, 7, 5, 0.78);
  const rug = useTexturedMaterial(paintRug, 6, 1, 1, 0.95);
  const wall = useTexturedMaterial(paintWall, 9, 18, 4, 0.92);
  const table = useTexturedMaterial(paintTable, 4, 3, 2, 0.68);
  const darkWood = useTexturedMaterial(paintDarkWood, 7, 1, 1, 0.62);
  const painting = useTexturedMaterial(paintLandscape, 13, 1, 1, 0.6);
  const leather = useLeatherMaterial();

  return (
    <>
      <color attach="background" args={["#120a07"]} />
      <fog attach="fog" args={["#140b08", 22, 54]} />
      <ambientLight intensity={0.48} color="#ffdcb0" />
      <hemisphereLight args={["#ffe0ac", "#1a1016", 0.55]} />
      {/* La lampe suspendue est la source principale : elle projette l'ombre du damier. */}
      <spotLight
        position={[0, 3.7, -0.5]}
        angle={0.95}
        penumbra={0.6}
        intensity={5.2}
        color="#ffcb80"
        castShadow
        shadow-bias={-0.0002}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
      {/* Lueur froide de la fenêtre et lueur d'appoint depuis la caméra. */}
      <pointLight position={[7, 2.2, -7.2]} intensity={2.2} distance={12} color="#8fb0d0" />
      <pointLight position={[0, 3, 7]} intensity={0.85} distance={16} color="#ffd9a8" />

      <Floor material={floor} />
      <Rug material={rug} />
      <Tabletop material={table} wood={darkWood} />
      <TableProps />

      {/* Deux fauteuils en miroir de part et d'autre du damier (x = ±6.2), tournés vers lui. */}
      <Armchair position={[-6.2, FLOOR_TOP_Y, -6.4]} rotationY={0.7} leather={leather} wood={darkWood} />
      <Armchair position={[6.2, FLOOR_TOP_Y, -6.4]} rotationY={-0.7} leather={leather} wood={darkWood} />
      <SideTable position={[-9.4, FLOOR_TOP_Y, -5.4]} wood={darkWood} />

      <BackWall wall={wall} wood={darkWood} painting={painting} />
      <PendantLamp />
      <Dust />
    </>
  );
}

function Floor({ material }: { material: THREE.Material }) {
  return (
    <mesh position={[0, FLOOR_TOP_Y - 0.1, -3]} receiveShadow material={material}>
      <boxGeometry args={[44, 0.2, 32]} />
    </mesh>
  );
}

function Rug({ material }: { material: THREE.Material }) {
  return (
    <mesh position={[0, FLOOR_TOP_Y + 0.015, -0.3]} receiveShadow material={material}>
      <boxGeometry args={[17, 0.03, 13]} />
    </mesh>
  );
}

/** Vraie table : plateau, tablier et quatre pieds qui descendent jusqu'au sol. */
function Tabletop({
  material,
  wood,
}: {
  material: THREE.Material;
  wood: THREE.Material;
}) {
  const legX = TABLE_WIDTH / 2 - 0.5;
  const legZ = TABLE_DEPTH / 2 - 0.5;
  const legHeight = TABLE_TOP_Y - TABLE_THICKNESS - FLOOR_TOP_Y;

  return (
    <group position={[0, 0, TABLE_CENTER_Z]}>
      <mesh
        position={[0, TABLE_TOP_Y - TABLE_THICKNESS / 2, 0]}
        castShadow
        receiveShadow
        material={material}
      >
        <boxGeometry args={[TABLE_WIDTH, TABLE_THICKNESS, TABLE_DEPTH]} />
      </mesh>

      {/* Tablier sous le plateau : il relie les pieds et donne de l'épaisseur au bord. */}
      <mesh
        position={[0, TABLE_TOP_Y - TABLE_THICKNESS - 0.2, 0]}
        castShadow
        material={wood}
      >
        <boxGeometry args={[TABLE_WIDTH - 1.2, 0.4, TABLE_DEPTH - 1.2]} />
      </mesh>

      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}-${sz}`}
            position={[sx * legX, FLOOR_TOP_Y + legHeight / 2, sz * legZ]}
            castShadow
            receiveShadow
            material={wood}
          >
            <boxGeometry args={[0.5, legHeight, 0.5]} />
          </mesh>
        )),
      )}

      {/* Les joints entre planches : ils donnent l'allure rustique de la table. */}
      {Array.from({ length: 8 }, (_, index) => -6.3 + index * 1.8).map((x) => (
        <mesh key={x} position={[x, TABLE_TOP_Y + 0.006, 0]}>
          <boxGeometry args={[0.035, 0.014, TABLE_DEPTH - 0.3]} />
          <meshStandardMaterial color="#2c170b" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Ce qui traîne sur la table autour du damier : sous-main, crayon, sablier, verre. */
function TableProps() {
  return (
    <group>
      <group position={[5.2, TABLE_TOP_Y, 2.6]} rotation={[0, -0.08, 0]}>
        <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 0.05, 1.6]} />
          <meshStandardMaterial color="#5a2f1c" roughness={0.6} />
        </mesh>
        <group position={[0.2, 0.09, 0.15]} rotation={[0, 0.3, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 2, 8]} />
            <meshStandardMaterial color="#d9a441" roughness={0.5} />
          </mesh>
          <mesh position={[-1.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.035, 0.12, 8]} />
            <meshStandardMaterial color="#e5c79a" roughness={0.6} />
          </mesh>
        </group>
      </group>

      <Hourglass position={[6.2, TABLE_TOP_Y, -3]} />
      <Tumbler position={[-5.2, TABLE_TOP_Y, 0.8]} />
    </group>
  );
}

function Hourglass({ position }: { position: [number, number, number] }) {
  const brass = { color: "#b88a3a", metalness: 0.8, roughness: 0.35 } as const;

  return (
    <group position={position}>
      {[0.03, 1.03].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.06, 32]} />
          <meshStandardMaterial {...brass} />
        </mesh>
      ))}
      {[0, 1, 2].map((index) => {
        const angle = (index / 3) * Math.PI * 2;

        return (
          <mesh
            key={index}
            position={[Math.cos(angle) * 0.3, 0.53, Math.sin(angle) * 0.3]}
            castShadow
          >
            <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
            <meshStandardMaterial {...brass} />
          </mesh>
        );
      })}

      {/* Deux cônes de verre ; le sable est un simple solide opaque. */}
      <mesh position={[0, 0.78, 0]}>
        <cylinderGeometry args={[0.26, 0.03, 0.45, 24, 1, true]} />
        <meshPhysicalMaterial
          color="#cfe0ea"
          transparent
          opacity={0.22}
          roughness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.03, 0.26, 0.45, 24, 1, true]} />
        <meshPhysicalMaterial
          color="#cfe0ea"
          transparent
          opacity={0.22}
          roughness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <coneGeometry args={[0.2, 0.2, 24]} />
        <meshStandardMaterial color="#e8c887" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.12, 0.03, 0.18, 16]} />
        <meshStandardMaterial color="#e8c887" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Verre de whisky : le détail qui fait de la table un vrai coin de jeu. */
function Tumbler({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.04, 24]} />
        <meshPhysicalMaterial color="#dfeaf0" transparent opacity={0.5} roughness={0.05} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.17, 0.15, 0.36, 24, 1, true]} />
        <meshPhysicalMaterial
          color="#dfeaf0"
          transparent
          opacity={0.22}
          roughness={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.145, 0.135, 0.18, 24]} />
        <meshStandardMaterial
          color="#c8742a"
          emissive="#8a3f10"
          emissiveIntensity={0.35}
          transparent
          opacity={0.88}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
}

interface ArmchairProps {
  position: [number, number, number];
  rotationY: number;
  leather: THREE.Material;
  wood: THREE.Material;
}

/**
 * Fauteuil club capitonné : dossier à boutons, accoudoirs roulés cerclés de
 * laiton, rangée de clous tapissiers et pieds tournés. Il regarde vers +z
 * dans son repère local ; `rotationY` le tourne vers la table.
 */
function Armchair({ position, rotationY, leather, wood }: ArmchairProps) {
  const brass = { color: "#c79a45", metalness: 0.85, roughness: 0.3 } as const;
  // Boutons du capitonnage : deux rangées décalées pour former des losanges.
  const buttons: ReadonlyArray<readonly [number, number]> = [
    [-0.7, -0.45],
    [0, -0.45],
    [0.7, -0.45],
    [-0.35, 0],
    [0.35, 0],
    [-0.7, 0.45],
    [0, 0.45],
    [0.7, 0.45],
    [-0.35, 0.9],
    [0.35, 0.9],
  ];

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={1.15}>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}-${sz}`}
            position={[sx * 1.05, 0.17, sz * 0.95]}
            castShadow
            material={wood}
          >
            <cylinderGeometry args={[0.1, 0.06, 0.34, 14]} />
          </mesh>
        )),
      )}

      <RoundedBox
        args={[2.4, 0.45, 2.15]}
        radius={0.1}
        smoothness={3}
        position={[0, 0.55, 0]}
        material={leather}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[1.95, 0.4, 1.8]}
        radius={0.16}
        smoothness={4}
        position={[0, 0.98, 0.14]}
        material={leather}
        castShadow
        receiveShadow
      />

      {/* Dossier légèrement incliné ; les boutons suivent la même inclinaison. */}
      <group position={[0, 1.7, -0.95]} rotation={[-0.14, 0, 0]}>
        <RoundedBox
          args={[2.5, 1.75, 0.65]}
          radius={0.28}
          smoothness={4}
          material={leather}
          castShadow
          receiveShadow
        />
        {[-0.42, 0.42].map((x) => (
          <mesh key={x} position={[x, 0.05, 0.325]}>
            <boxGeometry args={[0.02, 1.4, 0.03]} />
            <meshStandardMaterial color="#2a1408" roughness={0.9} />
          </mesh>
        ))}
        {buttons.map(([x, y]) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0.335]}>
            <sphereGeometry args={[0.05, 12, 8]} />
            <meshStandardMaterial {...brass} />
          </mesh>
        ))}
      </group>

      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.25, 0, 0]}>
          <RoundedBox
            args={[0.5, 0.95, 2.1]}
            radius={0.12}
            smoothness={3}
            position={[0, 0.95, 0]}
            material={leather}
            castShadow
            receiveShadow
          />
          {/* Accoudoir roulé : un cylindre couché, cerclé de laiton à l'avant. */}
          <mesh
            position={[0, 1.5, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            material={leather}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.3, 0.3, 2.15, 24]} />
          </mesh>
          <mesh position={[0, 1.5, 1.09]}>
            <torusGeometry args={[0.24, 0.02, 8, 32]} />
            <meshStandardMaterial {...brass} />
          </mesh>
        </group>
      ))}

      {/* Clous tapissiers le long du bas de la caisse. */}
      {Array.from({ length: 9 }, (_, index) => -1.0 + index * 0.25).map((x) => (
        <mesh key={x} position={[x, 0.52, 1.08]}>
          <sphereGeometry args={[0.032, 8, 6]} />
          <meshStandardMaterial {...brass} />
        </mesh>
      ))}
    </group>
  );
}

/** Table d'appoint ronde avec lampe, livres : elle réchauffe le coin du fauteuil. */
function SideTable({
  position,
  wood,
}: {
  position: [number, number, number];
  wood: THREE.Material;
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.03, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.4, 0.45, 0.06, 28]} />
      </mesh>
      <mesh position={[0, 0.48, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.9, 16]} />
      </mesh>
      <mesh position={[0, 0.95, 0]} material={wood} castShadow receiveShadow>
        <cylinderGeometry args={[0.62, 0.62, 0.06, 36]} />
      </mesh>

      <mesh position={[-0.25, 1.02, 0.1]} rotation={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.36, 0.08, 0.26]} />
        <meshStandardMaterial color="#5a2a22" roughness={0.8} />
      </mesh>

      <group position={[0.12, 0.98, -0.05]}>
        <mesh position={[0, 0.12, 0]} castShadow>
          <sphereGeometry args={[0.13, 16, 12]} />
          <meshStandardMaterial color="#b88a3a" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
          <meshStandardMaterial color="#b88a3a" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.2, 0.32, 0.4, 28, 1, true]} />
          <meshStandardMaterial
            color="#e9c58d"
            emissive="#ffb867"
            emissiveIntensity={1.4}
            side={THREE.DoubleSide}
            roughness={0.9}
          />
        </mesh>
      </group>
    </group>
  );
}

interface BookSpec {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  tilt: number;
  color: string;
}

const BOOK_COLORS = [
  "#4b2114",
  "#70452b",
  "#2c1a14",
  "#87633b",
  "#371a16",
  "#5a2a22",
  "#3b3a2a",
  "#8a5a3a",
];
const PLANK_THICKNESS = 0.1;
const CASE_DEPTH = 0.5;

/** Remplit chaque étagère de livres de tailles et de teintes variées. */
function layoutBooks(
  seed: number,
  width: number,
  rows: number,
  rowGap: number,
): BookSpec[] {
  const random = createRandom(seed);
  const specs: BookSpec[] = [];

  for (let row = 0; row < rows; row++) {
    let x = -width / 2 + 0.2;
    // Une étagère n'est jamais pleine : le vide donne un air habité.
    const limit = -width / 2 + 0.2 + (width - 0.4) * (0.65 + random() * 0.3);

    while (x < limit) {
      const w = 0.12 + random() * 0.14;
      const h = rowGap * (0.55 + random() * 0.3);
      const d = 0.26 + random() * 0.12;
      const leaning = random() < 0.06;

      specs.push({
        x: x + w / 2,
        y: row * rowGap + PLANK_THICKNESS / 2 + h / 2,
        z: 0.06 + d / 2,
        w,
        h,
        d,
        tilt: leaning ? -0.22 : 0,
        color: BOOK_COLORS[Math.floor(random() * BOOK_COLORS.length)],
      });
      x += w + 0.01 + (leaning ? 0.1 : 0);
    }
  }

  return specs;
}

/** Tous les livres d'une bibliothèque en un seul draw call. */
function Books({ layout }: { layout: BookSpec[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    layout.forEach((book, index) => {
      dummy.position.set(book.x, book.y, book.z);
      dummy.rotation.set(0, 0, book.tilt);
      dummy.scale.set(book.w, book.h, book.d);
      dummy.updateMatrix();
      node.setMatrixAt(index, dummy.matrix);
      node.setColorAt(index, color.set(book.color));
    });

    node.instanceMatrix.needsUpdate = true;
    if (node.instanceColor) node.instanceColor.needsUpdate = true;
  }, [layout]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, layout.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.78} />
    </instancedMesh>
  );
}

interface BookcaseProps {
  position: [number, number, number];
  width: number;
  rows: number;
  rowGap: number;
  seed: number;
  wood: THREE.Material;
}

/** L'origine du groupe est le centre du bas de la bibliothèque. */
function Bookcase({ position, width, rows, rowGap, seed, wood }: BookcaseProps) {
  const layout = useMemo(
    () => layoutBooks(seed, width, rows, rowGap),
    [seed, width, rows, rowGap],
  );
  const height = rows * rowGap + PLANK_THICKNESS;

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} receiveShadow>
        <boxGeometry args={[width, height, PLANK_THICKNESS]} />
        <meshStandardMaterial color="#25130d" roughness={0.8} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * (width / 2 - PLANK_THICKNESS / 2), height / 2, CASE_DEPTH / 2]}
          material={wood}
        >
          <boxGeometry args={[PLANK_THICKNESS, height, CASE_DEPTH]} />
        </mesh>
      ))}
      {Array.from({ length: rows + 1 }, (_, row) => (
        <mesh key={row} position={[0, row * rowGap, CASE_DEPTH / 2]} material={wood}>
          <boxGeometry args={[width, PLANK_THICKNESS, CASE_DEPTH]} />
        </mesh>
      ))}
      <Books layout={layout} />
    </group>
  );
}

const WINDOW_WIDTH = 3;
const WINDOW_RADIUS = WINDOW_WIDTH / 2;
const WINDOW_RECT_HEIGHT = 3.4;

/** Rectangle surmonté d'un demi-cercle : le contour d'une fenêtre cintrée. */
function archShape(width: number, rectHeight: number): THREE.Shape {
  const radius = width / 2;
  const shape = new THREE.Shape();

  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.lineTo(radius, rectHeight);
  shape.absarc(0, rectHeight, radius, 0, Math.PI, false);
  shape.lineTo(-radius, 0);

  return shape;
}

/** Hauteur maximale de la vitre à l'abscisse `x` (le cintre réduit le haut). */
function glassTop(x: number): number {
  return (
    WINDOW_RECT_HEIGHT +
    Math.sqrt(Math.max(WINDOW_RADIUS * WINDOW_RADIUS - x * x, 0))
  );
}

/** Traînées de pluie : leur hauteur ne dépend que de l'horloge, jamais d'un état muté. */
function Rain() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const drops = useMemo(() => {
    const random = createRandom(21);

    return Array.from({ length: 70 }, () => {
      const x = (random() * 2 - 1) * (WINDOW_RADIUS - 0.1);

      return {
        x,
        top: glassTop(x) - 0.1,
        phase: random(),
        speed: 1.6 + random() * 1.6,
        length: 0.18 + random() * 0.2,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    const node = mesh.current;
    if (!node) return;

    const dummy = new THREE.Object3D();

    drops.forEach((drop, index) => {
      const travelled = (clock.elapsedTime * drop.speed + drop.phase * drop.top) % drop.top;

      dummy.position.set(drop.x, drop.top - travelled, 0);
      dummy.scale.set(1, drop.length, 1);
      dummy.updateMatrix();
      node.setMatrixAt(index, dummy.matrix);
    });

    node.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, drops.length]}>
      <planeGeometry args={[0.012, 1]} />
      <meshBasicMaterial color="#cfe0f0" transparent opacity={0.4} depthWrite={false} />
    </instancedMesh>
  );
}

function ArchedWindow({ position }: { position: [number, number, number] }) {
  const frameShape = useMemo(() => archShape(WINDOW_WIDTH + 0.5, WINDOW_RECT_HEIGHT), []);
  const glassShape = useMemo(() => archShape(WINDOW_WIDTH, WINDOW_RECT_HEIGHT), []);
  // Les lumières de la ville floue derrière la vitre.
  const cityLights = useMemo(() => {
    const random = createRandom(7);

    return Array.from({ length: 18 }, () => ({
      x: (random() * 2 - 1) * 1.2,
      y: 0.3 + random() * 2.4,
      radius: 0.05 + random() * 0.12,
      opacity: 0.45 + random() * 0.45,
    }));
  }, []);

  return (
    <group position={position}>
      <mesh position={[0, 0, 0]}>
        <shapeGeometry args={[frameShape]} />
        <meshStandardMaterial color="#2a170f" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.1, 0.12]} castShadow>
        <boxGeometry args={[WINDOW_WIDTH + 0.9, 0.18, 0.4]} />
        <meshStandardMaterial color="#33190f" roughness={0.65} />
      </mesh>

      <mesh position={[0, 0, 0.03]}>
        <shapeGeometry args={[glassShape]} />
        <meshStandardMaterial
          color="#5f7894"
          emissive="#6f89a6"
          emissiveIntensity={0.55}
          roughness={0.2}
        />
      </mesh>

      {cityLights.map((light, index) => (
        <mesh key={index} position={[light.x, light.y, 0.04]}>
          <circleGeometry args={[light.radius, 20]} />
          <meshBasicMaterial
            color="#ffbb66"
            transparent
            opacity={light.opacity}
            depthWrite={false}
          />
        </mesh>
      ))}

      <group position={[0, 0, 0.06]}>
        <Rain />
      </group>

      {/* Meneaux : trois montants et trois traverses. */}
      {[-0.75, 0, 0.75].map((x) => {
        const length = glassTop(x);

        return (
          <mesh key={x} position={[x, length / 2, 0.08]}>
            <boxGeometry args={[0.07, length, 0.08]} />
            <meshStandardMaterial color="#1d1715" roughness={0.7} />
          </mesh>
        );
      })}
      {[1.2, 2.4, 3.4].map((y) => (
        <mesh key={y} position={[0, y, 0.08]}>
          <boxGeometry args={[WINDOW_WIDTH, 0.07, 0.08]} />
          <meshStandardMaterial color="#1d1715" roughness={0.7} />
        </mesh>
      ))}

      <mesh position={[-(WINDOW_RADIUS + 0.55), 2.4, 0.25]} castShadow>
        <boxGeometry args={[0.7, 5.2, 0.35]} />
        <meshStandardMaterial color="#2a1d1a" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Fireplace({ position }: { position: [number, number, number] }) {
  const flames = useRef<(THREE.Group | null)[]>([]);
  const glow = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    flames.current.forEach((flame, index) => {
      if (!flame) return;
      flame.scale.set(1, 1 + Math.sin(t * 7 + index * 2.1) * 0.14 + Math.sin(t * 13 + index) * 0.07, 1);
    });

    if (glow.current) {
      glow.current.intensity = 3 + Math.sin(t * 9) * 0.5 + Math.sin(t * 5.3) * 0.3;
    }
  });

  const flameSpecs = [
    { x: -0.5, height: 0.9, color: "#ff7a1a" },
    { x: 0, height: 1.3, color: "#ff9a2a" },
    { x: 0.5, height: 0.8, color: "#ff7a1a" },
  ];

  return (
    <group position={position}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.95, 1.55, 0]} castShadow>
          <boxGeometry args={[0.55, 3.1, 0.8]} />
          <meshStandardMaterial color="#3a2a22" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 3.15, 0.05]} castShadow>
        <boxGeometry args={[4.8, 0.3, 1]} />
        <meshStandardMaterial color="#4a2a18" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.15, -0.25]}>
        <boxGeometry args={[3.4, 2.3, 0.12]} />
        <meshStandardMaterial color="#4a2b1e" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.06, 0.5]} receiveShadow>
        <boxGeometry args={[4.2, 0.12, 1.2]} />
        <meshStandardMaterial color="#3a3330" roughness={0.9} />
      </mesh>

      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 0.28, 0]} rotation={[0, x * 0.5, Math.PI / 2]}>
          <cylinderGeometry args={[0.14, 0.14, 1.5, 12]} />
          <meshStandardMaterial color="#2a160c" roughness={0.9} />
        </mesh>
      ))}

      {flameSpecs.map((flame, index) => (
        <group
          key={flame.x}
          position={[flame.x, 0.3, 0.05]}
          ref={(node) => {
            flames.current[index] = node;
          }}
        >
          <mesh position={[0, flame.height / 2, 0]}>
            <coneGeometry args={[0.32, flame.height, 12]} />
            <meshBasicMaterial color={flame.color} transparent opacity={0.9} toneMapped={false} />
          </mesh>
          <mesh position={[0, flame.height * 0.3, 0.02]}>
            <coneGeometry args={[0.16, flame.height * 0.6, 12]} />
            <meshBasicMaterial color="#ffd36a" toneMapped={false} />
          </mesh>
        </group>
      ))}

      <pointLight ref={glow} position={[0, 1, 1]} intensity={3} distance={11} color="#ff8a3a" />

      <mesh position={[0, 4.4, -0.3]}>
        <boxGeometry args={[2.2, 1.5, 0.1]} />
        <meshStandardMaterial color="#5a3a1c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 4.4, -0.24]}>
        <boxGeometry args={[1.9, 1.2, 0.04]} />
        <meshStandardMaterial color="#1a1816" roughness={0.8} />
      </mesh>
    </group>
  );
}

interface PictureProps {
  position: [number, number, number];
  width: number;
  height: number;
  painting: THREE.Material;
}

/** Tableau à cadre doré : le paysage est partagé, seule la taille change. */
function Picture({ position, width, height, painting }: PictureProps) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[width + 0.24, height + 0.24, 0.08]} />
        <meshStandardMaterial color="#9c7a3c" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.045]} material={painting}>
        <planeGeometry args={[width, height]} />
      </mesh>
    </group>
  );
}

interface BackWallProps {
  wall: THREE.Material;
  wood: THREE.Material;
  painting: THREE.Material;
}

/** Mur du fond : bibliothèques, porte, fenêtre cintrée, cheminée et tableaux. */
function BackWall({ wall, wood, painting }: BackWallProps) {
  return (
    <group>
      <mesh position={[0, 2.4, -8.6]} receiveShadow material={wall}>
        <boxGeometry args={[40, 9, 0.32]} />
      </mesh>

      {/* Plinthe et corniche : elles ferment la pièce en haut et en bas. */}
      <mesh position={[0, FLOOR_TOP_Y + 0.2, -8.38]} material={wood}>
        <boxGeometry args={[40, 0.4, 0.1]} />
      </mesh>
      <mesh position={[0, 6.65, -8.32]} material={wood}>
        <boxGeometry args={[40, 0.35, 0.24]} />
      </mesh>

      <Bookcase
        position={[-8.8, FLOOR_TOP_Y, -8.45]}
        width={5}
        rows={7}
        rowGap={1}
        seed={11}
        wood={wood}
      />

      {/* Porte à deux panneaux. */}
      <group position={[-3.4, FLOOR_TOP_Y + 2.7, -8.36]}>
        <mesh castShadow material={wood}>
          <boxGeometry args={[2.2, 5.4, 0.14]} />
        </mesh>
        {[1.35, -1.2].map((y) => (
          <mesh key={y} position={[0, y, 0.08]} material={wood}>
            <boxGeometry args={[1.5, y > 0 ? 1.9 : 1.7, 0.04]} />
          </mesh>
        ))}
        <mesh position={[0.8, -0.2, 0.12]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color="#b88a3a" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      <Picture position={[-3.4, 4.9, -8.3]} width={1.7} height={1.1} painting={painting} />
      <Picture position={[-1.1, 1.6, -8.3]} width={1.2} height={1.6} painting={painting} />

      {/* Bibliothèque basse avec son meuble à portes. */}
      <group position={[1.9, FLOOR_TOP_Y, -8.2]}>
        <mesh position={[0, 0.725, 0]} castShadow receiveShadow material={wood}>
          <boxGeometry args={[3.6, 1.45, 0.6]} />
        </mesh>
        {[-0.85, 0.85].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.725, 0.32]} material={wood}>
              <boxGeometry args={[1.5, 1.05, 0.05]} />
            </mesh>
            <mesh position={[x > 0 ? x - 0.55 : x + 0.55, 0.725, 0.37]}>
              <sphereGeometry args={[0.05, 12, 10]} />
              <meshStandardMaterial color="#b88a3a" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </group>
      <Bookcase
        position={[1.9, FLOOR_TOP_Y + 1.45, -8.45]}
        width={3.6}
        rows={4}
        rowGap={1.05}
        seed={29}
        wood={wood}
      />
      <Picture position={[1.9, 5.2, -8.3]} width={2.4} height={1.2} painting={painting} />

      <ArchedWindow position={[7, -0.6, -8.4]} />
      <Fireplace position={[12.2, FLOOR_TOP_Y, -8.2]} />
    </group>
  );
}

function PendantLamp() {
  const light = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!light.current) return;
    light.current.intensity = 4.8 + Math.sin(clock.elapsedTime * 1.8) * 0.1;
  });

  return (
    <group position={[0, 3.9, -0.5]}>
      <mesh position={[0, 1.925, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 3.35, 12]} />
        <meshStandardMaterial color="#28150d" metalness={0.48} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.33, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
        <meshStandardMaterial color="#b88a3a" metalness={0.8} roughness={0.35} />
      </mesh>
      {/* Abat-jour conique ouvert : on voit l'ampoule dépasser en dessous. */}
      <mesh>
        <cylinderGeometry args={[0.26, 1.15, 0.55, 48, 1, true]} />
        <meshStandardMaterial
          color="#5b4630"
          metalness={0.55}
          roughness={0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.18, 16]} />
        <meshStandardMaterial color="#b88a3a" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, -0.42, 0]} scale={[1, 1.45, 1]}>
        <sphereGeometry args={[0.17, 24, 18]} />
        <meshStandardMaterial color="#ffe9b8" emissive="#ffbd58" emissiveIntensity={2.6} />
      </mesh>
      <pointLight ref={light} position={[0, -0.45, 0]} intensity={4.8} distance={14} color="#ffbf62" />

      {/* Faisceau lumineux : un cône additif très léger, qui matérialise la poussière en suspension. */}
      <mesh position={[0, -2.4, 0]}>
        <cylinderGeometry args={[0.45, 3.1, 4.2, 40, 1, true]} />
        <meshBasicMaterial
          color="#ffc880"
          transparent
          opacity={0.035}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/** Poussière en suspension dans la lumière : positions recalculées depuis l'horloge. */
function Dust() {
  const geometry = useRef<THREE.BufferGeometry>(null);
  const count = 90;
  const base = useMemo(() => {
    const random = createRandom(77);

    return Float32Array.from({ length: count * 3 }, (_, index) => {
      const axis = index % 3;

      if (axis === 0) return (random() * 2 - 1) * 3;
      if (axis === 1) return random() * 4;
      return (random() * 2 - 1) * 3 - 0.5;
    });
  }, []);
  const initial = useMemo(() => Float32Array.from(base), [base]);

  useFrame(({ clock }) => {
    const attribute = geometry.current?.getAttribute("position");
    if (!attribute) return;

    const t = clock.elapsedTime;

    for (let index = 0; index < count; index++) {
      const drift = ((base[index * 3 + 1] + t * (0.03 + (index % 3) * 0.012)) % 4);

      attribute.setXYZ(
        index,
        base[index * 3] + Math.sin(t * 0.2 + index) * 0.15,
        -0.4 + drift,
        base[index * 3 + 2] + Math.cos(t * 0.17 + index) * 0.15,
      );
    }

    attribute.needsUpdate = true;
  });

  return (
    <points>
      <bufferGeometry ref={geometry}>
        <bufferAttribute attach="attributes-position" args={[initial, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffd9a0"
        size={0.035}
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

/**
 * La camera recule et regarde vers le fond de la piece : le damier occupe le
 * premier plan, le salon remplit le reste du cadre. Sans regard explicite,
 * elle fixerait l'horizon par defaut.
 */
function CameraFocus() {
  const camera = useThree((state) => state.camera);

  useLayoutEffect(() => {
    // x = 0 : la caméra regarde droit vers le centre, le damier n'est plus de biais.
    camera.lookAt(0, 0.3, -1);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}
