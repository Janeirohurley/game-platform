"use client";

/**
 * PersonPortrait3D
 * -----------------------------------------------------------------------------
 * A real, volumetric 3D portrait rendered with Three.js.
 *
 * - NOT an <img>, NOT a billboard, NOT a textured plane, NOT sprites.
 * - The head is actual deformed BufferGeometry that the camera orbits.
 * - Proportions are driven by the reference photos (oval skull, tapered jaw,
 *   rounded chin, medium straight nose, almond eyes, buzz-cut hair, mustache,
 *   dark-brown skin, square shoulders).
 * - When `model` is provided it loads a real .glb/.gltf and skips the procedural
 *   build, so you can upgrade to a scanned model with zero refactor.
 *
 * Requires: three  (and @types/three for TS)
 *   npm i three
 *   npm i -D @types/three
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export type PersonPortrait3DProps = {
  /** Optional real model. When set, the procedural head is skipped. */
  model?: string;
  /** Slowly spin the portrait. */
  autoRotate?: boolean;
  /** Auto-rotation speed factor (0.2 ~ gentle). */
  rotationSpeed?: number;
  /** Allow mouse-wheel / pinch zoom. */
  enableZoom?: boolean;
  /** Allow orbit dragging. */
  enableRotation?: boolean;
  /** Distance of the camera from the head. */
  cameraDistance?: number;
  /** Transparent canvas (default) or a subtle solid studio backdrop. */
  background?: "transparent" | "solid";
  /** Optional class for the wrapper div. */
  className?: string;
};

/* -------------------------------------------------------------------------- */
/*  Small math helpers for vertex sculpting                                   */
/* -------------------------------------------------------------------------- */

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Rising ramp from a -> b. */
function ramp(value: number, a: number, b: number): number {
  return smoothstep(a, b, value);
}

/** Smooth peak centered in [a, b], 0 outside. */
function bump(value: number, a: number, b: number): number {
  const c = (a + b) / 2;
  const h = (b - a) / 2;
  const t = Math.max(0, 1 - Math.abs(value - c) / h);
  return t * t * (3 - 2 * t);
}

/* -------------------------------------------------------------------------- */
/*  Geometry construction                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Sculpt a head from a subdivided icosahedron by displacing every vertex
 * according to the facial region it falls into. Face looks toward +Z, up is +Y.
 */
function sculptHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 24);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const { x, y, z } = v;
    const front = z; // -1 (back) .. 1 (face)

    // Base ellipsoid: narrower than tall, moderate depth.
    let px = x * 0.7;
    let py = y * 0.96;
    let pz = z * 0.82;

    // Jaw taper: lower face narrows toward the chin.
    if (y < 0) {
      const t = Math.min(1, -y / 0.9);
      px *= 1 - 0.3 * t * t;
    }

    // Chin projection (rounded, forward).
    const chin = ramp(-y, 0.35, 0.75) * ramp(front, 0.2, 0.9);
    pz += 0.11 * chin;
    py -= 0.05 * chin;

    // Cheekbones: high, defined but not sharp.
    const cheek =
      bump(y, 0.04, 0.22) * ramp(front, 0.1, 0.8) * Math.min(1, Math.abs(x) / 0.5);
    px += 0.06 * cheek * Math.sign(x);
    pz += 0.04 * cheek;

    // Brow ridge (subtle).
    const brow = bump(y, 0.16, 0.3) * ramp(front, 0.55, 0.95);
    pz += 0.05 * brow;

    // Eye sockets: gentle indentation around each eye center.
    const dyEye = y - 0.06;
    const socketL = Math.exp(-((x - 0.27) ** 2 / 0.02 + dyEye ** 2 / 0.02));
    const socketR = Math.exp(-((x + 0.27) ** 2 / 0.02 + dyEye ** 2 / 0.02));
    const socket = Math.max(socketL, socketR) * ramp(front, 0.5, 1);
    pz -= 0.05 * socket;

    // Temples: slight narrowing.
    const temple = bump(y, 0.25, 0.5) * Math.min(1, Math.abs(x) / 0.6);
    px *= 1 - 0.05 * temple;

    // Back skull slightly longer for a natural cranium.
    if (front < 0) pz *= 1.03;

    pos.setXYZ(i, px, py, pz);
  }

  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Extract the subset of triangles whose centroid satisfies `keep`, returning a
 * fresh non-indexed geometry. Used to carve the hair cap out of a head shell.
 */
