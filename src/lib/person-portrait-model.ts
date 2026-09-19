/**
 * person-portrait-model.ts
 *
 * Modèle 3D procédural d'un portrait (buste) construit à partir de mesures visuelles relevées
 * sur des photos de référence. Ce n'est PAS une reconstruction photogrammétrique : les volumes
 * sont estimés (profils de crâne, champs de déplacement pour nez / lèvres / orbites, etc.).
 *
 * Unités : la hauteur du crâne (menton → sommet) vaut 2. Le repère est celui d'un visage regardant +Z,
 * Y vers le haut, X vers la droite de l'écran quand on regarde le visage de face.
 *
 * Hiérarchie produite :
 *   PersonPortrait
 *   ├── Head       (crâne + peau du visage)
 *   ├── Face       (moustache)
 *   ├── Eyes       (globes oculaires)
 *   ├── Eyebrows
 *   ├── Nose       (région du nez, matériau légèrement plus brillant)
 *   ├── Mouth      (lèvres)
 *   ├── Ears
 *   ├── Hair
 *   ├── Neck
 *   └── Shoulders  (torse, col, cravate)
 */
import * as THREE from "three";

/* ====================================================================== */
/*  Paramètres                                                            */
/* ====================================================================== */

export interface PortraitAsymmetry {
  /** > 0 : le sourcil du côté +X (droite de l'écran, vu de face) est plus haut. */
  browLift: number;
  /** > 0 : l'œil du côté +X est plus ouvert. */
  eyeOpen: number;
  /** > 0 : la bouche monte du côté +X. */
  mouthTilt: number;
  /** Décalage latéral du menton / de la mâchoire. */
  jawShift: number;
  /** Décalage latéral de la pointe du nez. */
  noseShift: number;
  /** Léger cisaillement du crâne (rompt la symétrie parfaite). */
  skullShear: number;
}

export interface PortraitParams {
  skinColor: string;
  lipColor: string;
  hairColor: string;
  browColor: string;
  irisColor: string;
  scleraColor: string;
  shirtColor: string;
  tieColor: string;
  showMustache: boolean;
  showStubble: boolean;
  showShoulders: boolean;
  asymmetry: PortraitAsymmetry;
}

export const DEFAULT_PORTRAIT_PARAMS: PortraitParams = {
  skinColor: "#5a3a2a",
  lipColor: "#7d4a3f",
  hairColor: "#0f0b09",
  browColor: "#0c0908",
  irisColor: "#3b1f0f",
  scleraColor: "#cdbfae",
  shirtColor: "#1b1c20",
  tieColor: "#0c0c0e",
  showMustache: true,
  showStubble: true,
  showShoulders: true,
  asymmetry: {
    browLift: 0.008,
    eyeOpen: 0.06,
    mouthTilt: 0.006,
    jawShift: 0.012,
    noseShift: 0.006,
    skullShear: 0.012,
  },
};

export type PortraitParamOverrides = Partial<Omit<PortraitParams, "asymmetry">> & {
  asymmetry?: Partial<PortraitAsymmetry>;
};

export interface PortraitModel {
  root: THREE.Group;
  dispose: () => void;
}

/* ====================================================================== */
/*  Maths                                                                 */
/* ====================================================================== */

type Vec3 = [number, number, number];
type Pt3 = readonly [number, number, number];
type Pt2 = readonly [number, number];

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const clamp01 = (v: number): number => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const gauss = (d: number, r: number): number => Math.exp(-(d * d) / (r * r));
const g2 = (dx: number, dy: number, sx: number, sy: number): number =>
  Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy));

/** Interpolation cubique monotone (pas de dépassement) à travers des points (x, y). */
function pchip(points: ReadonlyArray<Pt2>): (x: number) => number {
  const n = points.length;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const h: number[] = [];
  const del: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(xs[i + 1] - xs[i]);
    del.push((ys[i + 1] - ys[i]) / h[i]);
  }
  const d: number[] = new Array<number>(n).fill(0);
  d[0] = del[0];
  d[n - 1] = del[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (del[i - 1] * del[i] <= 0) d[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      d[i] = (w1 + w2) / (w1 / del[i - 1] + w2 / del[i]);
    }
  }
  return (x: number): number => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let k = 0;
    while (k < n - 2 && x > xs[k + 1]) k++;
    const t = (x - xs[k]) / h[k];
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[k] +
      (t3 - 2 * t2 + t) * h[k] * d[k] +
      (-2 * t3 + 3 * t2) * ys[k + 1] +
      (t3 - t2) * h[k] * d[k + 1]
    );
  };
}

/* --- bruit de valeur (déterministe) --- */
function hash3(x: number, y: number, z: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (dx: number, dy: number, dz: number): number => hash3(ix + dx, iy + dy, iz + dz);
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u), x10 = lerp(c(0, 1, 0), c(1, 1, 0), u);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u), x11 = lerp(c(0, 1, 1), c(1, 1, 1), u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}
function fbm(x: number, y: number, z: number, oct = 3): number {
  let a = 0.5, s = 0, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, z * f);
    a *= 0.5;
    f *= 2.03;
  }
  return s;
}

/** Distance à un segment 2D + paramètre t le long du segment. */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): { d: number; t: number } {
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy;
  const t = l2 === 0 ? 0 : clamp01(((px - ax) * vx + (py - ay) * vy) / l2);
  const cx = ax + vx * t, cy = ay + vy * t;
  return { d: Math.hypot(px - cx, py - cy), t };
}

/** Masque doux (0..1) autour d'une polyligne (x, y, rayon). */
function polyMask(px: number, py: number, pts: ReadonlyArray<Pt3>, soft = 0.55): number {
  let best = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const { d, t } = segDist(px, py, a[0], a[1], b[0], b[1]);
    const r = lerp(a[2], b[2], t);
    best = Math.max(best, smoothstep(1, soft, d / r));
  }
  return best;
}

/* ====================================================================== */
/*  Profil du crâne (lofting par tranches elliptiques)                    */
/* ====================================================================== */

const Y_BOTTOM = -1.0;
const Y_TOP = 1.05;
const CAP_Y0 = 0.45;
const CAP_H = 0.6;

