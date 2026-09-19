"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

type DiceColorPalette = {
  body?: THREE.ColorRepresentation;
  pip?: THREE.ColorRepresentation;
  edge?: THREE.ColorRepresentation;
  light?: THREE.ColorRepresentation;
};

interface DiceProps {
  className?: string;
  style?: CSSProperties;

  size?: number;

  value?: DiceValue;

  clickable?: boolean;

  autoRotate?: boolean;
  autoRotateSpeed?: number;

  rollDuration?: number;
  rollSpins?: number;

  rotationSpeed?: number;

  bodyColor?: THREE.ColorRepresentation;
  pipColor?: THREE.ColorRepresentation;

  roughness?: number;
  metalness?: number;
  clearcoat?: number;

  colorAnimation?: Partial<{
    enabled: boolean;
    duration: number;
    palettes: DiceColorPalette[];
  }>;

  camera?: Partial<{
    fov: number;
    distance: number;
    y: number;
  }>;

  lighting?: Partial<{
    ambient: number;
    key: number;
    rim: number;
  }>;

  onRollStart?: () => void;
  onRollEnd?: (value: DiceValue) => void;
}

interface FaceDefinition {
  value: DiceValue;

  normal: THREE.Vector3;

  u: THREE.Vector3;
  v: THREE.Vector3;

  pattern: Array<[number, number]>;
}

const FACE_PATTERNS: Record<DiceValue, Array<[number, number]>> = {
  1: [[0, 0]],

  2: [
    [-1, -1],
    [1, 1],
  ],

  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],

  4: [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ],

  5: [
    [-1, -1],
    [-1, 1],
    [0, 0],
    [1, -1],
    [1, 1],
  ],

  6: [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ],
};

const DEFAULT_PALETTE: DiceColorPalette = {
  body: "#f5f7fa",
  pip: "#0a0d12",
  edge: "#ffffff",
  light: "#ffffff",
};