function extractRegion(
  source: THREE.BufferGeometry,
  keep: (cx: number, cy: number, cz: number) => boolean,
): THREE.BufferGeometry {
  const g = source.index ? source.toNonIndexed() : source.clone();
  const pos = g.attributes.position as THREE.BufferAttribute;
  const kept: number[] = [];

  for (let i = 0; i < pos.count; i += 3) {
    const ax = pos.getX(i);
    const ay = pos.getY(i);
    const az = pos.getZ(i);
    const bx = pos.getX(i + 1);
    const by = pos.getY(i + 1);
    const bz = pos.getZ(i + 1);
    const cx = pos.getX(i + 2);
    const cy = pos.getY(i + 2);
    const cz = pos.getZ(i + 2);
    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const mz = (az + bz + cz) / 3;
    if (keep(mx, my, mz)) {
      kept.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    }
  }

  g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(kept, 3));
  out.computeVertexNormals();
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Materials                                                                 */
/* -------------------------------------------------------------------------- */

function makeSkinMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#5c3a28"), // rich dark-brown complexion
    roughness: 0.72,
    metalness: 0.0,
    flatShading: false,
  });
}

function makeLipMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#6e3b30"),
    roughness: 0.5,
    metalness: 0.0,
  });
}

function makeHairMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#0c0b0d"), // near-black buzz cut
    roughness: 0.92,
    metalness: 0.0,
  });
}

function makeScleraMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#efeae1"),
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    metalness: 0.0,
  });
}

function makeIrisMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#2b1a10"),
    roughness: 0.35,
    metalness: 0.0,
  });
}

function makeClothMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#2b2f36"),
    roughness: 0.85,
    metalness: 0.0,
  });
}

/* -------------------------------------------------------------------------- */
/*  Portrait assembly                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Build the full procedural portrait as a single Group with the anatomical
 * sub-groups requested (Head / Face / Eyes / Eyebrows / Nose / Mouth / Ears /
 * Hair / Neck / Shoulders).
 */
