"use client";

/**
 * PlayingCard — carte à jouer réellement 3D.
 *
 * Ce qui change par rapport à la version plate :
 *  - épaisseur réelle avec tranche arrondie (biseau lissé), sans RoundedBoxGeometry ;
 *  - faces éclairées (MeshPhysicalMaterial) au lieu de plans MeshBasicMaterial « collés » ;
 *  - encre en relief (bump map) et plus mate que le papier, dos métallisé ;
 *  - reflets d'environnement (PMREM) et ombre portée douce sur le sol ;
 *  - inclinaison qui suit le pointeur, flottement doux, retournement en arc ;
 *  - textures au bon ratio (plus d'étirement), vraie disposition des points 2 → 10, J / Q / K ;
 *  - la scène n'est plus reconstruite à chaque rendu parent (onFlip, camera, colorAnimation…).
 *
 * Dépendances : react, three >= 0.152.   npm i three && npm i -D @types/three
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";

/* ====================================================================== */
/*  Types                                                                 */
/* ====================================================================== */

export type CardSuit = "hearts" | "diamonds" | "clubs" | "spades";

export type CardRank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7"
  | "8" | "9" | "10" | "J" | "Q" | "K";

export type CardColorPalette = {
  front?: string;
  back?: string;
  ink?: string;
  /** Teinte du contre-jour. */
  accent?: string;
};

export interface PlayingCardProps {
  className?: string;
  style?: CSSProperties;

  rank?: CardRank;
  suit?: CardSuit;

  width?: number;
  height?: number;
  thickness?: number;

  /** Face visible. Changer la valeur déclenche l'animation de retournement. */
  flipped?: boolean;
  clickable?: boolean;

  /** Rotation continue autour de l'axe vertical, en rad/s (défaut 0). */
  rotateSpeed?: number;
  /** Durée du retournement en ms. */
  flipDuration?: number;

  frontColor?: THREE.ColorRepresentation;
  backColor?: THREE.ColorRepresentation;
  inkColor?: THREE.ColorRepresentation;

  /** Rayon des coins. */
  rounded?: number;

  colorAnimation?: Partial<{
    enabled: boolean;
    duration: number;
    palettes: CardColorPalette[];
  }>;

  /** `distance` omis = cadrage automatique. */
  camera?: Partial<{
    fov: number;
    distance: number;
    y: number;
  }>;

  /** Force de l'inclinaison vers le pointeur, 0 = désactivée (défaut 1). */
  tilt?: number;
  /** Flottement et léger balancement au repos (défaut true). */
  float?: boolean;
  /** Ombre portée au sol (défaut true). */
  showShadow?: boolean;

  onFlip?: (flipped: boolean) => void;
}

/* ====================================================================== */
/*  Constantes et utilitaires                                             */
/* ====================================================================== */

const SUIT_COLORS: Record<CardSuit, string> = {
  hearts: "#d72f45",
  diamonds: "#d72f45",
  clubs: "#11151b",
  spades: "#11151b",
};

const SERIF = "Georgia, 'Times New Roman', serif";
const DEFAULT_ACCENT = "#8fceff";