const pA = pchip([[-1.0, 0.02], [-0.98, 0.1], [-0.94, 0.19], [-0.86, 0.28], [-0.74, 0.38], [-0.6, 0.47],
  [-0.4, 0.55], [-0.2, 0.6], [0.0, 0.63], [0.2, 0.655], [0.45, 0.665]]);
const pF = pchip([[-1.0, 0.38], [-0.98, 0.52], [-0.94, 0.6], [-0.88, 0.63], [-0.78, 0.615], [-0.62, 0.6],
  [-0.5, 0.63], [-0.4, 0.65], [-0.25, 0.655], [-0.1, 0.66], [0.05, 0.68], [0.2, 0.735], [0.32, 0.76], [0.45, 0.755]]);
const pB = pchip([[-1.0, 0.1], [-0.96, 0.2], [-0.9, 0.34], [-0.8, 0.48], [-0.65, 0.62], [-0.45, 0.75],
  [-0.25, 0.84], [0.0, 0.9], [0.25, 0.925], [0.45, 0.92]]);
const pN = pchip([[-1.0, 2.0], [-0.85, 2.2], [-0.6, 2.5], [-0.3, 2.3], [0.0, 2.2], [0.45, 2.1]]);

interface Section { a: number; f: number; b: number; n: number }

function sectionAt(y: number): Section {
  if (y >= CAP_Y0) {
    const u = Math.min(1, (y - CAP_Y0) / CAP_H);
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    return { a: 0.665 * s, f: 0.755 * s, b: 0.92 * s, n: 2.1 - 0.1 * u };
  }
  return { a: pA(y), f: pF(y), b: pB(y), n: pN(y) };
}

/** Profondeur (z) de la surface de base du visage en (x, y), avant déplacement. */
function baseZ(x: number, y: number): number {
  const s = sectionAt(y);
  const k = clamp01(Math.abs(x) / s.a);
  return s.f * Math.pow(Math.max(0, 1 - Math.pow(k, s.n)), 1 / s.n);
}

/* ====================================================================== */
/*  Grille de lofting générique                                           */
/* ====================================================================== */

interface Grid {
  positions: Float32Array;
  uvs: Float32Array;
  indices: number[];
  rows: number;
  cols: number;
}

function makeGrid(rows: number, cols: number, pos: (j: number, i: number) => Vec3, uScale = 1, vScale = 1): Grid {
  const vc = (rows + 1) * (cols + 1);
  const positions = new Float32Array(vc * 3);
  const uvs = new Float32Array(vc * 2);
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const k = j * (cols + 1) + i;
      const p = pos(j, i);
      positions[k * 3] = p[0];
      positions[k * 3 + 1] = p[1];
      positions[k * 3 + 2] = p[2];
      uvs[k * 2] = (i / cols) * uScale;
      uvs[k * 2 + 1] = (j / rows) * vScale;
    }
  }
  const indices: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + (cols + 1), d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  return { positions, uvs, indices, rows, cols };
}

function gridGeometry(g: Grid): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(g.positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(g.uvs, 2));
  geo.setIndex(g.indices);
  return geo;
}

/** Moyenne les normales des sommets dupliqués sur la couture (colonne 0 et colonne N). */
function fixSeamNormals(geo: THREE.BufferGeometry, rows: number, cols: number): void {
  const n = geo.attributes.normal as THREE.BufferAttribute;
  for (let j = 0; j <= rows; j++) {
    const a = j * (cols + 1), b = a + cols;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l);
    n.setXYZ(b, x / l, y / l, z / l);
  }
  n.needsUpdate = true;
}

/** Retourne l'orientation des triangles si la normale au sommet de test pointe à l'opposé de `dir`. */
function orientOutward(geo: THREE.BufferGeometry, testVertex: number, dir: Vec3): void {
  geo.computeVertexNormals();
  const n = geo.attributes.normal as THREE.BufferAttribute;
  const dot = n.getX(testVertex) * dir[0] + n.getY(testVertex) * dir[1] + n.getZ(testVertex) * dir[2];
  if (dot < 0) {
    const idx = geo.index;
    if (!idx) return;
    const arr = idx.array as Uint32Array | Uint16Array;
    for (let i = 0; i < arr.length; i += 3) {
      const t = arr[i + 1];
      arr[i + 1] = arr[i + 2];
      arr[i + 2] = t;
    }
    idx.needsUpdate = true;
    geo.computeVertexNormals();
  }
}

/* ====================================================================== */
/*  Textures procédurales (DataTexture : aucun DOM requis)                */
/* ====================================================================== */

function tileNoise(u: number, v: number, period: number, seed: number): number {
  const x = u * period, y = v * period;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number): number => hash3(((a % period) + period) % period, ((b % period) + period) % period, seed);
  return lerp(lerp(h(ix, iy), h(ix + 1, iy), sx), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), sx), sy);
}

/** Bruit gris tileable, utilisé en bumpMap / roughnessMap. Valeurs dans [lo, 1]. */
function createNoiseTexture(size: number, seed: number, lo: number, periods: ReadonlyArray<number>): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let v = 0, amp = 0.5, tot = 0;
      for (const p of periods) {
        v += amp * tileNoise(i / size, j / size, p, seed + p);
        tot += amp;
        amp *= 0.6;
      }
      v = lerp(lo, 1, v / tot);
      const b = Math.round(clamp01(v) * 255);
      const k = (j * size + i) * 4;
      data[k] = b; data[k + 1] = b; data[k + 2] = b; data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Texture de cheveux crépus : cellules (Worley) tileables → petites boucles en relief. */