function buildProceduralPortrait(): THREE.Group {
  const portrait = new THREE.Group();
  portrait.name = "PersonPortrait";

  const skin = makeSkinMaterial();

  /* ---- Head ---------------------------------------------------------- */
  const headGroup = new THREE.Group();
  headGroup.name = "Head";
  const headGeo = sculptHeadGeometry();
  const headMesh = new THREE.Mesh(headGeo, skin);
  headMesh.name = "HeadShell";
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  /* ---- Face (container for surface features) ------------------------- */
  const faceGroup = new THREE.Group();
  faceGroup.name = "Face";

  /* ---- Eyes ---------------------------------------------------------- */
  const eyesGroup = new THREE.Group();
  eyesGroup.name = "Eyes";
  const scleraMat = makeScleraMaterial();
  const irisMat = makeIrisMaterial();
  const pupilMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color("#050505"),
    roughness: 0.25,
  });
  const eyeballGeo = new THREE.SphereGeometry(0.1, 32, 24);
  const irisGeo = new THREE.SphereGeometry(0.045, 24, 16);
  const pupilGeo = new THREE.SphereGeometry(0.022, 16, 12);

  for (const side of [-1, 1] as const) {
    const eye = new THREE.Group();
    eye.position.set(0.27 * side, 0.07, 0.6);

    const eyeball = new THREE.Mesh(eyeballGeo, scleraMat);
    eye.add(eyeball);

    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(0, 0, 0.075);
    eye.add(iris);

    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(0, 0, 0.095);
    eye.add(pupil);

    // Upper eyelid: a thin skin cap that hoods the top of the eyeball.
    const lidGeo = new THREE.SphereGeometry(
      0.115,
      24,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.55,
    );
    const lid = new THREE.Mesh(lidGeo, skin);
    lid.position.set(0, 0.01, 0.0);
    lid.rotation.x = -0.35;
    eye.add(lid);

    eyesGroup.add(eye);
  }

  /* ---- Eyebrows ------------------------------------------------------ */
  const browsGroup = new THREE.Group();
  browsGroup.name = "Eyebrows";
  const browMat = makeHairMaterial();
  const browGeo = new THREE.CapsuleGeometry(0.028, 0.22, 6, 12);
  for (const side of [-1, 1] as const) {
    const brow = new THREE.Mesh(browGeo, browMat);
    brow.position.set(0.27 * side, 0.22, 0.72);
    brow.rotation.z = Math.PI / 2;
    brow.rotation.y = -0.15 * side;
    brow.rotation.x = 0.1;
    brow.scale.set(1, 1, 0.5);
    browsGroup.add(brow);
  }

  /* ---- Nose ---------------------------------------------------------- */
  const noseGroup = new THREE.Group();
  noseGroup.name = "Nose";

  const bridgeGeo = new THREE.CapsuleGeometry(0.05, 0.24, 8, 16);
  const bridge = new THREE.Mesh(bridgeGeo, skin);
  bridge.position.set(0, 0.06, 0.84);
  bridge.rotation.x = Math.PI / 2 + 0.25;
  bridge.scale.set(1, 1, 0.8);
  noseGroup.add(bridge);

  const tipGeo = new THREE.SphereGeometry(0.075, 24, 18);
  const tip = new THREE.Mesh(tipGeo, skin);
  tip.position.set(0, -0.08, 0.95);
  tip.scale.set(1, 0.9, 1.05);
  noseGroup.add(tip);

  const alaGeo = new THREE.SphereGeometry(0.05, 20, 14);
  for (const side of [-1, 1] as const) {
    const ala = new THREE.Mesh(alaGeo, skin);
    ala.position.set(0.06 * side, -0.09, 0.9);
    ala.scale.set(0.9, 0.8, 0.9);
    noseGroup.add(ala);
  }

  /* ---- Mouth (lips + mustache) --------------------------------------- */
  const mouthGroup = new THREE.Group();
  mouthGroup.name = "Mouth";
  const lipMat = makeLipMaterial();

  const upperLipGeo = new THREE.SphereGeometry(0.13, 28, 18);
  const upperLip = new THREE.Mesh(upperLipGeo, lipMat);
  upperLip.position.set(0, -0.29, 0.8);
  upperLip.scale.set(1.15, 0.28, 0.4);
  mouthGroup.add(upperLip);

  const lowerLipGeo = new THREE.SphereGeometry(0.13, 28, 18);
  const lowerLip = new THREE.Mesh(lowerLipGeo, lipMat);
  lowerLip.position.set(0, -0.36, 0.8);
  lowerLip.scale.set(1.05, 0.36, 0.42);
  mouthGroup.add(lowerLip);

  // Thin, well-groomed mustache following the upper lip.
  const mustacheMat = makeHairMaterial();
  const mustacheGeo = new THREE.CapsuleGeometry(0.03, 0.2, 6, 12);
  const mustache = new THREE.Mesh(mustacheGeo, mustacheMat);
  mustache.position.set(0, -0.24, 0.82);
  mustache.rotation.z = Math.PI / 2;
  mustache.scale.set(1, 1, 0.45);
  mouthGroup.add(mustache);

  /* ---- Ears ---------------------------------------------------------- */
  const earsGroup = new THREE.Group();
  earsGroup.name = "Ears";
  const earGeo = new THREE.IcosahedronGeometry(0.13, 3);
  // Squash into an ear-like disc.
  {
    const p = earGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) * 0.4, p.getY(i) * 1.05, p.getZ(i) * 0.75);
    }
    earGeo.computeVertexNormals();
  }
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(earGeo, skin);
    ear.position.set(0.68 * side, 0.03, 0.02);
    ear.rotation.y = -0.5 * side;
    ear.rotation.z = 0.15 * side;
    earsGroup.add(ear);
  }

  /* ---- Hair (buzz-cut shell over the scalp) -------------------------- */
  const hairGroup = new THREE.Group();
  hairGroup.name = "Hair";
  const hairGeo = extractRegion(
    headGeo,
    (cx, cy, cz) => cy > 0.3 || (cz < 0.15 && cy > -0.1),
  );
  const hairMesh = new THREE.Mesh(hairGeo, makeHairMaterial());
  hairMesh.scale.setScalar(1.02);
  hairMesh.position.y = 0.01;
  hairGroup.add(hairMesh);

  /* ---- Neck ---------------------------------------------------------- */
  const neckGroup = new THREE.Group();
  neckGroup.name = "Neck";
  const neckGeo = new THREE.CylinderGeometry(0.34, 0.4, 0.7, 32, 1, true);
  const neck = new THREE.Mesh(neckGeo, skin);
  neck.position.set(0, -0.95, -0.02);
  neckGroup.add(neck);

  /* ---- Shoulders / upper torso --------------------------------------- */
  const shouldersGroup = new THREE.Group();
  shouldersGroup.name = "Shoulders";
  const clothMat = makeClothMaterial();

  const shouldersGeo = new THREE.CapsuleGeometry(0.42, 1.35, 12, 24);
  const shoulders = new THREE.Mesh(shouldersGeo, clothMat);
  shoulders.position.set(0, -1.5, -0.05);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.scale.set(1, 1, 0.7);
  shouldersGroup.add(shoulders);

  const chestGeo = new THREE.SphereGeometry(0.55, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const chest = new THREE.Mesh(chestGeo, clothMat);
  chest.position.set(0, -1.75, 0.05);
  chest.scale.set(1.4, 1.1, 0.8);
  shouldersGroup.add(chest);

  /* ---- Compose hierarchy --------------------------------------------- */
  faceGroup.add(eyesGroup, browsGroup, noseGroup, mouthGroup);
  headGroup.add(faceGroup, earsGroup, hairGroup);
  portrait.add(headGroup, neckGroup, shouldersGroup);

  // Lift so the head sits near the orbit target.
  portrait.position.y = 0.35;
  return portrait;
}

