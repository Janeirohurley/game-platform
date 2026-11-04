"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree, type CanvasProps } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";

// La scène autour du plateau : une table de jeu en bois dans une pièce
// sombre, éclairée par une lampe, avec des ombres et un peu de poussière
// dans la lumière.
//
// Elle remplace la grille `gridHelper` (une grille de débogage de three.js)
// et la planche de bois découpée au format de la maquette : ni l'une ni
// l'autre n'avaient de bord crédible. Ici la table est ronde, elle déborde
// largement de ce que la caméra peut voir (distance max 40) et ses bords se
// perdent dans l'ombre et le brouillard de la pièce — on joue À une table.
//
// Aucune ressource externe : le bois est généré en canvas (déterministe) et
// la poussière est dessinée à la main, donc rien à télécharger.

/** Props de <Canvas> pour un rendu net, y compris sur écran 4K. */
export const LUDO_CANVAS_PROPS: Partial<CanvasProps> = {
  // Ombres projetées par les pions et le dé sur la table. "percentage"
  // (PCFShadowMap) remplace les anciennes ombres douces : three 0.186 a
  // retiré PCFSoftShadowMap, que `shadows: true` sélectionnait.
  shadows: "percentage",
  // Densité de pixels : jusqu'à 2x. Sans ça R3F reste à 1x et le plateau est
  // flou sur un écran 4K / Retina.
  dpr: [1, 2],
  gl: { antialias: true, powerPreference: "high-performance" },
  // near 0.5 au lieu de 0.1 : bien plus de précision de profondeur pour les
  // couches fines du plateau (cases, étoiles, cadres), donc plus de
  // scintillement (z-fighting) à distance.
  camera: { position: [0, 16, 16], fov: 60, near: 0.5, far: 200 },
  // Le plateau se manipule au doigt (OrbitControls) : on neutralise les
  // gestes natifs du navigateur sur le canvas, sinon un glissement de caméra
  // déclenche un scroll, un zoom de page ou le « tirer pour rafraîchir ».
  onCreated: ({ gl }) => {
    gl.domElement.style.touchAction = "none";
  },
};

const TABLE_RADIUS = 22;
/** Dessus de la table : juste sous le socle (dont le dessous est à -0.15). */
const TABLE_TOP = -0.18;
const ROOM = "#0a0810";

/** Générateur pseudo-aléatoire déterministe (le bois est le même à chaque rendu). */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Parquet de 8 planches, avec veines, nœuds et joints. Les veines ont un
 * nombre entier de périodes sur la largeur : la texture se répète sans
 * couture visible.
 */
function makeWoodTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 2048;
  const planks = 8;
  const h = size / planks;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return new THREE.CanvasTexture(canvas);
  const rnd = mulberry32(1337);

  for (let p = 0; p < planks; p += 1) {
    const y0 = p * h;
    const light = 21 + rnd() * 7;
    g.fillStyle = `hsl(${22 + rnd() * 5} ${40 + rnd() * 8}% ${light}%)`;
    g.fillRect(0, y0, size, h);

    for (let i = 0; i < 80; i += 1) {
      const y = y0 + rnd() * h;
      const amp = 2 + rnd() * 6;
      const k1 = 2 + Math.floor(rnd() * 6);
      const k2 = 5 + Math.floor(rnd() * 8);
      const phase = rnd() * Math.PI * 2;
      const dark = rnd() < 0.6;
      g.strokeStyle = dark
        ? `rgba(22,10,4,${0.06 + rnd() * 0.14})`
        : `rgba(150,92,48,${0.05 + rnd() * 0.1})`;
      g.lineWidth = 0.6 + rnd() * 2;
      g.beginPath();
      for (let x = 0; x <= size; x += 16) {
        const yy =
          y +
          Math.sin((x / size) * Math.PI * 2 * k1 + phase) * amp +
          Math.sin((x / size) * Math.PI * 2 * k2 + phase * 1.7) * amp * 0.3;
        if (x === 0) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }

    if (rnd() < 0.55) {
      const kx = rnd() * size;
      const ky = y0 + h * (0.25 + rnd() * 0.5);
      const grad = g.createRadialGradient(kx, ky, 2, kx, ky, 26 + rnd() * 18);
      grad.addColorStop(0, "rgba(20,8,3,0.65)");
      grad.addColorStop(0.5, "rgba(60,28,12,0.25)");
      grad.addColorStop(1, "rgba(60,28,12,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(kx, ky, 70, 26, 0, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = "rgba(6,3,1,0.9)";
    g.fillRect(0, y0, size, 3);
    g.fillStyle = "rgba(255,205,150,0.07)";
    g.fillRect(0, y0 + 3, size, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = maxAnisotropy;
  const srgb = (THREE as unknown as { SRGBColorSpace?: string }).SRGBColorSpace;
  if (srgb) (texture as unknown as { colorSpace: string }).colorSpace = srgb;
  texture.needsUpdate = true;
  return texture;
}

function Table() {
  const gl = useThree((state) => state.gl);
  const wood = useMemo(
    () => makeWoodTexture(gl.capabilities.getMaxAnisotropy()),
    [gl],
  );

  return (
    <group>
      {/* Plateau de la table. Cylindre : groupes 0 = tranche, 1 = dessus, 2 = dessous. */}
      <mesh position={[0, TABLE_TOP - 0.3, 0]} receiveShadow>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.6, 128]} />
        <meshStandardMaterial attach="material-0" color="#24130a" roughness={0.55} />
        <meshStandardMaterial attach="material-1" map={wood} roughness={0.48} metalness={0} />
        <meshStandardMaterial attach="material-2" color="#120a05" roughness={0.9} />
      </mesh>

      {/* Chant arrondi de la table. */}
      <mesh position={[0, TABLE_TOP, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TABLE_RADIUS - 0.04, 0.2, 20, 160]} />
        <meshStandardMaterial color="#2c170b" roughness={0.4} />
      </mesh>

      {/* Filet de laiton incrusté près du bord. */}
      <mesh position={[0, TABLE_TOP + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[TABLE_RADIUS - 1.7, TABLE_RADIUS - 1.55, 160]} />
        <meshStandardMaterial color="#c9a05a" roughness={0.32} metalness={0.55} />
      </mesh>

      {/* Sol de la pièce : très sombre, avalé par le brouillard. */}
      <mesh position={[0, TABLE_TOP - 2.4, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[220, 64]} />
        <meshStandardMaterial color="#0d0a10" roughness={1} />
      </mesh>
    </group>
  );
}

/** Disque lumineux doux, pour que les grains de poussière soient ronds. */
function makeDotTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

/** Grains de poussière qui flottent lentement dans la lumière de la lampe. */
function Dust({ count = 90 }: { count?: number }) {
  const geometry = useRef<THREE.BufferGeometry>(null);
  const dot = useMemo(() => makeDotTexture(), []);
  const { positions, speeds } = useMemo(() => {
    const rnd = mulberry32(42);
    const p = new Float32Array(count * 3);
    const s = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const r = Math.sqrt(rnd()) * 15;
      const a = rnd() * Math.PI * 2;
      p[i * 3] = Math.cos(a) * r;
      p[i * 3 + 1] = 1 + rnd() * 9;
      p[i * 3 + 2] = Math.sin(a) * r;
      s[i] = 0.04 + rnd() * 0.08;
    }
    return { positions: p, speeds: s };
  }, [count]);

  useFrame((_, delta) => {
    const attribute = geometry.current?.getAttribute("position");
    if (!attribute) return;
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < count; i += 1) {
      let y = attribute.getY(i) + speeds[i] * dt;
      if (y > 10) y = 1;
      attribute.setY(i, y);
      attribute.setX(i, attribute.getX(i) + Math.sin(y * 1.7 + i) * 0.0015);
    }
    attribute.needsUpdate = true;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry ref={geometry}>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        map={dot}
        color="#ffe2b0"
        size={0.16}
        sizeAttenuation
        transparent
        opacity={0.4}
        depthWrite={false}
        fog={false}
      />
    </points>
  );
}

/**
 * Scène complète : pièce, table, lumières, ombres, poussière. À poser dans
 * <Canvas> à la place des lumières ad hoc et de l'ancien `LudoArena`.
 * `playerCount` est conservé pour compatibilité : la même table convient
 * aux deux plateaux.
 */
export default function LudoScene({}: { playerCount?: number }) {
  return (
    <>
      <color attach="background" args={[ROOM]} />
      <fog attach="fog" args={[ROOM, 42, 95]} />

      {/* Lumière d'ambiance chaude, remplissage froid venu d'en bas. */}
      <ambientLight intensity={0.45} color="#ffe8cf" />
      <hemisphereLight args={["#fff1dd", "#1a1424", 0.55]} />

      {/* Lumière principale : c'est elle qui projette les ombres. */}
      <directionalLight
        position={[9, 18, 7]}
        intensity={1.25}
        color="#fff0d8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />

      {/* Lampe suspendue : un halo chaud sur la table, sans atténuation avec
          la distance (decay 0), donc le même rendu sur toutes les versions
          de three. */}
      <spotLight
        position={[0, 24, 0]}
        angle={0.62}
        penumbra={1}
        intensity={1.1}
        decay={0}
        color="#ffd9a8"
      />

      <Table />

      {/* Ombre de contact douce du socle et des pièces sur le bois. */}
      <ContactShadows
        position={[0, TABLE_TOP + 0.012, 0]}
        opacity={0.6}
        scale={24}
        blur={2.4}
        far={3}
        resolution={1024}
        color="#000000"
      />

      <Dust />
    </>
  );
}