function createCurlTexture(size: number, cells: number, seed: number): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const pts: Array<[number, number]> = [];
  for (let cy = 0; cy < cells; cy++) for (let cx = 0; cx < cells; cx++) {
    pts.push([(cx + hash3(cx, cy, seed)) / cells, (cy + hash3(cx, cy, seed + 7)) / cells]);
  }
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const u = i / size, v = j / size;
      const cx = Math.floor(u * cells), cy = Math.floor(v * cells);
      let d1 = 9;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const wx = (cx + ox + cells) % cells, wy = (cy + oy + cells) % cells;
        const p = pts[wy * cells + wx];
        let dx = p[0] - u, dy = p[1] - v;
        dx -= Math.round(dx); dy -= Math.round(dy);
        d1 = Math.min(d1, Math.hypot(dx, dy) * cells);
      }
      const h = 1 - smoothstep(0, 0.8, d1);
      const b = Math.round(clamp01(0.25 + 0.75 * h) * 255);
      const k = (j * size + i) * 4;
      data[k] = b; data[k + 1] = b; data[k + 2] = b; data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/** Texture d'œil (sclère, iris, pupille) pour une SphereGeometry dont le pôle avant est à u = 0.25, v = 0.5. */
function createEyeTexture(irisHex: string, scleraHex: string): THREE.DataTexture {
  const W = 512, H = 256;
  const data = new Uint8Array(W * H * 4);
  const iris = new THREE.Color(irisHex).convertLinearToSRGB();
  const sclera = new THREE.Color(scleraHex).convertLinearToSRGB();
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const u = (i + 0.5) / W, v = (j + 0.5) / H;
      const phi = u * Math.PI * 2, theta = Math.PI * (1 - v);
      const sinT = Math.sin(theta);
      const dx = -Math.cos(phi) * sinT, dy = Math.cos(theta), dz = Math.sin(phi) * sinT;
      const ang = Math.acos(clamp(dz, -1, 1));
      const az = Math.atan2(dy, dx);
      // sclère : légère variation chaude
      const n = fbm(dx * 6, dy * 6, dz * 6, 3);
      let r = sclera.r * (0.9 + 0.12 * n) + 0.05 * n;
      let g = sclera.g * (0.86 + 0.12 * n);
      let b = sclera.b * (0.84 + 0.12 * n);
      // assombrissement vers les bords (ombre des paupières)
      const edge = smoothstep(0.75, 1.5, ang);
      r *= 1 - 0.35 * edge; g *= 1 - 0.4 * edge; b *= 1 - 0.4 * edge;
      const irisR = 0.43;
      const t = ang / irisR;
      if (t < 1.06) {
        const fib = 0.5 + 0.5 * Math.sin(az * 46 + fbm(Math.cos(az) * 3, Math.sin(az) * 3, t * 4, 2) * 8);
        const ring = smoothstep(0.35, 0.62, t) * (1 - smoothstep(0.62, 0.95, t));
        const lim = smoothstep(0.82, 1.0, t);
        let ir = iris.r * (0.65 + 0.7 * fib * (1 - t * 0.5)) + 0.16 * ring;
        let ig = iris.g * (0.65 + 0.7 * fib * (1 - t * 0.5)) + 0.09 * ring;
        let ib = iris.b * (0.65 + 0.7 * fib * (1 - t * 0.5)) + 0.03 * ring;
        ir *= 1 - 0.75 * lim; ig *= 1 - 0.75 * lim; ib *= 1 - 0.75 * lim;
        const pupil = 1 - smoothstep(0.3, 0.38, t);
        ir *= 1 - pupil; ig *= 1 - pupil; ib *= 1 - pupil;
        const m = 1 - smoothstep(0.98, 1.06, t);
        r = lerp(r, ir, m); g = lerp(g, ig, m); b = lerp(b, ib, m);
      }
      const k = (j * W + i) * 4;
      data[k] = Math.round(clamp01(r) * 255);
      data[k + 1] = Math.round(clamp01(g) * 255);
      data[k + 2] = Math.round(clamp01(b) * 255);
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/* ====================================================================== */
/*  Le visage : champ de déplacement + masques                            */
/* ====================================================================== */

interface FaceSample {
  disp: number;
  brow: number;
  mustache: number;
  stubble: number;
  lips: number;
  mouthLine: number;
  nostril: number;
  eyeRim: number;
  eyeSocketShade: number;
  noseRegion: number;
  lipRegion: number;
}

const EYE_CX = 0.3;
const EYE_CY = 0.03;
const EYE_HALF_W = 0.115;
const MOUTH_Y = -0.47;

function newSample(): FaceSample {
  return { disp: 0, brow: 0, mustache: 0, stubble: 0, lips: 0, mouthLine: 0, nostril: 0, eyeRim: 0,
    eyeSocketShade: 0, noseRegion: 0, lipRegion: 0 };
}

const BROW_PTS: ReadonlyArray<Pt3> = [[0.1, 0.185, 0.032], [0.27, 0.225, 0.036], [0.42, 0.222, 0.031], [0.56, 0.172, 0.018]];
const MUSTACHE_PTS: ReadonlyArray<Pt3> = [[0, -0.39, 0.046], [0.13, -0.4, 0.043], [0.25, -0.43, 0.035],
  [0.33, -0.485, 0.03], [0.375, -0.55, 0.02]];

function sampleFace(x: number, y: number, zn: number, asym: PortraitAsymmetry, out: FaceSample): void {
  out.disp = 0; out.brow = 0; out.mustache = 0; out.stubble = 0; out.lips = 0; out.mouthLine = 0;
  out.nostril = 0; out.eyeRim = 0; out.eyeSocketShade = 0; out.noseRegion = 0; out.lipRegion = 0;

  const fm = smoothstep(0.05, 0.4, zn);
  if (fm <= 0) return;
  let d = 0;

  // front bombé du front
  d += 0.02 * g2(x - 0.25, y - 0.45, 0.25, 0.15) + 0.02 * g2(x + 0.25, y - 0.45, 0.25, 0.15);
  d += 0.02 * g2(x, y - 0.16, 0.07, 0.05); // glabelle

  for (const s of [1, -1] as const) {
    const bx = s * x;                                   // >0 vers l'extérieur
    const browY = 0.2 + s * asym.browLift;
    d += 0.05 * g2(bx - 0.27, y - browY, 0.24, 0.055);  // arcade sourcilière
    d -= 0.026 * g2(bx - 0.57, y - 0.22, 0.1, 0.14);    // creux temporal
    d -= 0.052 * g2(bx - EYE_CX, y - 0.05, 0.17, 0.11); // orbite
    d += 0.05 * g2(bx - 0.44, y + 0.08, 0.2, 0.13);     // pommette
    d -= 0.038 * g2(bx - 0.39, y + 0.42, 0.16, 0.16);   // creux de joue
    d += 0.022 * g2(bx - 0.47, y + 0.62, 0.11, 0.15);   // masséter

    // ---- œil : ouverture en amande + paupières ----
    const u = (x - s * EYE_CX) * s;
    const lx = u / EYE_HALF_W;
    if (Math.abs(lx) < 1.7) {
      const open = 1 + s * asym.eyeOpen;
      const yc = EYE_CY + 0.14 * u;
      const prof = Math.pow(Math.max(0, 1 - Math.min(1, lx * lx)), 0.75);
      const yUp = yc + 0.03 * open * prof;
      const yLo = yc - 0.031 * prof;
      const q = Math.min(yUp - y, y - yLo, (1 - Math.abs(lx)) * 0.07);
      const inside = smoothstep(0, 0.01, q);
      const cornerFade = 1 - smoothstep(0.55, 1.0, Math.abs(lx));
      d -= 0.16 * inside * cornerFade;
      if (q < 0.03) {
        const upper = y > yc ? 1 : 0.45;
        d += 0.05 * upper * gauss(q + 0.02, 0.022) * (1 - inside);
      }
      d -= 0.022 * gauss(y - (yc + 0.095), 0.013) * (1 - smoothstep(0.8, 1.3, Math.abs(lx))); // pli palpébral
      out.eyeRim = Math.max(out.eyeRim, gauss(q - 0.002, 0.007));
      out.eyeSocketShade = Math.max(out.eyeSocketShade, g2(bx - EYE_CX, y - 0.05, 0.2, 0.1));
    }

    // ---- sourcils (masque) ----
    const pts = BROW_PTS.map((p): Pt3 => [s * p[0], p[1] + (s === 1 ? asym.browLift : -asym.browLift), p[2]]);
    out.brow = Math.max(out.brow, polyMask(x, y, pts, 0.5));

    // ---- nez : ailes, narines, pli naso-génien ----
    d += 0.1 * g2(bx - 0.135, y + 0.16, 0.055, 0.06);
    const nx = bx - 0.062;
    const nn = g2(nx, y + 0.198, 0.034, 0.022);
    d -= 0.085 * nn;
    out.nostril = Math.max(out.nostril, nn);
    const sd = segDist(bx, y, 0.16, -0.17, 0.27, -0.44);
    d -= 0.022 * gauss(sd.d, 0.03);
  }

  // ---- nez : arête, pointe, base ----
  const nsh = asym.noseShift;
  {
    const sd = segDist(x - nsh * 0.5, y, 0, 0.15, nsh, -0.1);
    const w = lerp(0.055, 0.075, sd.t);
    const a = lerp(0.045, 0.19, sd.t * sd.t * 0.35 + sd.t * 0.65);
    d += a * gauss(sd.d, w);
  }
  d += 0.15 * g2(x - nsh, y + 0.145, 0.085, 0.07);
  d -= 0.1 * g2(x - nsh, y + 0.225, 0.1, 0.03);

  // ---- bouche ----
  const mtilt = asym.mouthTilt * (x / 0.24);
  const my = MOUTH_Y + mtilt;
  const ax = Math.abs(x);
  const mw = 0.25;
  if (ax < mw + 0.05) {
    const shape = Math.pow(Math.max(0, 1 - (ax / mw) * (ax / mw)), 0.6);
    const upBump = 0.06 * gauss(y - (my + 0.022), 0.03) * shape;
    const loBump = 0.082 * gauss(y - (my - 0.034), 0.036) * shape;
    const groove = 0.05 * gauss(y - my, 0.009) * (1 - smoothstep(0.2, 0.26, ax));
    d += upBump + loBump - groove;
    d -= 0.018 * g2(x, y - (my + 0.058), 0.028, 0.04); // fossette du philtre
    d += 0.012 * g2(Math.abs(x) - 0.05, y - (my + 0.1), 0.02, 0.06); // crêtes du philtre
    out.mouthLine = gauss(y - my, 0.008) * (1 - smoothstep(0.2, 0.27, ax));
    const upperEdge = my + 0.038 * Math.pow(Math.max(0, 1 - (ax / mw) * (ax / mw)), 0.7);
    const lowerEdge = my - 0.066 * Math.pow(Math.max(0, 1 - (ax / mw) * (ax / mw)), 0.7);
    const qLip = Math.min(upperEdge - y, y - lowerEdge, (mw - ax) * 0.4);
    out.lips = smoothstep(0, 0.008, qLip);
    out.lipRegion = smoothstep(-0.02, 0.01, qLip);
  }
  // sillon mento-labial + menton + mâchoire
  d -= 0.034 * gauss(y - (my - 0.15), 0.028) * (1 - smoothstep(0.1, 0.22, ax));
  d += 0.045 * g2(x - asym.jawShift, y + 0.9, 0.16, 0.1);
  d += 0.02 * g2(x - asym.jawShift * 0.6, y + 0.72, 0.3, 0.12);

  // ---- moustache / barbe légère ----
  out.mustache = polyMask(Math.abs(x), y, MUSTACHE_PTS.map((p): Pt3 => [p[0], p[1], p[2]]), 0.5);
  {
    const chin = g2(x - asym.jawShift, y + 0.86, 0.3, 0.17);
    const sd = segDist(ax, y, 0.28, -0.9, 0.5, -0.62);
    const jaw = gauss(sd.d, 0.075);
    const zone = Math.max(chin, jaw * 0.8);
    const pat = fbm(x * 38, y * 38, 1.3, 2);
    out.stubble = clamp01(zone * smoothstep(0.42, 0.62, pat + 0.35 * zone));
  }

  // région du nez (pour le maillage « Nose »)
  {
    const hw = 0.075 + 0.13 * smoothstep(-0.02, -0.19, y);
    const vert = smoothstep(0.1, 0.06, y) * smoothstep(-0.245, -0.215, y);
    out.noseRegion = vert * smoothstep(hw + 0.02, hw - 0.02, ax);
  }

  out.disp = d * fm;
  out.brow *= fm;
  out.mustache *= fm;
  out.stubble *= fm;
  out.lips *= fm;
  out.mouthLine *= fm;
  out.nostril *= fm;
  out.eyeRim *= fm;
  out.eyeSocketShade *= fm;
  out.noseRegion *= fm;
  out.lipRegion *= fm;
}

/* --- ligne d'implantation des cheveux (en fonction de l'azimut) --- */
const hairline = pchip([[0, 0.665], [15, 0.64], [30, 0.585], [42, 0.5], [52, 0.4], [62, 0.28], [72, 0.14],
  [80, 0.0], [86, 0.06], [94, 0.14], [104, 0.12], [116, -0.1], [135, -0.42], [155, -0.6], [180, -0.66]]);

/* ====================================================================== */
/*  Construction de la tête                                               */
/* ====================================================================== */

interface HeadBuild {
  geometry: THREE.BufferGeometry;
  hair: Float32Array;
  brow: Float32Array;
  mustache: Float32Array;
  nose: Float32Array;
  lips: Float32Array;
}

function buildHead(params: PortraitParams): HeadBuild {
  const ROWS = 168, COLS = 176;
  const asym = params.asymmetry;

  const grid = makeGrid(ROWS, COLS, (j, i) => {
    const y = Y_BOTTOM + ((Y_TOP - Y_BOTTOM) * j) / ROWS;
    const sec = sectionAt(y);
    if (j === 0) return [0, y, (sec.f - sec.b) * 0.5];
    if (j === ROWS) return [0, y, 0];
    const tau = (i / COLS) * Math.PI * 2;
    const s = Math.sin(tau), c = -Math.cos(tau);
    const e = 2 / sec.n;
    const xu = Math.sign(s) * Math.pow(Math.abs(s), e);
    const zu = Math.sign(c) * Math.pow(Math.abs(c), e);
    return [sec.a * xu, y, zu > 0 ? sec.f * zu : sec.b * zu];
  }, 16, 20);

  const geo = gridGeometry(grid);
  orientOutward(geo, Math.floor(ROWS * 0.6) * (COLS + 1) + Math.floor(COLS / 2), [0, 0, 1]);
  fixSeamNormals(geo, ROWS, COLS);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const hair = new Float32Array(count);
  const brow = new Float32Array(count);
  const mustache = new Float32Array(count);
  const nose = new Float32Array(count);
  const lips = new Float32Array(count);
  const thickness = new Float32Array(count);

  const skin = new THREE.Color(params.skinColor);
  const lipC = new THREE.Color(params.lipColor);
  const dark = new THREE.Color(params.skinColor).multiplyScalar(0.55);
  const scalp = new THREE.Color(params.skinColor).multiplyScalar(0.32);
  const nostrilC = new THREE.Color("#120806");
  const tmp = new THREE.Color();
  const sample = newSample();

  const newPos = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    const nx = nor.getX(v), ny = nor.getY(v), nz = nor.getZ(v);

    const sec = sectionAt(y);
    const zn = z > 0 && sec.f > 0.01 ? z / sec.f : 0;
    sampleFace(x, y, zn, asym, sample);

    // asymétrie légère et irrégularités organiques
    const organic = (fbm(x * 2.2 + 3, y * 2.2, z * 2.2, 3) - 0.5) * 0.028;
    const shear = asym.skullShear * y;
    const disp = sample.disp + organic;

    newPos[v * 3] = x + nx * disp + shear;
    newPos[v * 3 + 1] = y + ny * disp;
    newPos[v * 3 + 2] = z + nz * disp;

    // ---- masque des cheveux ----
    const az = (Math.atan2(Math.abs(x), z) * 180) / Math.PI;
    const jitter = (fbm(x * 9, y * 9, z * 9, 2) - 0.5) * 0.03;
    const hl = hairline(az) + jitter;
    const hm = smoothstep(-0.015, 0.03, y - hl);
    hair[v] = hm;
    thickness[v] = smoothstep(0.0, 0.11, y - hl);
    brow[v] = sample.brow;
    mustache[v] = sample.mustache;
    nose[v] = sample.noseRegion;
    lips[v] = sample.lipRegion;

    // ---- couleur de peau ----
    tmp.copy(skin);
    tmp.lerp(dark, 0.55 * sample.eyeSocketShade);
    tmp.lerp(dark, 0.7 * sample.eyeRim);
    tmp.lerp(lipC, sample.lips * 0.95);
    tmp.lerp(dark, 0.7 * sample.mouthLine);
    tmp.lerp(nostrilC, 0.9 * sample.nostril);
    tmp.lerp(dark, params.showStubble ? 0.4 * sample.stubble : 0);
    tmp.lerp(scalp, 0.85 * hm);
    // très léger dégradé : joues et front un peu plus clairs
    const glow = 1 + 0.12 * g2(x, y - 0.35, 0.4, 0.3) + 0.08 * g2(Math.abs(x) - 0.42, y + 0.05, 0.2, 0.15);
    colors[v * 3] = tmp.r * glow;
    colors[v * 3 + 1] = tmp.g * glow;
    colors[v * 3 + 2] = tmp.b * glow;
  }
  pos.array.set(newPos);
  pos.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  fixSeamNormals(geo, ROWS, COLS);
  // pôles : normales verticales
  const n2 = geo.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i <= COLS; i++) {
    n2.setXYZ(i, 0, -1, 0);
    n2.setXYZ(ROWS * (COLS + 1) + i, 0, 1, 0);
  }
  n2.needsUpdate = true;
  geo.setAttribute("aThick", new THREE.BufferAttribute(thickness, 1));
  geo.computeBoundingSphere();
  return { geometry: geo, hair, brow, mustache, nose, lips };
}