/* -------------------------------------------------------------------------- */
/*  Disposal helpers                                                          */
/* -------------------------------------------------------------------------- */

function disposeMaterial(material: THREE.Material): void {
  const m = material as THREE.MeshStandardMaterial & THREE.MeshPhysicalMaterial;
  m.map?.dispose();
  m.normalMap?.dispose();
  m.roughnessMap?.dispose();
  m.metalnessMap?.dispose();
  m.aoMap?.dispose();
  m.emissiveMap?.dispose();
  material.dispose();
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach(disposeMaterial);
      } else if (material) {
        disposeMaterial(material);
      }
    }
  });
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export default function PersonPortrait3D({
  model,
  autoRotate = false,
  rotationSpeed = 0.2,
  enableZoom = true,
  enableRotation = true,
  cameraDistance = 5,
  background = "transparent",
  className,
}: PersonPortrait3DProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;

    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;

    /* ---- Renderer -------------------------------------------------- */
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: background === "transparent",
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace; // modern API
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    if (background === "transparent") {
      renderer.setClearColor(0x000000, 0);
    } else {
      renderer.setClearColor(0x14161b, 1);
    }
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";

    /* ---- Scene & Camera -------------------------------------------- */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0.15, cameraDistance);

    /* ---- Lighting (soft studio: key / fill / rim / ambient) -------- */
    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.4);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xdfe8ff, 0.9);
    fillLight.position.set(-4, 1, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 1.6);
    rimLight.position.set(-2, 3, -5);
    scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(0xbfd4ff, 0x2b241d, 0.35);
    scene.add(hemiLight);

    /* ---- Controls -------------------------------------------------- */
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = enableZoom;
    controls.enableRotate = enableRotation;
    controls.minDistance = 2.5;
    controls.maxDistance = 9;
    // Only a slight vertical range so the camera never flips over the head.
    controls.minPolarAngle = Math.PI * 0.32;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.target.set(0, 0.15, 0);
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = rotationSpeed * 5;
    controls.update();

    /* ---- Content: real .glb OR procedural head --------------------- */
    let portrait: THREE.Object3D | null = null;
    let gltfLoader: GLTFLoader | null = null;

    const frameObject = (object: THREE.Object3D): void => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      object.position.sub(center); // recenter on origin
      const scale = 2.4 / maxDim; // normalize height into view
      object.scale.setScalar(scale);
    };

    if (model) {
      gltfLoader = new GLTFLoader();
      gltfLoader.load(
        model,
        (gltf: GLTF) => {
          if (disposed) {
            disposeObject(gltf.scene);
            return;
          }
          portrait = gltf.scene;
          frameObject(portrait);
          scene.add(portrait);
        },
        undefined,
        () => {
          // On failure, fall back to the procedural head so the UI is never empty.
          if (disposed || portrait) return;
          portrait = buildProceduralPortrait();
          scene.add(portrait);
        },
      );
    } else {
      portrait = buildProceduralPortrait();
      scene.add(portrait);
    }

    /* ---- Resize ---------------------------------------------------- */
    const handleResize = (): void => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    /* ---- Render loop ----------------------------------------------- */
    const animate = (): void => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    /* ---- Cleanup --------------------------------------------------- */
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      if (portrait) {
        scene.remove(portrait);
        disposeObject(portrait);
      }
      scene.clear();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    model,
    autoRotate,
    rotationSpeed,
    enableZoom,
    enableRotation,
    cameraDistance,
    background,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", position: "relative" }}
    />
  );
}