export default function Dice({
  className,
  style,

  size = 2.5,

  value = 1,

  clickable = true,

  autoRotate = false,
  autoRotateSpeed = 0.35,

  rollDuration = 1000,
  rollSpins = 2,

  rotationSpeed = 0.006,

  bodyColor = "#f5f7fa",
  pipColor = "#0a0d12",

  roughness = 0.24,
  metalness = 0.02,
  clearcoat = 0.8,

  colorAnimation: colorAnimationOverrides,

  camera: cameraOverrides,
  lighting: lightingOverrides,

  onRollStart,
  onRollEnd,
}: DiceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo(
    () => ({
      size,

      value,

      clickable,

      autoRotate,
      autoRotateSpeed,

      rollDuration,
      rollSpins,

      rotationSpeed,

      bodyColor,
      pipColor,

      roughness,
      metalness,
      clearcoat,

      colorAnimation: {
        enabled: false,
        duration: 4500,
        palettes: [],

        ...colorAnimationOverrides,
      },

      camera: {
        fov: 32,
        distance: 7,
        y: 1.4,

        ...cameraOverrides,
      },

      lighting: {
        ambient: 1.5,
        key: 3.5,
        rim: 2,

        ...lightingOverrides,
      },
    }),
    [
      size,
      value,
      clickable,
      autoRotate,
      autoRotateSpeed,
      rollDuration,
      rollSpins,
      rotationSpeed,
      bodyColor,
      pipColor,
      roughness,
      metalness,
      clearcoat,
      colorAnimationOverrides,
      cameraOverrides,
      lightingOverrides,
    ],
  );

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let disposed = false;

    /* =========================================================
       RENDERER
       ========================================================= */

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.1;

    renderer.setClearColor(0x000000, 0);

    renderer.domElement.style.display = "block";

    renderer.domElement.style.width = "100%";

    renderer.domElement.style.height = "100%";

    renderer.domElement.style.touchAction = "none";

    host.appendChild(renderer.domElement);

    /* =========================================================
       SCENE
       ========================================================= */

    const scene = new THREE.Scene();

    /* =========================================================
       CAMERA
       ========================================================= */

    const camera = new THREE.PerspectiveCamera(options.camera.fov, 1, 0.1, 100);

    camera.position.set(0, options.camera.y, options.camera.distance);

    camera.lookAt(0, 0, 0);

    /* =========================================================
       LIGHTING
       ========================================================= */

    const ambient = new THREE.AmbientLight(0xffffff, options.lighting.ambient);

    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, options.lighting.key);

    keyLight.position.set(-4, 7, 8);

    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x8fdfff, options.lighting.rim, 25);

    rimLight.position.set(4, 4, -5);

    scene.add(rimLight);

    /* =========================================================
       DICE ROOT
       ========================================================= */

    const dice = new THREE.Group();

    scene.add(dice);

    /* =========================================================
       BODY
       ========================================================= */

    const bodyGeometry = new RoundedBoxGeometry(
      options.size,
      options.size,
      options.size,
      8,
      options.size * 0.12,
    );

    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: options.bodyColor,

      roughness: options.roughness,

      metalness: options.metalness,

      clearcoat: options.clearcoat,

      clearcoatRoughness: 0.12,
    });

    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);

    body.castShadow = true;
    body.receiveShadow = true;

    dice.add(body);

    /* =========================================================
       PIPS
       ========================================================= */

    const pipGeometry = new THREE.SphereGeometry(options.size * 0.075, 24, 16);

    const pipMaterial = new THREE.MeshStandardMaterial({
      color: options.pipColor,

      roughness: 0.3,
      metalness: 0.05,
    });

    const faceOffset = options.size / 2 + options.size * 0.018;

    const pipSpacing = options.size * 0.235;

    const faces: FaceDefinition[] = [
      {
        value: 1,

        normal: new THREE.Vector3(0, 0, 1),

        u: new THREE.Vector3(1, 0, 0),

        v: new THREE.Vector3(0, 1, 0),

        pattern: FACE_PATTERNS[1],
      },

      {
        value: 6,

        normal: new THREE.Vector3(0, 0, -1),

        u: new THREE.Vector3(-1, 0, 0),

        v: new THREE.Vector3(0, 1, 0),

        pattern: FACE_PATTERNS[6],
      },

      {
        value: 3,

        normal: new THREE.Vector3(1, 0, 0),

        u: new THREE.Vector3(0, 0, -1),

        v: new THREE.Vector3(0, 1, 0),

        pattern: FACE_PATTERNS[3],
      },

      {
        value: 4,

        normal: new THREE.Vector3(-1, 0, 0),

        u: new THREE.Vector3(0, 0, 1),

        v: new THREE.Vector3(0, 1, 0),

        pattern: FACE_PATTERNS[4],
      },

      {
        value: 2,

        normal: new THREE.Vector3(0, 1, 0),

        u: new THREE.Vector3(1, 0, 0),

        v: new THREE.Vector3(0, 0, -1),

        pattern: FACE_PATTERNS[2],
      },

      {
        value: 5,

        normal: new THREE.Vector3(0, -1, 0),

        u: new THREE.Vector3(1, 0, 0),

        v: new THREE.Vector3(0, 0, 1),

        pattern: FACE_PATTERNS[5],
      },
    ];

    for (const face of faces) {
      for (const [x, y] of face.pattern) {
        const position = face.normal
          .clone()
          .multiplyScalar(faceOffset)

          .add(face.u.clone().multiplyScalar(x * pipSpacing))

          .add(face.v.clone().multiplyScalar(y * pipSpacing));

        const pip = new THREE.Mesh(pipGeometry, pipMaterial);

        pip.position.copy(position);

        pip.userData.face = face.value;

        dice.add(pip);
      }
    }

    /* =========================================================
       TARGET ROTATIONS
       ========================================================= */

    const FACE_ROTATIONS: Record<DiceValue, THREE.Euler> = {
      /*
       * Front (+Z) = 1
       */
      1: new THREE.Euler(0, 0, 0),

      /*
       * Top (+Y) = 2
       */
      2: new THREE.Euler(0, 0, 0),

      /*
       * Right (+X) = 3
       */
      3: new THREE.Euler(0, 0, -Math.PI / 2),

      /*
       * Left (-X) = 4
       */
      4: new THREE.Euler(0, 0, Math.PI / 2),

      /*
       * Bottom (-Y) = 5
       */
      5: new THREE.Euler(Math.PI, 0, 0),

      /*
       * Back (-Z) = 6
       */
      6: new THREE.Euler(Math.PI / 2, 0, 0),
    };

    /*
     * We want the value to appear on top.
     *
     * 1: front -> rotate -90° X
     * 2: already top
     * 3: right -> rotate +90° Z
     * 4: left -> rotate -90° Z
     * 5: bottom -> rotate 180° X
     * 6: back -> rotate +90° X
     */

    const TOP_ROTATIONS: Record<DiceValue, THREE.Euler> = {
      1: new THREE.Euler(-Math.PI / 2, 0, 0),

      2: new THREE.Euler(0, 0, 0),

      3: new THREE.Euler(0, 0, Math.PI / 2),

      4: new THREE.Euler(0, 0, -Math.PI / 2),

      5: new THREE.Euler(Math.PI, 0, 0),

      6: new THREE.Euler(Math.PI / 2, 0, 0),
    };

    /* =========================================================
       ROLL STATE
       ========================================================= */

    let rolling = false;

    let rollStart = 0;

    let startRotation = new THREE.Euler();

    let targetRotation = new THREE.Euler();

    let currentValue = options.value;

    let targetValue = options.value;

    const easeOutCubic = (value: number): number => {
      const t = Math.max(0, Math.min(1, value));

      return 1 - Math.pow(1 - t, 3);
    };

    const randomValue = (): DiceValue => {
      return (Math.floor(Math.random() * 6) + 1) as DiceValue;
    };

    const createRollRotation = (nextValue: DiceValue): THREE.Euler => {
      const base = TOP_ROTATIONS[nextValue];

      const spins = options.rollSpins;

      return new THREE.Euler(
        base.x + Math.PI * 2 * spins,

        base.y + Math.PI * 2 * (spins + 1),

        base.z,
        "XYZ",
      );
    };

    const roll = (requestedValue?: DiceValue): void => {
      if (rolling) {
        return;
      }

      const nextValue = requestedValue ?? randomValue();

      rolling = true;

      targetValue = nextValue;

      rollStart = performance.now();

      startRotation = dice.rotation.clone();

      targetRotation = createRollRotation(nextValue);

      onRollStart?.();
    };

    /* =========================================================
       CLICK
       ========================================================= */

    const pointerDown = (event: PointerEvent): void => {
      if (!options.clickable) {
        return;
      }

      event.preventDefault();

      roll();
    };

    renderer.domElement.addEventListener("pointerdown", pointerDown);

    /* =========================================================
       COLOR ANIMATION
       ========================================================= */

    const interpolateColor = (
      from: THREE.ColorRepresentation,
      to: THREE.ColorRepresentation,
      amount: number,
    ): THREE.Color => {
      return new THREE.Color(from).lerp(new THREE.Color(to), amount);
    };

    const palettes: DiceColorPalette[] = [
      DEFAULT_PALETTE,
      ...(options.colorAnimation.palettes ?? []),
    ];

    /* =========================================================
       RESIZE
       ========================================================= */

    const resize = (): void => {
      const width = host.clientWidth || 1;

      const height = host.clientHeight || 1;

      camera.aspect = width / height;

      camera.updateProjectionMatrix();

      renderer.setSize(width, height, false);
    };

    const resizeObserver = new ResizeObserver(resize);

    resizeObserver.observe(host);

    resize();

    /* =========================================================
       INITIAL VALUE
       ========================================================= */

    dice.rotation.copy(TOP_ROTATIONS[options.value]);

    /* =========================================================
       FRAME
       ========================================================= */

    const frame = (now: number): void => {
      if (disposed) {
        return;
      }

      if (rolling) {
        const elapsed = now - rollStart;

        const progress = Math.min(1, elapsed / options.rollDuration);

        const eased = easeOutCubic(progress);

        dice.rotation.x = THREE.MathUtils.lerp(
          startRotation.x,
          targetRotation.x,
          eased,
        );

        dice.rotation.y = THREE.MathUtils.lerp(
          startRotation.y,
          targetRotation.y,
          eased,
        );

        dice.rotation.z = THREE.MathUtils.lerp(
          startRotation.z,
          targetRotation.z,
          eased,
        );

        if (progress >= 1) {
          rolling = false;

          currentValue = targetValue;

          dice.rotation.copy(TOP_ROTATIONS[currentValue]);

          onRollEnd?.(currentValue);
        }
      } else if (options.autoRotate) {
        dice.rotation.y += options.autoRotateSpeed * 0.01;
      }

      /* -------------------------------------------------------
         Smooth color animation
         ------------------------------------------------------- */

      if (options.colorAnimation.enabled && palettes.length > 1) {
        const duration = Math.max(1, options.colorAnimation.duration);

        const cycleDuration = duration * palettes.length;

        const cycle = now % cycleDuration;

        const position = cycle / duration;

        const currentIndex = Math.floor(position);

        const nextIndex = (currentIndex + 1) % palettes.length;

        const progress = position - currentIndex;

        const eased = progress * progress * (3 - 2 * progress);

        const current = palettes[currentIndex];

        const next = palettes[nextIndex];

        if (current.body && next.body) {
          bodyMaterial.color.copy(
            interpolateColor(current.body, next.body, eased),
          );
        }

        if (current.pip && next.pip) {
          pipMaterial.color.copy(
            interpolateColor(current.pip, next.pip, eased),
          );
        }

        if (current.light && next.light) {
          keyLight.color.copy(
            interpolateColor(current.light, next.light, eased),
          );
        }
      }

      renderer.render(scene, camera);

      requestAnimationFrame(frame);
    };

    const animationFrame = requestAnimationFrame(frame);

    /* =========================================================
       CLEANUP
       ========================================================= */

    return () => {
      disposed = true;

      cancelAnimationFrame(animationFrame);

      resizeObserver.disconnect();

      renderer.domElement.removeEventListener("pointerdown", pointerDown);

      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;

        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        if (mesh.material) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          materials.forEach((material) => {
            const textured = material as THREE.Material & {
              map?: THREE.Texture | null;
            };

            textured.map?.dispose();

            material.dispose();
          });
        }
      });

      scene.clear();

      renderer.dispose();

      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [options, onRollStart, onRollEnd]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 240,
        overflow: "hidden",
        cursor: clickable ? "pointer" : "default",
        touchAction: "none",
        ...style,
      }}
      aria-label={`3D dice showing ${value}`}
    />
  );
}