/* ---- découpage du maillage de la tête en régions / coques ---- */

function subMesh(base: THREE.BufferGeometry, tris: number[]): THREE.BufferGeometry {
  const map = new Map<number, number>();
  const order: number[] = [];
  const idx: number[] = [];
  for (const v of tris) {
    let m = map.get(v);
    if (m === undefined) { m = order.length; map.set(v, m); order.push(v); }
    idx.push(m);
  }
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv", "color"] as const) {
    const a = base.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const arr = new Float32Array(order.length * a.itemSize);
    order.forEach((src, k) => {
      for (let c = 0; c < a.itemSize; c++) arr[k * a.itemSize + c] = a.array[src * a.itemSize + c];
    });
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  out.setIndex(idx);
  out.computeBoundingSphere();
  return out;
}

function trianglesWhere(base: THREE.BufferGeometry, ok: (a: number, b: number, c: number) => boolean): { kept: number[]; rest: number[] } {
  const idx = base.index as THREE.BufferAttribute;
  const kept: number[] = [];
  const rest: number[] = [];
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    if (ok(a, b, c)) kept.push(a, b, c); else rest.push(a, b, c);
  }
  return { kept, rest };
}

/** Coque fine (cheveux, sourcils, moustache) décalée le long des normales de la tête. */
function makeShell(
  base: THREE.BufferGeometry,
  mask: Float32Array,
  threshold: number,
  thick: (v: number) => number,
): THREE.BufferGeometry {
  const { kept } = trianglesWhere(base, (a, b, c) => mask[a] > threshold && mask[b] > threshold && mask[c] > threshold);
  const g = subMesh(base, kept);
  // reconstruction des indices d'origine pour lire le masque : on relit via la position d'origine
  // (les sommets sont recopiés dans le même ordre que `kept`)
  const seen = new Map<number, number>();
  const order: number[] = [];
  for (const v of kept) if (!seen.has(v)) { seen.set(v, order.length); order.push(v); }
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = g.attributes.normal as THREE.BufferAttribute;
  order.forEach((src, k) => {
    const t = thick(src);
    p.setXYZ(k, p.getX(k) + n.getX(k) * t, p.getY(k) + n.getY(k) * t, p.getZ(k) + n.getZ(k) * t);
  });
  p.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}