const NEUTRAL_TONE_MAPPING: THREE.ToneMapping =
  (THREE as unknown as { NeutralToneMapping?: THREE.ToneMapping }).NeutralToneMapping ??
  THREE.ACESFilmicToneMapping;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const easeInOutCubic = (v: number) => {
  const t = clamp01(v);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const hex = (c: THREE.ColorRepresentation) => `#${new THREE.Color(c).getHexString()}`;

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Fusionne les sommets identiques puis recalcule des normales lissées. */
function smoothGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = src.attributes.position.array as ArrayLike<number>;
  const n = p.length / 3;
  const map = new Map<string, number>();
  const pos: number[] = [];
  const idx: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(p[i * 3] * 4000)}_${Math.round(p[i * 3 + 1] * 4000)}_${Math.round(p[i * 3 + 2] * 4000)}`;
    let j = map.get(k);
    if (j === undefined) {
      j = pos.length / 3;
      map.set(k, j);
      pos.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    }
    idx[i] = j;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

/** Extrait un groupe de triangles d'une géométrie non indexée. */
function sliceGeometry(src: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  const pos = src.attributes.position.array as Float32Array;
  out.setAttribute("position", new THREE.BufferAttribute(pos.slice(start * 3, (start + count) * 3), 3));
  const nor = src.attributes.normal?.array as Float32Array | undefined;
  if (nor) out.setAttribute("normal", new THREE.BufferAttribute(nor.slice(start * 3, (start + count) * 3), 3));
  return out;
}

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mat) => {
        const t = mat as THREE.Material & { map?: THREE.Texture | null; bumpMap?: THREE.Texture | null };
        t.map?.dispose();
        t.bumpMap?.dispose();
        mat.dispose();
      });
    }
  });
}

/* ====================================================================== */
/*  Dessin des faces (canvas)                                             */
/* ====================================================================== */

function rrPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, s: number) {
  ctx.moveTo(0, s * 0.95);
  ctx.bezierCurveTo(-s * 1.25, s * 0.25, -s * 1.05, -s * 0.95, -s * 0.42, -s * 0.9);
  ctx.bezierCurveTo(-s * 0.18, -s * 0.88, 0, -s * 0.7, 0, -s * 0.5);
  ctx.bezierCurveTo(0, -s * 0.7, s * 0.18, -s * 0.88, s * 0.42, -s * 0.9);
  ctx.bezierCurveTo(s * 1.05, -s * 0.95, s * 1.25, s * 0.25, 0, s * 0.95);
  ctx.closePath();
}

function stemPath(ctx: CanvasRenderingContext2D, s: number, top: number) {
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.quadraticCurveTo(-s * 0.05, s * 0.85, -s * 0.42, s * 1.05);
  ctx.lineTo(s * 0.42, s * 1.05);
  ctx.quadraticCurveTo(s * 0.05, s * 0.85, 0, top);
  ctx.closePath();
}

function drawSuit(
  ctx: CanvasRenderingContext2D, suit: CardSuit, x: number, y: number, size: number, upsideDown = false,
) {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  if (upsideDown) ctx.rotate(Math.PI);
  ctx.beginPath();
  if (suit === "diamonds") {
    ctx.moveTo(0, -s * 1.05);
    ctx.lineTo(s * 0.72, 0);
    ctx.lineTo(0, s * 1.05);
    ctx.lineTo(-s * 0.72, 0);
    ctx.closePath();
    ctx.fill();
  } else if (suit === "hearts") {
    heartPath(ctx, s);
    ctx.fill();
  } else if (suit === "spades") {
    ctx.save();
    ctx.scale(1, -1);
    heartPath(ctx, s);
    ctx.restore();
    ctx.fill();
    stemPath(ctx, s, s * 0.25);
    ctx.fill();
  } else {
    const r = s * 0.4;
    for (const [cx, cy] of [[0, -s * 0.45], [-s * 0.45, s * 0.15], [s * 0.45, s * 0.15], [0, s * 0.02]]) {
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.fill();
    stemPath(ctx, s, s * 0.2);
    ctx.fill();
  }
  ctx.restore();
}

const L = 0.3, C = 0.5, R = 0.7;
const SIDE6: [number, number][] = [[L, 0.215], [R, 0.215], [L, 0.5], [R, 0.5], [L, 0.785], [R, 0.785]];
const SIDE8: [number, number][] = [[L, 0.215], [R, 0.215], [L, 0.405], [R, 0.405], [L, 0.595], [R, 0.595], [L, 0.785], [R, 0.785]];
const PIPS: Partial<Record<CardRank, [number, number][]>> = {
  "2": [[C, 0.215], [C, 0.785]],
  "3": [[C, 0.215], [C, 0.5], [C, 0.785]],
  "4": [[L, 0.215], [R, 0.215], [L, 0.785], [R, 0.785]],
  "5": [[L, 0.215], [R, 0.215], [L, 0.785], [R, 0.785], [C, 0.5]],
  "6": SIDE6,
  "7": [...SIDE6, [C, 0.36]],
  "8": [...SIDE6, [C, 0.36], [C, 0.64]],
  "9": [...SIDE8, [C, 0.5]],
  "10": [...SIDE8, [C, 0.31], [C, 0.69]],
};

/** Face avant, en blanc sur fond transparent (teintée ensuite par le matériau). */
function drawFaceArt(ctx: CanvasRenderingContext2D, cw: number, ch: number, rank: CardRank, suit: CardSuit) {
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const corner = () => {
    ctx.font = `bold ${Math.round(cw * (rank === "10" ? 0.115 : 0.135))}px ${SERIF}`;
    ctx.fillText(rank, cw * 0.108, ch * 0.078);
    drawSuit(ctx, suit, cw * 0.108, ch * 0.078 + cw * 0.125, cw * 0.095);
  };
  corner();
  ctx.save();
  ctx.translate(cw, ch);
  ctx.rotate(Math.PI);
  corner();
  ctx.restore();

  if (rank === "A") {
    drawSuit(ctx, suit, cw * 0.5, ch * 0.5, cw * 0.46);
  } else if (rank === "J" || rank === "Q" || rank === "K") {
    ctx.lineWidth = cw * 0.008;
    rrPath(ctx, cw * 0.235, ch * 0.16, cw * 0.53, ch * 0.68, cw * 0.03);
    ctx.stroke();
    ctx.font = `bold ${Math.round(cw * 0.42)}px ${SERIF}`;
    ctx.fillText(rank, cw * 0.5, ch * 0.5);
    drawSuit(ctx, suit, cw * 0.32, ch * 0.235, cw * 0.1);
    drawSuit(ctx, suit, cw * 0.68, ch * 0.765, cw * 0.1, true);
  } else {
    for (const [px, py] of PIPS[rank] ?? []) {
      drawSuit(ctx, suit, cw * px, ch * py, cw * 0.17, py > 0.5);
    }
  }
}

/** Motif du dos, en blanc sur fond transparent. */
function drawBackArt(ctx: CanvasRenderingContext2D, cw: number, ch: number) {
  ctx.clearRect(0, 0, cw, ch);
  const inset = cw * 0.04;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = cw * 0.012;
  rrPath(ctx, inset, inset, cw - inset * 2, ch - inset * 2, cw * 0.05);
  ctx.stroke();

  const inner = cw * 0.075;
  ctx.save();
  rrPath(ctx, inner, inner, cw - inner * 2, ch - inner * 2, cw * 0.03);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = cw * 0.006;
  const step = cw * 0.055;
  for (let i = -ch; i < cw + ch; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + ch, ch); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - ch, ch); ctx.stroke();
  }
  ctx.restore();

  // médaillon central
  ctx.fillStyle = "rgba(0,0,0,0.0)";
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = cw * 0.012;
  ctx.beginPath(); ctx.arc(cw / 2, ch / 2, cw * 0.19, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cw / 2, ch / 2 - cw * 0.14);
  ctx.lineTo(cw / 2 + cw * 0.1, ch / 2);
  ctx.lineTo(cw / 2, ch / 2 + cw * 0.14);
  ctx.lineTo(cw / 2 - cw * 0.1, ch / 2);
  ctx.closePath();
  ctx.stroke();
}

function canvasTexture(
  aniso: number, cw: number, ch: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PlayingCard : contexte canvas indisponible.");
  draw(ctx, cw, ch);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  return tex;
}

/* ====================================================================== */
/*  Environnement de studio                                               */
/* ====================================================================== */

function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(
    new THREE.BoxGeometry(70, 70, 70),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.34, 0.38), side: THREE.BackSide }),
  ));
  const panel = (w: number, h: number, pos: [number, number, number], rgb: [number, number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), side: THREE.DoubleSide }),
    );
    m.position.set(pos[0], pos[1], pos[2]);
    m.lookAt(0, 0, 0);
    es.add(m);
  };
  panel(36, 20, [0, 28, 8], [7, 7, 7.6]);
  panel(12, 28, [-26, 4, 14], [5, 5, 5.4]);
  panel(10, 26, [28, 2, -12], [4, 4.4, 5.2]);
  panel(32, 7, [0, -8, 30], [1.5, 1.6, 1.9]);
  panel(14, 14, [20, 14, 24], [2, 2.7, 3.8]);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(es, 0.03);
  pm.dispose();
  disposeTree(es);
  return rt.texture;
}

/* ====================================================================== */
/*  Construction de la carte                                              */
/* ====================================================================== */

interface CardBuild {
  group: THREE.Group;
  paper: THREE.MeshPhysicalMaterial;
  edge: THREE.MeshPhysicalMaterial;
  ink: THREE.MeshPhysicalMaterial;
  field: THREE.MeshPhysicalMaterial;
  base: Required<CardColorPalette>;
}

interface BuildOptions {
  rank: CardRank; suit: CardSuit;
  width: number; height: number; thickness: number; rounded: number;
  front: string; back: string; ink: string;
}

function buildCard(o: BuildOptions, aniso: number): CardBuild {
  const { width: w, height: h, thickness: t } = o;
  const group = new THREE.Group();

  /* --- corps : dalle extrudée à tranche arrondie --- */
  const bt = Math.min(t * 0.32, 0.05);
  const depth = Math.max(0.002, t - bt * 2);
  const r0 = Math.max(0.02, o.rounded - bt);
  const shape = roundedRectShape(w - bt * 2, h - bt * 2, r0);
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: true, bevelThickness: bt, bevelSize: bt,
    bevelSegments: 6, curveSegments: 14,
  });
  extruded.translate(0, 0, -depth / 2);

  const lids = extruded.groups.find((g) => g.materialIndex === 0);
  const sides = extruded.groups.find((g) => g.materialIndex === 1);
  const capGeo = lids ? sliceGeometry(extruded, lids.start, lids.count) : extruded;          // faces planes
  const edgeGeo = sides ? smoothGeometry(sliceGeometry(extruded, sides.start, sides.count)) : null; // tranche lisse
  if (lids && sides) extruded.dispose();

  const paper = new THREE.MeshPhysicalMaterial({
    color: o.front, roughness: 0.34, metalness: 0, clearcoat: 0.75, clearcoatRoughness: 0.22,
  });
  const edge = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(o.front).multiplyScalar(0.9), roughness: 0.5, metalness: 0,
    clearcoat: 0.3, clearcoatRoughness: 0.4,
  });

  const cap = new THREE.Mesh(capGeo, paper);
  cap.castShadow = true;
  group.add(cap);
  if (edgeGeo) {
    const side = new THREE.Mesh(edgeGeo, edge);
    side.castShadow = true;
    group.add(side);
  }

  /* --- face avant : encre en relief --- */
  const capW = w - bt * 2, capH = h - bt * 2;
  const faceTex = canvasTexture(aniso, 1024, Math.round((1024 * h) / w), (ctx, cw, ch) =>
    drawFaceArt(ctx, cw, ch, o.rank, o.suit));
  const ink = new THREE.MeshPhysicalMaterial({
    color: o.ink, map: faceTex, bumpMap: faceTex, bumpScale: 2,
    transparent: true, depthWrite: false, roughness: 0.6, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const inkPlane = new THREE.Mesh(new THREE.PlaneGeometry(capW, capH), ink);
  inkPlane.position.z = t / 2 + 0.002;
  group.add(inkPlane);

  /* --- dos : champ coloré + motif métallisé --- */
  const margin = w * 0.04;
  const fw = capW - margin * 2, fh = capH - margin * 2;
  const field = new THREE.MeshPhysicalMaterial({
    color: o.back, roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.18,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const fieldMesh = new THREE.Mesh(
    new THREE.ShapeGeometry(roundedRectShape(fw, fh, Math.max(0.05, r0 - margin * 0.5)), 16), field);
  fieldMesh.position.z = -t / 2 - 0.002;
  fieldMesh.rotation.y = Math.PI;
  group.add(fieldMesh);

  const patternTex = canvasTexture(aniso, 1024, Math.round((1024 * fh) / fw), (ctx, cw, ch) =>
    drawBackArt(ctx, cw, ch));
  const pattern = new THREE.MeshPhysicalMaterial({
    map: patternTex, transparent: true, depthWrite: false, roughness: 0.3, metalness: 0.55,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const patternMesh = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), pattern);
  patternMesh.position.z = -t / 2 - 0.004;
  patternMesh.rotation.y = Math.PI;
  group.add(patternMesh);

  return {
    group, paper, edge, ink, field,
    base: { front: o.front, back: o.back, ink: o.ink, accent: DEFAULT_ACCENT },
  };
}

/* ====================================================================== */
/*  Composant                                                             */
/* ====================================================================== */

interface LiveOptions {
  width: number; height: number;
  clickable: boolean; rotateSpeed: number; flipDuration: number;
  tilt: number; float: boolean; showShadow: boolean;
  colorAnimation: { enabled: boolean; duration: number; palettes: CardColorPalette[] };
  camera: { fov: number; distance?: number; y: number };
  onFlip?: (flipped: boolean) => void;
}

interface FlipState {
  target: boolean; angle: number; from: number; to: number; start: number; active: boolean;
}

interface SceneRefs {
  holder: THREE.Group;
  aniso: number;
}

export default function PlayingCard({
  className,
  style,
  rank = "A",
  suit = "spades",
  width = 3.2,
  height = 4.6,
  thickness = 0.12,
  flipped = false,
  clickable = true,
  rotateSpeed = 0,
  flipDuration = 700,
  frontColor = "#f8fafc",
  backColor = "#111827",
  inkColor,
  rounded = 0.22,
  colorAnimation,
  camera,
  tilt = 1,
  float = true,
  showShadow = true,
  onFlip,
}: PlayingCardProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const cardRef = useRef<CardBuild | null>(null);
  const flipRef = useRef<FlipState>({
    target: flipped, angle: flipped ? Math.PI : 0, from: 0, to: 0, start: 0, active: false,
  });

  // Options « à chaud » : lues par la boucle de rendu, sans reconstruire la scène.
  const live: LiveOptions = {
    width, height, clickable, rotateSpeed, flipDuration, tilt, float, showShadow,
    colorAnimation: {
      enabled: colorAnimation?.enabled ?? false,
      duration: colorAnimation?.duration ?? 4000,
      palettes: colorAnimation?.palettes ?? [],
    },
    camera: { fov: camera?.fov ?? 30, distance: camera?.distance, y: camera?.y ?? 1 },
    onFlip,
  };
  //const liveRef = useRef(live);
  //liveRef.current = live;
  //ajout remplace les 2 lignes précédentes pour éviter un warning de react sur l'utilisation d'un ref dans un useEffect
  const liveRef = useRef(live);
  useLayoutEffect(() => {
    liveRef.current = live;
  }, [live]);
  //fin ajout
  const frontHex = hex(frontColor);
  const backHex = hex(backColor);
  const inkHex = hex(inkColor ?? SUIT_COLORS[suit]);

  const requestFlip = useCallback((next: boolean, notify: boolean) => {
    const f = flipRef.current;
    if (f.target === next) return;
    f.target = next;
    f.from = f.angle;
    f.to = next ? Math.PI : 0;
    f.start = performance.now();
    f.active = true;
    if (notify) liveRef.current.onFlip?.(next);
  }, []);

  // La prop `flipped` pilote l'animation (sans reconstruire la scène).
  useEffect(() => { requestFlip(flipped, false); }, [flipped, requestFlip]);

  /* ---------- scène, rendu, interactions (montage unique) ---------- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (err) {
      console.error("PlayingCard : WebGL indisponible", err);
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = NEUTRAL_TONE_MAPPING;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const env = buildEnvironment(renderer);
    scene.environment = env;

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-3.5, 9, 4.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -7;
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);

    const rim = new THREE.DirectionalLight(new THREE.Color(DEFAULT_ACCENT), 1.4);
    rim.position.set(5, 3, -6);
    scene.add(rim);

    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const holder = new THREE.Group();
    holder.rotation.order = "YXZ";
    scene.add(holder);

    sceneRef.current = { holder, aniso: renderer.capabilities.getMaxAnisotropy() };
    // Une carte a peut-être déjà été construite avant que la scène n'existe : elle sera ajoutée par l'effet suivant.

    const resize = () => {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    /* --- pointeur : inclinaison + clic --- */
    let targetX = 0, targetY = 0, tiltX = 0, tiltY = 0;
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      targetY = ((e.clientX - r.left) / r.width - 0.5) * 2 * 0.38;
      targetX = ((e.clientY - r.top) / r.height - 0.5) * 2 * 0.3;
    };
    const onLeave = () => { targetX = 0; targetY = 0; };
    const onClick = () => {
      if (liveRef.current.clickable) requestFlip(!flipRef.current.target, true);
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("click", onClick);

    /* --- boucle --- */
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cA = new THREE.Color(), cB = new THREE.Color();
    const mix = (a: string, b: string, e: number, out: THREE.Color) => out.set(a).lerp(cB.set(b), e);
    let raf = 0, last = performance.now(), spin = 0, animating = false, fovNow = cam.fov;

    const frame = (now: number) => {
      const o = liveRef.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      /* retournement en arc */
      const f = flipRef.current;
      let lift = 0, roll = 0;
      if (f.active) {
        const p = clamp01((now - f.start) / Math.max(1, o.flipDuration));
        f.angle = f.from + (f.to - f.from) * easeInOutCubic(p);
        lift = Math.sin(Math.PI * p);
        roll = lift * 0.1 * (f.to > f.from ? -1 : 1);
        if (p >= 1) { f.active = false; f.angle = f.to; }
      }
      spin += o.rotateSpeed * dt;
      const yaw = f.angle + spin;
      const facing = Math.cos(yaw); // inverse l'inclinaison quand on voit le dos

      const k = 1 - Math.exp(-dt * 7);
      const amount = clamp(o.tilt, 0, 2);
      tiltX += (targetX * amount - tiltX) * k;
      tiltY += (targetY * amount - tiltY) * k;

      const idle = o.float && !reduce ? 1 : 0;
      holder.position.set(0, Math.sin(t * 1.25) * 0.07 * idle, lift);
      holder.rotation.set(
        tiltX * facing + Math.sin(t * 0.9) * 0.025 * idle,
        yaw + tiltY * facing + Math.sin(t * 0.6) * 0.06 * idle,
        roll + Math.sin(t * 0.5) * 0.01 * idle,
      );

      /* caméra : cadrage automatique si `distance` n'est pas fourni */
      if (fovNow !== o.camera.fov) { fovNow = o.camera.fov; cam.fov = fovNow; cam.updateProjectionMatrix(); }
      const tn = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const auto = Math.max(((o.height / 2 + 0.8) * 1.12) / tn, ((o.width / 2 + 0.7) * 1.15) / (tn * cam.aspect));
      const dist = o.camera.distance ?? auto;
      cam.position.set(0, o.camera.y, dist);
      cam.lookAt(0, -0.25, 0);

      ground.position.y = -(o.height / 2) - 0.9;
      ground.visible = o.showShadow;

      /* animation de couleurs */
      const card = cardRef.current;
      if (card) {
        const ca = o.colorAnimation;
        if (ca.enabled && ca.palettes.length > 0) {
          const pal: CardColorPalette[] = [card.base, ...ca.palettes];
          const dur = Math.max(1, ca.duration);
          const cycle = (now % (dur * pal.length)) / dur;
          const i = Math.floor(cycle);
          const A = pal[i], B = pal[(i + 1) % pal.length];
          const a = cycle - i;
          const e = a * a * (3 - 2 * a);
          const b = card.base;
          mix(A.front ?? b.front, B.front ?? b.front, e, cA);
          card.paper.color.copy(cA);
          card.edge.color.copy(cA).multiplyScalar(0.9);
          card.field.color.copy(mix(A.back ?? b.back, B.back ?? b.back, e, cA));
          card.ink.color.copy(mix(A.ink ?? b.ink, B.ink ?? b.ink, e, cA));
          rim.color.copy(mix(A.accent ?? b.accent, B.accent ?? b.accent, e, cA));
          animating = true;
        } else if (animating) {
          const b = card.base;
          card.paper.color.set(b.front);
          card.edge.color.set(b.front).multiplyScalar(0.9);
          card.field.color.set(b.back);
          card.ink.color.set(b.ink);
          rim.color.set(b.accent);
          animating = false;
        }
      }

      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("click", onClick);
      groundGeo.dispose();
      groundMat.dispose();
      key.shadow.map?.dispose();
      env.dispose();
      renderer.dispose();
      if (canvas.parentNode === host) host.removeChild(canvas);
      sceneRef.current = null;
    };
  }, [requestFlip]);

  /* ---------- carte : reconstruite seulement si son apparence change ---------- */
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return undefined;
    const card = buildCard(
      { rank, suit, width, height, thickness, rounded, front: frontHex, back: backHex, ink: inkHex },
      s.aniso,
    );
    s.holder.add(card.group);
    cardRef.current = card;
    return () => {
      s.holder.remove(card.group);
      disposeTree(card.group);
      if (cardRef.current === card) cardRef.current = null;
    };
  }, [rank, suit, width, height, thickness, rounded, frontHex, backHex, inkHex]);

  return (
    <div
      ref={hostRef}
      className={className}
      role="img"
      aria-label={`${rank} of ${suit}`}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 260,
        overflow: "hidden",
        cursor: clickable ? "pointer" : "default",
        touchAction: "pan-y",
        ...style,
      }}
    />
  );
}