/* ====================================================================== */
/*  Oreilles, yeux, cou, épaules                                          */
/* ====================================================================== */

function buildEarGeometry(side: 1 | -1, params: PortraitParams): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 44, 36);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  const skin = new THREE.Color(params.skinColor).multiplyScalar(1.05);
  const inner = new THREE.Color(params.skinColor).lerp(new THREE.Color("#3a1f1a"), 0.35);
  for (let i = 0; i < p.count; i++) {
    const nx = p.getX(i), ny = p.getY(i), nz = p.getZ(i);
    // profil : oreille plus large en haut qu'au lobe
    const wide = 0.72 + 0.28 * smoothstep(-0.9, 0.5, ny);
    let x = 0.052 * nx;
    const y = 0.245 * ny;
    const z = 0.135 * nz * wide - 0.01;
    // conque en creux + hélix en relief sur la face externe
    const r = Math.hypot(ny / 1.0, nz / 1.0);
    if (nx > 0) {
      const conch = 0.05 * Math.exp(-((ny - 0.05) * (ny - 0.05) / 0.16 + (nz + 0.1) * (nz + 0.1) / 0.18));
      const helix = 0.018 * smoothstep(0.55, 0.85, r) * (1 - smoothstep(0.9, 1.0, r));
      x = x - conch * nx + helix;
    }
    // lobe : plus épais et sans creux
    x += 0.012 * (1 - smoothstep(-1, -0.55, ny)) * Math.max(0, nx);
    p.setXYZ(i, side * x, y, z);
    const cc = nx > 0 && Math.hypot(ny - 0.05, nz + 0.1) < 0.45 ? inner : skin;
    col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

function superellipseSection(a: number, front: number, back: number, n: number, t: number, zc: number): [number, number] {
  const s = Math.sin(t), c = -Math.cos(t);
  const e = 2 / n;
  const xu = Math.sign(s) * Math.pow(Math.abs(s), e);
  const zu = Math.sign(c) * Math.pow(Math.abs(c), e);
  return [a * xu, zc + (zu > 0 ? front * zu : back * zu)];
}

function buildNeckGeometry(params: PortraitParams): THREE.BufferGeometry {
  const ROWS = 36, COLS = 64;
  const y0 = -0.5, y1 = -1.8;
  const grid = makeGrid(ROWS, COLS, (j, i) => {
    const k = j / ROWS;
    const y = lerp(y0, y1, k);
    const rx = lerp(0.4, 0.42, smoothstep(0, 0.6, k)) + 0.1 * smoothstep(0.6, 1, k);
    const rz = lerp(0.39, 0.44, k);
    const zc = lerp(-0.06, -0.2, k);
    const [x, z] = superellipseSection(rx, rz, rz, 2.2, (i / COLS) * Math.PI * 2, zc);
    return [x, y, z];
  }, 4, 4);
  const geo = gridGeometry(grid);
  orientOutward(geo, Math.floor(ROWS / 2) * (COLS + 1) + Math.floor(COLS / 2), [0, 0, 1]);
  fixSeamNormals(geo, ROWS, COLS);
  const skin = new THREE.Color(params.skinColor).multiplyScalar(0.9);
  const dark = new THREE.Color(params.skinColor).multiplyScalar(0.55);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    tmp.copy(skin).lerp(dark, smoothstep(-0.55, -1.0, y) * 0.6); // ombre sous la mâchoire
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

const T_W = pchip([[-1.55, 0.44], [-1.7, 0.66], [-1.85, 1.0], [-2.0, 1.34], [-2.15, 1.62], [-2.3, 1.76],
  [-2.5, 1.8], [-2.8, 1.68], [-3.2, 1.52], [-3.7, 1.42]]);
const T_F = pchip([[-1.55, 0.4], [-1.85, 0.46], [-2.2, 0.62], [-2.6, 0.7], [-3.7, 0.72]]);
const T_B = pchip([[-1.55, 0.3], [-1.85, 0.42], [-2.2, 0.6], [-2.6, 0.62], [-3.7, 0.58]]);
const T_ZC = -0.12;

function torsoFrontZ(x: number, y: number): number {
  const w = T_W(y);
  const k = clamp01(Math.abs(x) / w);
  return T_ZC + T_F(y) * Math.pow(Math.max(0, 1 - Math.pow(k, 2.6)), 1 / 2.6);
}

function buildTorsoGeometry(): THREE.BufferGeometry {
  const ROWS = 56, COLS = 96;
  const y0 = -1.55, y1 = -3.7;
  const grid = makeGrid(ROWS, COLS, (j, i) => {
    const y = lerp(y0, y1, j / ROWS);
    if (j === ROWS) return [0, y, T_ZC];
    return ((): Vec3 => {
      const [x, z] = superellipseSection(T_W(y), T_F(y), T_B(y), 2.6, (i / COLS) * Math.PI * 2, T_ZC);
      return [x, y, z];
    })();
  }, 6, 6);
  const geo = gridGeometry(grid);
  orientOutward(geo, Math.floor(ROWS * 0.3) * (COLS + 1) + Math.floor(COLS / 2), [0, 0, 1]);
  fixSeamNormals(geo, ROWS, COLS);
  return geo;
}

function buildTieGeometry(): THREE.BufferGeometry {
  // nœud + lame qui épouse le torse
  const ROWS = 40, COLS = 10;
  const yTop = -1.58, yBot = -3.35;
  const halfW = (t: number): number => {
    if (t < 0.12) return lerp(0.1, 0.13, t / 0.12);       // nœud
    if (t < 0.2) return lerp(0.13, 0.06, (t - 0.12) / 0.08); // pincement
    if (t < 0.9) return lerp(0.06, 0.17, (t - 0.2) / 0.7);
    return lerp(0.17, 0.0, (t - 0.9) / 0.1);                 // pointe
  };
  const grid = makeGrid(ROWS, COLS, (j, i) => {
    const t = j / ROWS;
    const y = lerp(yTop, yBot, t);
    const x = (i / COLS - 0.5) * 2 * halfW(t);
    const knot = t < 0.16 ? 0.045 * Math.sin((t / 0.16) * Math.PI) : 0;
    const edge = 1 - Math.pow(Math.abs(i / COLS - 0.5) * 2, 2);
    return [x, y, torsoFrontZ(x, y) + 0.018 + knot * edge + 0.012 * edge];
  }, 1, 1);
  const geo = gridGeometry(grid);
  orientOutward(geo, Math.floor(ROWS * 0.5) * (COLS + 1) + Math.floor(COLS / 2), [0, 0, 1]);
  return geo;
}

function buildCollarWing(side: 1 | -1): THREE.BufferGeometry {
  const N = 14;
  const P1: Vec3 = [side * 0.07, -1.24, 0.3];
  const P2: Vec3 = [side * 0.46, -1.2, -0.02];
  const P3: Vec3 = [side * 0.56, -1.74, 0.34];
  const positions: number[] = [];
  const idx: number[] = [];
  const vid = (a: number, b: number): number => (a * (a + 1)) / 2 + b;
  for (let a = 0; a <= N; a++) {
    for (let b = 0; b <= a; b++) {
      const s = b / N, t = (a - b) / N;
      const r = 1 - s - t;
      const px = P1[0] * r + P2[0] * s + P3[0] * t;
      const py = P1[1] * r + P2[1] * s + P3[1] * t;
      const pz = P1[2] * r + P2[2] * s + P3[2] * t + 0.05 * Math.sin(Math.PI * Math.min(1, (s + t) * 1.4)) * (1 - t * 0.6);
      positions.push(px, py, pz);
    }
  }
  for (let a = 0; a < N; a++) {
    for (let b = 0; b <= a; b++) {
      idx.push(vid(a, b), vid(a + 1, b), vid(a + 1, b + 1));
      if (b < a) idx.push(vid(a, b), vid(a + 1, b + 1), vid(a, b + 1));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ====================================================================== */
/*  Matériaux                                                             */
/* ====================================================================== */

interface Materials {
  skin: THREE.MeshPhysicalMaterial;
  nose: THREE.MeshPhysicalMaterial;
  lips: THREE.MeshPhysicalMaterial;
  hair: THREE.MeshStandardMaterial;
  brow: THREE.MeshStandardMaterial;
  eye: THREE.MeshPhysicalMaterial;
  shirt: THREE.MeshStandardMaterial;
  tie: THREE.MeshPhysicalMaterial;
}

function createMaterials(params: PortraitParams): Materials {
  const pores = createNoiseTexture(256, 11, 0.55, [16, 32, 64]);
  pores.repeat.set(9, 12);
  const skin = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.6,
    roughnessMap: pores,
    bumpMap: pores,
    bumpScale: 0.6,
    metalness: 0,
    sheen: 0.55,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color("#8a5a44"),
    clearcoat: 0.1,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.4,
  });
  const nose = skin.clone();
  nose.roughness = 0.45;
  nose.clearcoat = 0.22;
  const lips = skin.clone();
  lips.roughness = 0.42;
  lips.clearcoat = 0.25;
  lips.clearcoatRoughness = 0.35;

  const curls = createCurlTexture(128, 10, 5);
  curls.repeat.set(26, 22);
  const hair = new THREE.MeshStandardMaterial({
    color: new THREE.Color(params.hairColor),
    roughness: 0.92,
    roughnessMap: curls,
    bumpMap: curls,
    bumpScale: 3.2,
    metalness: 0,
    envMapIntensity: 0.25,
  });
  const browTex = createCurlTexture(64, 14, 21);
  browTex.repeat.set(10, 3);
  const brow = new THREE.MeshStandardMaterial({
    color: new THREE.Color(params.browColor),
    roughness: 0.9,
    bumpMap: browTex,
    bumpScale: 2.0,
    envMapIntensity: 0.2,
  });

  const eye = new THREE.MeshPhysicalMaterial({
    map: createEyeTexture(params.irisColor, params.scleraColor),
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 0.9,
  });

  const weave = createNoiseTexture(128, 31, 0.6, [48, 64]);
  weave.repeat.set(14, 14);
  const shirt = new THREE.MeshStandardMaterial({
    color: new THREE.Color(params.shirtColor),
    roughness: 0.82,
    roughnessMap: weave,
    bumpMap: weave,
    bumpScale: 0.6,
    envMapIntensity: 0.3,
    side: THREE.DoubleSide,
  });
  const tie = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(params.tieColor),
    roughness: 0.36,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color("#5b5f6b"),
    clearcoat: 0.25,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.6,
  });
  return { skin, nose, lips, hair, brow, eye, shirt, tie };
}

/* ====================================================================== */
/*  Assemblage                                                            */
/* ====================================================================== */

function meshOf(geo: THREE.BufferGeometry, mat: THREE.Material, name: string, shadows = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

export function disposeObject3D(root: THREE.Object3D): void {
  const seen = new Set<THREE.Texture>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (!mat) return;
    for (const mm of Array.isArray(mat) ? mat : [mat]) {
      for (const v of Object.values(mm)) {
        if (v instanceof THREE.Texture && !seen.has(v)) { seen.add(v); v.dispose(); }
      }
      mm.dispose();
    }
  });
}

export function createPersonPortraitModel(overrides?: PortraitParamOverrides): PortraitModel {
  const params: PortraitParams = {
    ...DEFAULT_PORTRAIT_PARAMS,
    ...overrides,
    asymmetry: { ...DEFAULT_PORTRAIT_PARAMS.asymmetry, ...(overrides?.asymmetry ?? {}) },
  };
  const mats = createMaterials(params);

  const root = new THREE.Group();
  root.name = "PersonPortrait";
  const head = new THREE.Group(); head.name = "Head";
  const face = new THREE.Group(); face.name = "Face";
  const eyes = new THREE.Group(); eyes.name = "Eyes";
  const brows = new THREE.Group(); brows.name = "Eyebrows";
  const nose = new THREE.Group(); nose.name = "Nose";
  const mouth = new THREE.Group(); mouth.name = "Mouth";
  const ears = new THREE.Group(); ears.name = "Ears";
  const hair = new THREE.Group(); hair.name = "Hair";
  const neck = new THREE.Group(); neck.name = "Neck";
  const shoulders = new THREE.Group(); shoulders.name = "Shoulders";
  root.add(head, face, eyes, brows, nose, mouth, ears, hair, neck, shoulders);

  /* --- tête : régions nez / lèvres / peau --- */
  const hb = buildHead(params);
  const base = hb.geometry;
  const lipTris = trianglesWhere(base, (a, b, c) => (hb.lips[a] + hb.lips[b] + hb.lips[c]) / 3 > 0.5);
  const noseTris = trianglesWhere(
    { ...base, index: base.index } as THREE.BufferGeometry,
    () => false,
  );
  void noseTris;
  const idx = base.index as THREE.BufferAttribute;
  const restForNose: number[] = [];
  for (let t = 0; t < lipTris.rest.length; t += 3) restForNose.push(lipTris.rest[t], lipTris.rest[t + 1], lipTris.rest[t + 2]);
  const nosePick: number[] = [];
  const skinPick: number[] = [];
  for (let t = 0; t < restForNose.length; t += 3) {
    const a = restForNose[t], b = restForNose[t + 1], c = restForNose[t + 2];
    if ((hb.nose[a] + hb.nose[b] + hb.nose[c]) / 3 > 0.5) nosePick.push(a, b, c); else skinPick.push(a, b, c);
  }
  void idx;
  head.add(meshOf(subMesh(base, skinPick), mats.skin, "Skull"));
  nose.add(meshOf(subMesh(base, nosePick), mats.nose, "NoseSurface"));
  mouth.add(meshOf(subMesh(base, lipTris.kept), mats.lips, "Lips"));

  /* --- cheveux, sourcils, moustache : coques fines --- */
  const noise = (v: number): number => {
    const p = base.attributes.position as THREE.BufferAttribute;
    return fbm(p.getX(v) * 26, p.getY(v) * 26, p.getZ(v) * 26, 2);
  };
  const thick = base.attributes.aThick as THREE.BufferAttribute;
  hair.add(meshOf(
    makeShell(base, hb.hair, 0.55, (v) => (0.012 + 0.07 * thick.getX(v)) * (0.8 + 0.4 * noise(v))),
    mats.hair, "HairShell",
  ));
  brows.add(meshOf(makeShell(base, hb.brow, 0.5, (v) => 0.011 * (0.7 + 0.6 * noise(v)) * hb.brow[v]), mats.brow, "Brows"));
  if (params.showMustache) {
    face.add(meshOf(makeShell(base, hb.mustache, 0.45, (v) => 0.011 * (0.7 + 0.6 * noise(v)) * hb.mustache[v]), mats.brow, "Mustache"));
  }

  /* --- yeux --- */
  const eyeR = 0.125;
  const eyeGeo = new THREE.SphereGeometry(eyeR, 56, 40);
  for (const s of [1, -1] as const) {
    const cx = s * EYE_CX;
    const zc = baseZ(cx, EYE_CY) - 0.045 + 0.02 - eyeR;
    const eye = meshOf(eyeGeo, mats.eye, s === 1 ? "EyeRight" : "EyeLeft", false);
    eye.position.set(cx, EYE_CY, zc);
    eyes.add(eye);
  }

  /* --- oreilles --- */
  for (const s of [1, -1] as const) {
    const ear = meshOf(buildEarGeometry(s, params), mats.skin, s === 1 ? "EarRight" : "EarLeft");
    const sec = sectionAt(-0.06);
    ear.position.set(s * (sec.a * 0.96), -0.06, -0.03);
    ear.rotation.set(0, s * 0.3, s * -0.18);
    ear.rotation.order = "YXZ";
    ears.add(ear);
  }

  /* --- cou et buste --- */
  neck.add(meshOf(buildNeckGeometry(params), mats.skin, "NeckSurface"));
  if (params.showShoulders) {
    shoulders.add(meshOf(buildTorsoGeometry(), mats.shirt, "Torso"));
    const band = new THREE.CylinderGeometry(1, 1, 0.3, 56, 1, true);
    band.scale(0.5, 1, 0.47);
    const bandMesh = meshOf(band, mats.shirt, "CollarBand");
    bandMesh.position.set(0, -1.32, -0.15);
    shoulders.add(bandMesh);
    shoulders.add(meshOf(buildCollarWing(1), mats.shirt, "CollarRight"));
    shoulders.add(meshOf(buildCollarWing(-1), mats.shirt, "CollarLeft"));
    shoulders.add(meshOf(buildTieGeometry(), mats.tie, "Tie"));
  }

  return { root, dispose: () => disposeObject3D(root) };
}
