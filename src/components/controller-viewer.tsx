"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";

type GradientStop = [position: number, color: string];

type SymbolKind = "circle" | "square" | "cross" | "triangle";

interface ControllerColors {
  buttons: THREE.ColorRepresentation;
  sticks: THREE.ColorRepresentation;
  decals: THREE.ColorRepresentation;
  touchpad: THREE.ColorRepresentation;
  lightBar: THREE.ColorRepresentation;
  logo: THREE.ColorRepresentation;
  speaker: THREE.ColorRepresentation;
  triggers: THREE.ColorRepresentation;
}

interface EnvironmentConfig {
  keyIntensity: number;
  rimIntensity: number;
  fillIntensity: number;

  keyColor: THREE.ColorRepresentation;
  rimColor: THREE.ColorRepresentation;
  fillColor: THREE.ColorRepresentation;
}

interface ColorPalette {
  gradient?: GradientStop[];
  colors?: Partial<ControllerColors>;
  environment?: Partial<EnvironmentConfig>;
}

interface ControllerViewerProps {
  className?: string;
  style?: CSSProperties;

  ariaLabel?: string;

  fullscreen?: boolean;

  colors?: Partial<ControllerColors>;

  shell?: Partial<{
    gradient: GradientStop[];
    roughness: number;
    metalness: number;
    clearcoat: number;
    clearcoatRoughness: number;
    envMapIntensity: number;
  }>;

  interaction?: Partial<{
    rotatable: boolean;
    zoomable: boolean;

    initialYaw: number;
    initialPitch: number;

    minPitch: number;
    maxPitch: number;

    minZoom: number;
    maxZoom: number;

    rotationSensitivityX: number;
    rotationSensitivityY: number;

    inertia: number;
  }>;

  animation?: Partial<{
    intro: boolean;
    duration: number;
    initialYawOffset: number;
    initialPitchOffset: number;
  }>;

  environment?: Partial<EnvironmentConfig>;

  background?: Partial<{
    light: string;
    lightSecondary: string;
    dark: string;
    darkSecondary: string;
  }>;

  shadow?: Partial<{
    enabled: boolean;
    opacity: number;
    width: number;
    height: number;
    x: number;
    y: number;
    z: number;
  }>;

  transform?: Partial<{
    scale: number;
    x: number;
    y: number;
    z: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
  }>;

  camera?: Partial<{
    fov: number;
    lookAtX: number;
    lookAtY: number;
    lookAtZ: number;
  }>;

  colorAnimation?: Partial<{
    enabled: boolean;
    duration: number;
    palettes: ColorPalette[];
  }>;

  logo?: Partial<{
    src: string;
    width: number;
    height: number;
    x: number;
    y: number;
    z: number;
    rotation: number;
    colorize: boolean;
  }>;
}

interface ResolvedPalette {
  gradient: GradientStop[];
  colors: ControllerColors;
  environment: EnvironmentConfig;
}

export default function ControllerViewer({
  className,
  style,
  ariaLabel = "3D model of a wireless game controller with a black to ice-blue gradient shell. Drag to rotate.",
  fullscreen = true,

  colors: colorOverrides,
  shell: shellOverrides,
  interaction: interactionOverrides,
  animation: animationOverrides,
  environment: environmentOverrides,
  background: backgroundOverrides,
  shadow: shadowOverrides,
  transform: transformOverrides,
  camera: cameraOverrides,
  colorAnimation: colorAnimationOverrides,
  logo: logoOverrides,
}: ControllerViewerProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo(() => {
    return {
      colors: {
        buttons: "#06080c",
        sticks: "#2b9fee",
        decals: "#8fd0ff",
        touchpad: "#030406",
        lightBar: "#3f82ff",
        logo: "#0d2f86",
        speaker: "#020409",
        triggers: "#06080c",

        ...colorOverrides,
      } satisfies ControllerColors,

      shell: {
        gradient: [
          [6.6, "#040507"],
          [4.4, "#05070b"],
          [3.4, "#061a45"],
          [2.6, "#0b3d99"],
          [1.6, "#1c77dc"],
          [0.4, "#2c9fee"],
          [-1.5, "#38b2f7"],
          [-6.6, "#4fc6fb"],
        ] as GradientStop[],

        roughness: 0.3,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1,

        ...shellOverrides,
      },

      interaction: {
        rotatable: true,
        zoomable: true,

        initialYaw: -0.55,
        initialPitch: 0.3,

        minPitch: -1,
        maxPitch: 1.25,

        minZoom: 0.7,
        maxZoom: 1.7,

        rotationSensitivityX: 0.007,
        rotationSensitivityY: 0.009,

        inertia: 0.94,

        ...interactionOverrides,
      },

      animation: {
        intro: true,
        duration: 1800,
        initialYawOffset: -1.5,
        initialPitchOffset: 0.35,

        ...animationOverrides,
      },

      environment: {
        keyIntensity: 1,
        rimIntensity: 0.7,
        fillIntensity: 0.3,

        keyColor: 0xffffff,
        rimColor: 0xa9d0ff,
        fillColor: 0xffffff,

        ...environmentOverrides,
      },

      background: {
        light: "#f5f6f8",
        lightSecondary: "#d8dce2",
        dark: "#262a31",
        darkSecondary: "#0d0e11",

        ...backgroundOverrides,
      },

      shadow: {
        enabled: true,
        opacity: 0.55,
        width: 34,
        height: 20,
        x: 0,
        y: -8.2,
        z: 0,

        ...shadowOverrides,
      },

      transform: {
        scale: 1,
        x: 0,
        y: 0,
        z: -0.3,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,

        ...transformOverrides,
      },

      camera: {
        fov: 28,
        lookAtX: 0,
        lookAtY: -0.4,
        lookAtZ: 0,

        ...cameraOverrides,
      },

      colorAnimation: {
        enabled: false,
        duration: 4500,
        palettes: [],

        ...colorAnimationOverrides,
      },
      logo: {
        src: "",
        width: 1.75,
        height: 1.75,
        x: 0,
        y: -0.07,
        z: 2.508,
        rotation: 0,
        colorize: true,

        ...logoOverrides,
      },
    };
  }, [
    colorOverrides,
    shellOverrides,
    interactionOverrides,
    animationOverrides,
    environmentOverrides,
    backgroundOverrides,
    shadowOverrides,
    transformOverrides,
    cameraOverrides,
    colorAnimationOverrides,
    logoOverrides,
  ]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    let disposed = false;
    let animationFrame = 0;

    /* =========================================================
       RENDERER
       ========================================================= */

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.toneMapping = THREE.NoToneMapping;

    renderer.setClearColor(0x000000, 0);

    renderer.domElement.setAttribute("role", "img");

    renderer.domElement.setAttribute("aria-label", ariaLabel);

    renderer.domElement.style.display = "block";

    renderer.domElement.style.width = "100%";

    renderer.domElement.style.height = "100%";

    stage.appendChild(renderer.domElement);

    /* =========================================================
       SCENE / CAMERA
       ========================================================= */

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(options.camera.fov, 1, 1, 400);

    /* =========================================================
       HELPERS
       ========================================================= */

    const srgb = (color: THREE.ColorRepresentation): THREE.Color => {
      return new THREE.Color(color).convertSRGBToLinear();
    };

    const clamp01 = (value: number): number => {
      return Math.min(1, Math.max(0, value));
    };

    const smooth = (a: number, b: number, x: number): number => {
      const t = clamp01((x - a) / (b - a));

      return t * t * (3 - 2 * t);
    };

    const smootherStep = (value: number): number => {
      const t = clamp01(value);

      return t * t * t * (t * (t * 6 - 15) + 10);
    };

    const S = 26.9;

    const P = (px: number, py: number): [number, number] => {
      return [(px - 305) / S, (294 - py) / S];
    };

    const anisotropy = <T extends THREE.Texture>(texture: T): T => {
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      return texture;
    };

    const roundedShape = (
      points: Array<[number, number]>,
      radius: number,
    ): THREE.Shape => {
      const shape = new THREE.Shape();

      const length = points.length;

      for (let i = 0; i < length; i += 1) {
        const p0 = points[(i + length - 1) % length];

        const p1 = points[i];

        const p2 = points[(i + 1) % length];

        const a = new THREE.Vector2(p0[0] - p1[0], p0[1] - p1[1]);

        const b = new THREE.Vector2(p2[0] - p1[0], p2[1] - p1[1]);

        const rr = Math.min(radius, a.length() * 0.5, b.length() * 0.5);

        a.normalize();
        b.normalize();

        const startPoint: [number, number] = [
          p1[0] + a.x * rr,
          p1[1] + a.y * rr,
        ];

        const endPoint: [number, number] = [p1[0] + b.x * rr, p1[1] + b.y * rr];

        if (i === 0) {
          shape.moveTo(startPoint[0], startPoint[1]);
        } else {
          shape.lineTo(startPoint[0], startPoint[1]);
        }

        shape.quadraticCurveTo(p1[0], p1[1], endPoint[0], endPoint[1]);
      }

      shape.closePath();

      return shape;
    };

    const rectPts = (
      width: number,
      height: number,
    ): Array<[number, number]> => {
      return [
        [-width / 2, -height / 2],
        [width / 2, -height / 2],
        [width / 2, height / 2],
        [-width / 2, height / 2],
      ];
    };

    const ext = (
      shape: THREE.Shape,
      depth: number,
      bevelThickness: number,
      bevelSize: number,
      bevelSegments = 6,
    ): THREE.ExtrudeGeometry => {
      return new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness,
        bevelSize,
        bevelSegments,
        curveSegments: 10,
      });
    };

    const weld = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => {
      const position = geometry.attributes.position;

      if (!position) {
        throw new Error("Geometry has no position attribute.");
      }

      const array = position.array as ArrayLike<number>;

      const count = position.count;

      const map = new Map<string, number>();

      const positions: number[] = [];

      const indices: number[] = new Array(count);

      for (let i = 0; i < count; i += 1) {
        const x = array[i * 3];

        const y = array[i * 3 + 1];

        const z = array[i * 3 + 2];

        const key =
          `${Math.round(x * 2000)}_` +
          `${Math.round(y * 2000)}_` +
          `${Math.round(z * 2000)}`;

        let index = map.get(key);

        if (index === undefined) {
          index = positions.length / 3;

          map.set(key, index);

          positions.push(x, y, z);
        }

        indices[i] = index;
      }

      const result = new THREE.BufferGeometry();

      result.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );

      result.setIndex(indices);

      return result;
    };

    const canvasTex = (
      size: number,
      draw: (context: CanvasRenderingContext2D, size: number) => void,
    ): THREE.CanvasTexture => {
      const canvas = document.createElement("canvas");

      canvas.width = size;
      canvas.height = size;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not create canvas context.");
      }

      draw(context, size);

      const texture = new THREE.CanvasTexture(canvas);

      texture.colorSpace = THREE.SRGBColorSpace;

      return anisotropy(texture);
    };

    /* =========================================================
       COLOR ANIMATION HELPERS
       ========================================================= */
    const normalizeGradient = (stops: GradientStop[]): GradientStop[] => {
      return stops
        .map(
          ([position, color]): GradientStop => [
            Math.max(-6.6, Math.min(6.6, position)),
            color,
          ],
        )
        .sort((a, b) => b[0] - a[0]);
    };
    const createResolvedPalette = (
      palette: ColorPalette,
      fallback: ResolvedPalette,
    ): ResolvedPalette => {
      return {
        gradient: normalizeGradient(palette.gradient ?? fallback.gradient),

        colors: {
          ...fallback.colors,
          ...palette.colors,
        },

        environment: {
          ...fallback.environment,
          ...palette.environment,
        },
      };
    };
    const interpolateColor = (
      from: THREE.ColorRepresentation,
      to: THREE.ColorRepresentation,
      amount: number,
    ): THREE.Color => {
      return new THREE.Color(from).lerp(new THREE.Color(to), amount);
    };

    const interpolateGradient = (
      from: GradientStop[],
      to: GradientStop[],
      amount: number,
    ): GradientStop[] => {
      const safeAmount = clamp01(amount);

      const length = Math.max(from.length, to.length);

      return Array.from({ length }, (_, index) => {
        const fromStop = from[Math.min(index, from.length - 1)];

        const toStop = to[Math.min(index, to.length - 1)];

        const position = THREE.MathUtils.lerp(
          fromStop[0],
          toStop[0],
          safeAmount,
        );

        const color = interpolateColor(fromStop[1], toStop[1], safeAmount);

        return [position, `#${color.getHexString()}`];
      });
    };

    const basePalette: ResolvedPalette = {
      gradient: normalizeGradient(options.shell.gradient),

      colors: options.colors,

      environment: options.environment,
    };

    const animationPalettes =
      options.colorAnimation.palettes.length > 0
        ? [
            basePalette,
            ...options.colorAnimation.palettes.map((palette) =>
              createResolvedPalette(palette, basePalette),
            ),
          ]
        : [basePalette];

    /* =========================================================
       STUDIO ENVIRONMENT
       ========================================================= */

    const buildEnvironment = (): THREE.Texture => {
      const environmentScene = new THREE.Scene();

      environmentScene.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(70, 70, 70),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(0.34, 0.36, 0.4),
            side: THREE.BackSide,
          }),
        ),
      );

      const panel = (
        width: number,
        height: number,
        position: [number, number, number],
        rgb: [number, number, number],
      ): void => {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(width, height),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(rgb[0], rgb[1], rgb[2]),
            side: THREE.DoubleSide,
          }),
        );

        mesh.position.set(position[0], position[1], position[2]);

        mesh.lookAt(0, 0, 0);

        environmentScene.add(mesh);
      };

      panel(36, 20, [0, 28, 8], [7, 7, 7.6]);

      panel(12, 28, [-26, 4, 14], [5, 5, 5.4]);

      panel(10, 26, [28, 2, -12], [4, 4.4, 5.2]);

      panel(32, 7, [0, -8, 30], [1.5, 1.6, 1.9]);

      panel(14, 14, [20, 14, 24], [2, 2.7, 3.8]);

      const pmrem = new THREE.PMREMGenerator(renderer);

      const result = pmrem.fromScene(environmentScene, 0.03);

      const texture = result.texture;

      pmrem.dispose();

      environmentScene.traverse((object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh;

        if (mesh.geometry) {
          mesh.geometry.dispose();
        }

        if (mesh.material) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          materials.forEach((material: THREE.Material) => {
            material.dispose();
          });
        }
      });

      return texture;
    };

    const environmentTexture = buildEnvironment();

    scene.environment = environmentTexture;

    /* =========================================================
       LIGHTS
       ========================================================= */

    const key = new THREE.DirectionalLight(
      options.environment.keyColor,
      options.environment.keyIntensity,
    );

    key.position.set(-12, 20, 22);

    scene.add(key);

    const rim = new THREE.DirectionalLight(
      options.environment.rimColor,
      options.environment.rimIntensity,
    );

    rim.position.set(16, 8, -14);

    scene.add(rim);

    const fill = new THREE.DirectionalLight(
      options.environment.fillColor,
      options.environment.fillIntensity,
    );

    fill.position.set(14, -6, 18);

    scene.add(fill);

    /* =========================================================
       SHELL
       ========================================================= */

    const BS = 0.75;
    const BT = 0.9;
    const DEPTH = 1.6;
    const STEPS = 4;
    const PUSH = 2.6;
    const TOPZ = DEPTH + BT;

    const R: Array<[number, number]> = [
      [410, 132],
      [452, 126],
      [492, 132],
      [517, 160],
      [527, 205],
      [531, 255],
      [531, 315],
      [521, 375],
      [505, 425],
      [484, 458],
      [460, 470],
      [438, 460],
      [420, 432],
      [400, 400],
      [376, 372],
      [345, 356],
    ];

    const raw: Array<[number, number]> = [[305, 131]];

    R.forEach((point) => {
      raw.push(point);
    });

    raw.push([305, 353]);

    R.slice()
      .reverse()
      .forEach((point) => {
        raw.push([610 - point[0], point[1]]);
      });

    const sx = (8.4 - BS) / 8.4;

    const sy = (6.4 - BS) / 6.4;

    const outline = raw.map((point) => {
      const u = P(point[0], point[1]);

      return new THREE.Vector3(u[0] * sx, u[1] * sy, 0);
    });

    const curve = new THREE.CatmullRomCurve3(outline, true, "centripetal");

    const cpts = curve.getPoints(260);

    cpts.pop();

    const shellShape = new THREE.Shape(
      cpts.map((point: THREE.Vector3) => new THREE.Vector2(point.x, point.y)),
    );

    const shellGeometry = weld(
      new THREE.ExtrudeGeometry(shellShape, {
        depth: DEPTH,
        steps: STEPS,
        bevelEnabled: true,
        bevelThickness: BT,
        bevelSize: BS,
        bevelSegments: 10,
        curveSegments: 1,
      }),
    );

    {
      const position = shellGeometry.attributes.position;

      const count = position.count;

      const uv = new Float32Array(count * 2);

      const vertexColors = new Float32Array(count * 3);

      for (let i = 0; i < count; i += 1) {
        const x = position.getX(i);

        const y = position.getY(i);

        const z = position.getZ(i);

        uv[i * 2] = 0.5;

        uv[i * 2 + 1] = clamp01((y + 6.6) / 13.2);

        const seam = 1 - 0.42 * (1 - smooth(0, 0.06, Math.abs(z - DEPTH / 2)));

        vertexColors[i * 3] = seam;

        vertexColors[i * 3 + 1] = seam;

        vertexColors[i * 3 + 2] = seam;

        const zn = (z + BT) / (DEPTH + 2 * BT);

        const w = Math.pow(clamp01(1 - zn), 1.4);

        const gp = smooth(2.2, 6.4, Math.abs(x)) * smooth(1.2, -4.2, y);

        position.setZ(i, z - PUSH * gp * w);
      }

      shellGeometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

      shellGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(vertexColors, 3),
      );

      shellGeometry.computeVertexNormals();
    }

    /* =========================================================
       GRADIENT TEXTURE
       ========================================================= */

    const gradientCanvas = document.createElement("canvas");

    gradientCanvas.width = 8;
    gradientCanvas.height = 1024;

    const gradientContext = gradientCanvas.getContext("2d");

    if (!gradientContext) {
      throw new Error("Could not create shell gradient context.");
    }

    const drawGradient = (stops: GradientStop[]): void => {
      const gradient = gradientContext.createLinearGradient(0, 0, 0, 1024);

      const normalizedStops = stops
        .map(([position, color]) => ({
          position,
          color,
          offset: clamp01((6.6 - position) / 13.2),
        }))
        .sort((a, b) => a.offset - b.offset);

      /*
       * CanvasGradient accepte des offsets entre 0 et 1.
       * On évite également plusieurs stops strictement
       * identiques, qui peuvent créer des transitions inutiles.
       */
      const uniqueStops: Array<{
        offset: number;
        color: string;
      }> = [];

      for (const stop of normalizedStops) {
        const last = uniqueStops[uniqueStops.length - 1];

        if (last && Math.abs(last.offset - stop.offset) < 0.000001) {
          uniqueStops[uniqueStops.length - 1] = {
            offset: stop.offset,
            color: stop.color,
          };

          continue;
        }

        uniqueStops.push({
          offset: stop.offset,
          color: stop.color,
        });
      }

      if (uniqueStops.length === 1) {
        gradient.addColorStop(0, uniqueStops[0].color);

        gradient.addColorStop(1, uniqueStops[0].color);
      } else {
        uniqueStops.forEach(({ offset, color }) => {
          gradient.addColorStop(offset, color);
        });
      }

      gradientContext.clearRect(0, 0, 8, 1024);

      gradientContext.fillStyle = gradient;

      gradientContext.fillRect(0, 0, 8, 1024);
    };

    drawGradient(options.shell.gradient);

    const gradientTexture = new THREE.CanvasTexture(gradientCanvas);

    gradientTexture.colorSpace = THREE.SRGBColorSpace;

    gradientTexture.generateMipmaps = false;

    gradientTexture.minFilter = THREE.LinearFilter;

    const shellMaterial = new THREE.MeshPhysicalMaterial({
      map: gradientTexture,
      vertexColors: true,

      roughness: options.shell.roughness,

      metalness: options.shell.metalness,

      clearcoat: options.shell.clearcoat,

      clearcoatRoughness: options.shell.clearcoatRoughness,

      envMapIntensity: options.shell.envMapIntensity,
    });

    const ctrl = new THREE.Group();

    ctrl.add(new THREE.Mesh(shellGeometry, shellMaterial));

    /* =========================================================
       SHARED MATERIALS
       ========================================================= */

    const blackGloss = new THREE.MeshPhysicalMaterial({
      color: srgb(options.colors.buttons),
      roughness: 0.2,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });

    const stickMaterial = new THREE.MeshPhysicalMaterial({
      color: srgb(options.colors.sticks),
      roughness: 0.55,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.5,
    });

    const triggerMaterial = new THREE.MeshPhysicalMaterial({
      color: srgb(options.colors.triggers),
      roughness: 0.2,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    });

    const touchpadMaterial = new THREE.MeshPhysicalMaterial({
      color: srgb(options.colors.touchpad),
      roughness: 0.1,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    });

    const lightBarMaterial = new THREE.MeshBasicMaterial({
      color: srgb(options.colors.lightBar),
      toneMapped: false,
    });

    const speakerMaterial = new THREE.MeshStandardMaterial({
      color: srgb(options.colors.speaker),
      roughness: 0.6,
    });

    /* =========================================================
       DECALS
       ========================================================= */

    const decalMaterials: THREE.MeshBasicMaterial[] = [];

    const symbolTex = (kind: SymbolKind): THREE.CanvasTexture => {
      return canvasTex(256, (context) => {
        /*
         * Texture blanche.
         * La couleur réelle vient du matériau,
         * ce qui permet de l'animer sans recréer
         * la texture.
         */

        context.strokeStyle = "#ffffff";

        context.lineWidth = 15;

        context.lineJoin = "round";

        context.lineCap = "round";

        context.beginPath();

        if (kind === "circle") {
          context.arc(128, 128, 70, 0, Math.PI * 2);
        }

        if (kind === "square") {
          context.rect(62, 62, 132, 132);
        }

        if (kind === "cross") {
          context.moveTo(68, 68);

          context.lineTo(188, 188);

          context.moveTo(188, 68);

          context.lineTo(68, 188);
        }

        if (kind === "triangle") {
          context.moveTo(128, 46);

          context.lineTo(204, 180);

          context.lineTo(52, 180);

          context.closePath();
        }

        context.stroke();
      });
    };

    /* =========================================================
   LOGO
   ========================================================= */

    const createDefaultLogoTexture = (): THREE.CanvasTexture => {
      return canvasTex(512, (context) => {
        context.setTransform(1, 0, -0.16, 1, 40, 0);

        context.strokeStyle = "#ffffff";

        context.lineJoin = "round";

        context.lineCap = "butt";

        context.lineWidth = 58;

        context.beginPath();

        context.moveTo(236, 96);

        context.lineTo(236, 398);

        context.stroke();

        context.lineWidth = 50;

        context.beginPath();

        context.moveTo(236, 104);

        context.lineTo(318, 104);

        context.arc(318, 188, 84, -Math.PI / 2, Math.PI / 2);

        context.lineTo(236, 272);

        context.stroke();

        context.lineCap = "round";

        context.lineWidth = 48;

        context.beginPath();

        context.moveTo(272, 314);

        context.bezierCurveTo(170, 280, 96, 314, 110, 358);

        context.bezierCurveTo(122, 396, 238, 364, 246, 410);

        context.bezierCurveTo(252, 446, 152, 458, 98, 428);

        context.stroke();
      });
    };

    const createLogoMaterial = (): THREE.MeshBasicMaterial => {
      return new THREE.MeshBasicMaterial({
        color: srgb(options.colors.logo),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
    };

    const logoMaterial = createLogoMaterial();

    const logoGeometry = new THREE.PlaneGeometry(
      options.logo.width,
      options.logo.height,
    );

    const logoMesh = new THREE.Mesh(logoGeometry, logoMaterial);

    logoMesh.position.set(options.logo.x, options.logo.y, TOPZ + 0.008);

    logoMesh.rotation.z = options.logo.rotation;

    ctrl.add(logoMesh);

    const textureLoader = new THREE.TextureLoader();

    if (options.logo.src) {
      textureLoader.load(options.logo.src, (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;

        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        logoMaterial.map = texture;

        logoMaterial.needsUpdate = true;
      });
    } else {
      logoMaterial.map = createDefaultLogoTexture();

      logoMaterial.needsUpdate = true;
    }

    const decal = (
      texture: THREE.Texture,
      size: number,
      x: number,
      y: number,
      z: number,
      rotation = 0,
    ): THREE.Mesh => {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        color: srgb(options.colors.decals),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });

      decalMaterials.push(material);

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        material,
      );

      mesh.position.set(x, y, z);

      mesh.rotation.z = rotation;

      ctrl.add(mesh);

      return mesh;
    };

    /* =========================================================
       TOUCHPAD
       ========================================================= */

    const tpPts: Array<[number, number]> = [
      [196, 141],
      [416, 141],
      [413, 188],
      [392, 232],
      [366, 247],
      [244, 247],
      [218, 232],
      [198, 188],
    ].map((point) => P(point[0], point[1]));

    const touchpadGeometry = ext(roundedShape(tpPts, 0.9), 0.1, 0.07, 0.06, 6);

    const touchpad = new THREE.Mesh(touchpadGeometry, touchpadMaterial);

    touchpad.position.z = TOPZ - 0.05;

    ctrl.add(touchpad);

    const barPts = tpPts.map(
      (point) => [point[0] * 1.045, point[1]] as [number, number],
    );

    const lightBar = new THREE.Mesh(
      ext(roundedShape(barPts, 0.9), 0.1, 0.03, 0.03, 4),
      lightBarMaterial,
    );

    lightBar.position.z = TOPZ - 0.06;

    ctrl.add(lightBar);

    /* =========================================================
   FACE BUTTONS
   ========================================================= */

    interface FaceButtonsConfig {
      centerX: number;
      centerY: number;
      spacing: number;

      symbolSize?: number;
      buttonZ?: number;
      symbolZOffset?: number;

      triangle?: {
        x?: number;
        y?: number;
      };

      square?: {
        x?: number;
        y?: number;
      };

      circle?: {
        x?: number;
        y?: number;
      };

      cross?: {
        x?: number;
        y?: number;
      };
    }

    const createFaceButtons = (config: FaceButtonsConfig): THREE.Group => {
      const {
        centerX,
        centerY,
        spacing,

        symbolSize = 1,
        buttonZ = TOPZ,
        symbolZOffset = 0.365,

        triangle = {},
        square = {},
        circle = {},
        cross = {},
      } = config;

      const group = new THREE.Group();

      const buttonProfile = [
        [0.79, 0],
        [0.79, 0.12],
        [0.77, 0.24],
        [0.68, 0.32],
        [0.5, 0.355],
        [0, 0.36],
      ].map((point: [number, number]) => new THREE.Vector2(point[0], point[1]));

      const buttonGeometry = new THREE.LatheGeometry(buttonProfile, 48);

      buttonGeometry.rotateX(Math.PI / 2);

      const buttonLayout: Array<{
        kind: SymbolKind;
        x: number;
        y: number;
      }> = [
        {
          kind: "triangle",
          x: triangle.x ?? 0,
          y: triangle.y ?? spacing,
        },
        {
          kind: "square",
          x: square.x ?? -spacing,
          y: square.y ?? 0,
        },
        {
          kind: "circle",
          x: circle.x ?? spacing,
          y: circle.y ?? 0,
        },
        {
          kind: "cross",
          x: cross.x ?? 0,
          y: cross.y ?? -spacing,
        },
      ];

      buttonLayout.forEach(({ kind, x, y }) => {
        const mesh = new THREE.Mesh(buttonGeometry, blackGloss);

        mesh.position.set(centerX + x, centerY + y, buttonZ);

        group.add(mesh);

        decal(
          symbolTex(kind),
          symbolSize,
          centerX + x,
          centerY + y - (kind === "triangle" ? 0.03 : 0),
          buttonZ + symbolZOffset,
        );
      });

      return group;
    };
    const faceButtons = createFaceButtons({
      centerX: 5.8,
      centerY: 2.48,
      spacing: 1.3,

      triangle: {
        x: 0,
        y: 1.2,
      },

      square: {
        x: -1.2,
        y: 0,
      },

      circle: {
        x: 1.2,
        y: 0,
      },

      cross: {
        x: 0,
        y: -1.2,
      },
    });

    ctrl.add(faceButtons);

    /* =========================================================
       D-PAD
       ========================================================= */

    const dPadGeometry = ext(
      roundedShape(rectPts(1.16, 0.96), 0.3),
      0.2,
      0.08,
      0.06,
      5,
    );

    const arrowTexture = symbolTex("triangle");

    const dx = -6.25;
    const dy = 2.68;
    const doff = 1.05;

    const dPadLayout: Array<[number, number, number]> = [
      [0, doff, 0],
      [0, -doff, Math.PI],
      [-doff, 0, Math.PI / 2],
      [doff, 0, -Math.PI / 2],
    ];

    dPadLayout.forEach(([offsetX, offsetY, rotation]) => {
      const mesh = new THREE.Mesh(dPadGeometry, blackGloss);

      mesh.position.set(dx + offsetX, dy + offsetY, TOPZ);

      mesh.rotation.z = rotation;

      ctrl.add(mesh);

      decal(
        arrowTexture,
        0.55,
        dx + offsetX + offsetX * 0.08,
        dy + offsetY + offsetY * 0.08,
        TOPZ + 0.305,
        rotation,
      );
    });

    const hub = new THREE.Mesh(
      ext(roundedShape(rectPts(0.9, 0.9), 0.35), 0.1, 0.06, 0.05, 4),
      blackGloss,
    );

    hub.position.set(dx, dy, TOPZ - 0.02);

    ctrl.add(hub);

    /* =========================================================
       ANALOG STICKS
       ========================================================= */

    const stickProfile = [
      [0.6, 0],
      [0.62, 0.45],
      [0.85, 0.7],
      [1.2, 0.85],
      [1.38, 0.98],
      [1.42, 1.12],
      [1.32, 1.24],
      [1.1, 1.22],
      [1.0, 1.15],
      [0.95, 1.17],
      [0.85, 1.11],
      [0.8, 1.13],
      [0.7, 1.07],
      [0.6, 1.09],
      [0.5, 1.03],
      [0.4, 1.05],
      [0, 1],
    ].map((point) => new THREE.Vector2(point[0], point[1]));

    const stickGeometry = new THREE.LatheGeometry(stickProfile, 72);

    stickGeometry.rotateX(Math.PI / 2);

    const socketGeometry = new THREE.CircleGeometry(1.6, 56);

    const ringGeometry = new THREE.TorusGeometry(1.6, 0.09, 12, 64);

    [-3.45, 3.45].forEach((x) => {
      const socket = new THREE.Mesh(socketGeometry, blackGloss);

      socket.position.set(x, -0.05, TOPZ + 0.015);

      ctrl.add(socket);

      const ring = new THREE.Mesh(ringGeometry, blackGloss);

      ring.position.set(x, -0.05, TOPZ + 0.015);

      ctrl.add(ring);

      const stick = new THREE.Mesh(stickGeometry, stickMaterial);

      stick.position.set(x, -0.05, TOPZ + 0.03);

      ctrl.add(stick);
    });

    /* =========================================================
       SPEAKER
       ========================================================= */

    {
      const dots: Array<[number, number]> = [];

      for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 7; column += 1) {
          if (row === 1 && column === 6) {
            continue;
          }

          dots.push([
            -0.9 + column * 0.3 + (row === 1 ? 0.15 : 0),
            1.5 - row * 0.3,
          ]);
        }
      }

      const instances = new THREE.InstancedMesh(
        new THREE.CircleGeometry(0.085, 14),
        speakerMaterial,
        dots.length,
      );

      const matrix = new THREE.Matrix4();

      dots.forEach((dot, index) => {
        matrix.makeTranslation(dot[0], dot[1], TOPZ + 0.006);

        instances.setMatrixAt(index, matrix);
      });

      instances.instanceMatrix.needsUpdate = true;

      ctrl.add(instances);
    }

    /* =========================================================
       LOGO
       ========================================================= */

    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 1.75),
      logoMaterial,
    );

    logo.position.set(0, -0.07, TOPZ + 0.008);

    ctrl.add(logo);

    /* =========================================================
       MUTE
       ========================================================= */

    const mute = new THREE.Mesh(
      ext(roundedShape(rectPts(0.85, 0.18), 0.09), 0.04, 0.03, 0.03, 4),
      blackGloss,
    );

    mute.position.set(0, -1.08, TOPZ - 0.02);

    ctrl.add(mute);

    const mic = new THREE.Mesh(
      new THREE.CircleGeometry(0.05, 12),
      new THREE.MeshBasicMaterial({
        color: srgb(options.colors.buttons),
      }),
    );

    ctrl.add(mic);

    mic.position.set(0, -1.5, TOPZ + 0.006);

    /* =========================================================
       SMALL BUTTONS
       ========================================================= */

    const pillGeometry = ext(
      roundedShape(rectPts(0.24, 0.8), 0.12),
      0.04,
      0.03,
      0.03,
      4,
    );

    const pillPositions: Array<[number, number, number]> = [
      [-4.85, 4.75, 0.32],
      [4.85, 4.75, -0.32],
    ];

    pillPositions.forEach(([x, y, rotation]) => {
      const mesh = new THREE.Mesh(pillGeometry, blackGloss);

      mesh.position.set(x, y, TOPZ - 0.02);

      mesh.rotation.z = rotation;

      ctrl.add(mesh);
    });
    /* =========================================================
       TRIGGERS
       ========================================================= */

    const triggerShape = roundedShape(
      [
        [4.9, 3.9],
        [5.9, 4.05],
        [6.7, 3.3],
        [6.9, 2],
        [6.5, 0.6],
        [5.6, -0.1],
        [4.9, 0.5],
      ],
      0.7,
    );

    const triggerWidth = 2.5;

    const triggerGeometry = ext(triggerShape, triggerWidth, 0.25, 0.25, 6);

    triggerGeometry.translate(0, 0, -triggerWidth / 2);

    triggerGeometry.applyMatrix4(
      new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1),
    );

    triggerGeometry.computeVertexNormals();

    [-6.5, 6.5].forEach((x) => {
      const mesh = new THREE.Mesh(triggerGeometry, triggerMaterial);

      mesh.position.set(x, 0, 0);

      ctrl.add(mesh);
    });

    /* =========================================================
       CONTROLLER TRANSFORM
       ========================================================= */

    ctrl.position.set(
      options.transform.x,
      options.transform.y,
      options.transform.z,
    );

    ctrl.scale.setScalar(options.transform.scale);

    ctrl.rotation.order = "YXZ";

    ctrl.rotation.set(
      options.transform.rotationX,
      options.transform.rotationY,
      options.transform.rotationZ,
    );

    const rig = new THREE.Group();

    rig.add(ctrl);

    scene.add(rig);

    /* =========================================================
       SHADOW
       ========================================================= */

    if (options.shadow.enabled) {
      const shadowTexture = canvasTex(256, (context, size) => {
        const gradient = context.createRadialGradient(
          size / 2,
          size / 2,
          4,
          size / 2,
          size / 2,
          size / 2,
        );

        gradient.addColorStop(0, `rgba(0,0,0,${options.shadow.opacity})`);

        gradient.addColorStop(
          0.45,
          `rgba(0,0,0,${options.shadow.opacity * 0.4})`,
        );

        gradient.addColorStop(1, "rgba(0,0,0,0)");

        context.fillStyle = gradient;

        context.fillRect(0, 0, size, size);
      });

      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(options.shadow.width, options.shadow.height),
        new THREE.MeshBasicMaterial({
          map: shadowTexture,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
        }),
      );

      shadow.rotation.x = -Math.PI / 2;

      shadow.position.set(options.shadow.x, options.shadow.y, options.shadow.z);

      scene.add(shadow);
    }

    /* =========================================================
       CAMERA
       ========================================================= */

    let baseDist = 60;
    let zoom = 1;

    const resize = (): void => {
      const width = stage.clientWidth || 1;

      const height = stage.clientHeight || 1;

      renderer.setSize(width, height, false);

      camera.aspect = width / height;

      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

      baseDist = Math.max(9.2 / tangent, 11.6 / (tangent * camera.aspect));

      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);

    resizeObserver.observe(stage);

    resize();

    /* =========================================================
       INTERACTION
       ========================================================= */

    let rotY = options.interaction.initialYaw;

    let rotX = options.interaction.initialPitch;

    let velY = 0;
    let velX = 0;

    let dragging = false;

    let lastX = 0;
    let lastY = 0;

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let intro = !options.animation.intro || reduceMotion ? 1 : 0;

    const introStart = performance.now();

    const pointerDown = (event: PointerEvent): void => {
      if (!options.interaction.rotatable) {
        return;
      }

      dragging = true;
      intro = 1;

      lastX = event.clientX;

      lastY = event.clientY;

      velX = 0;
      velY = 0;

      stage.classList.add("drag");

      try {
        stage.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is not available.
      }
    };

    const pointerMove = (event: PointerEvent): void => {
      if (!dragging) {
        return;
      }

      const dx = event.clientX - lastX;

      const dy = event.clientY - lastY;

      lastX = event.clientX;

      lastY = event.clientY;

      velY = dx * options.interaction.rotationSensitivityY;

      velX = dy * options.interaction.rotationSensitivityX;

      rotY += velY;

      rotX = Math.max(
        options.interaction.minPitch,
        Math.min(options.interaction.maxPitch, rotX + velX),
      );
    };

    const endDrag = (): void => {
      dragging = false;

      stage.classList.remove("drag");
    };

    const wheel = (event: WheelEvent): void => {
      if (!options.interaction.zoomable) {
        return;
      }

      event.preventDefault();

      zoom = Math.max(
        options.interaction.minZoom,
        Math.min(
          options.interaction.maxZoom,
          zoom * Math.exp(-event.deltaY * 0.0012),
        ),
      );
    };

    stage.addEventListener("pointerdown", pointerDown);

    stage.addEventListener("pointermove", pointerMove);

    stage.addEventListener("pointerup", endDrag);

    stage.addEventListener("pointercancel", endDrag);

    stage.addEventListener("wheel", wheel, {
      passive: false,
    });

    /* =========================================================
       COLOR ANIMATION STATE
       ========================================================= */

    const updateColors = (current: ResolvedPalette): void => {
      drawGradient(current.gradient);

      gradientTexture.needsUpdate = true;

      blackGloss.color.copy(srgb(current.colors.buttons));

      stickMaterial.color.copy(srgb(current.colors.sticks));

      triggerMaterial.color.copy(srgb(current.colors.triggers));

      touchpadMaterial.color.copy(srgb(current.colors.touchpad));

      lightBarMaterial.color.copy(srgb(current.colors.lightBar));

      speakerMaterial.color.copy(srgb(current.colors.speaker));

      logoMaterial.color.copy(srgb(current.colors.logo));

      decalMaterials.forEach((material) => {
        material.color.copy(srgb(current.colors.decals));
      });

      key.color.copy(srgb(current.environment.keyColor));

      rim.color.copy(srgb(current.environment.rimColor));

      fill.color.copy(srgb(current.environment.fillColor));

      key.intensity = current.environment.keyIntensity;

      rim.intensity = current.environment.rimIntensity;

      fill.intensity = current.environment.fillIntensity;
    };

    /* =========================================================
       RENDER LOOP
       ========================================================= */

    const frame = (now: number): void => {
      if (disposed) {
        return;
      }

      /* -------------------------------------------------------
         Intro
         ------------------------------------------------------- */

      if (intro < 1) {
        const t = clamp01((now - introStart) / options.animation.duration);

        intro = t;

        const eased = 1 - Math.pow(1 - t, 3);

        rotY =
          options.interaction.initialYaw +
          (1 - eased) * options.animation.initialYawOffset;

        rotX =
          options.interaction.initialPitch +
          (1 - eased) * options.animation.initialPitchOffset;
      } else if (!dragging) {
        rotY += velY;

        rotX = Math.max(
          options.interaction.minPitch,
          Math.min(options.interaction.maxPitch, rotX + velX),
        );

        velY *= options.interaction.inertia;

        velX *= options.interaction.inertia;
      }

      /* -------------------------------------------------------
         Smooth color transition
         ------------------------------------------------------- */

      if (options.colorAnimation.enabled && animationPalettes.length > 1) {
        const duration = Math.max(1, options.colorAnimation.duration);

        const elapsed = now % (duration * animationPalettes.length);

        const palettePosition = elapsed / duration;

        const currentIndex = Math.floor(palettePosition);

        const nextIndex = (currentIndex + 1) % animationPalettes.length;

        const localProgress = palettePosition - currentIndex;

        const eased = smootherStep(localProgress);

        const from = animationPalettes[currentIndex];

        const to = animationPalettes[nextIndex];

        const currentGradient = interpolateGradient(
          from.gradient,
          to.gradient,
          eased,
        );

        const currentColors: ControllerColors = {
          buttons: interpolateColor(
            from.colors.buttons,
            to.colors.buttons,
            eased,
          ).getStyle(),

          sticks: interpolateColor(
            from.colors.sticks,
            to.colors.sticks,
            eased,
          ).getStyle(),

          decals: interpolateColor(
            from.colors.decals,
            to.colors.decals,
            eased,
          ).getStyle(),

          touchpad: interpolateColor(
            from.colors.touchpad,
            to.colors.touchpad,
            eased,
          ).getStyle(),

          lightBar: interpolateColor(
            from.colors.lightBar,
            to.colors.lightBar,
            eased,
          ).getStyle(),

          logo: interpolateColor(
            from.colors.logo,
            to.colors.logo,
            eased,
          ).getStyle(),

          speaker: interpolateColor(
            from.colors.speaker,
            to.colors.speaker,
            eased,
          ).getStyle(),

          triggers: interpolateColor(
            from.colors.triggers,
            to.colors.triggers,
            eased,
          ).getStyle(),
        };

        const currentEnvironment: EnvironmentConfig = {
          keyColor: interpolateColor(
            from.environment.keyColor,
            to.environment.keyColor,
            eased,
          ).getStyle(),

          rimColor: interpolateColor(
            from.environment.rimColor,
            to.environment.rimColor,
            eased,
          ).getStyle(),

          fillColor: interpolateColor(
            from.environment.fillColor,
            to.environment.fillColor,
            eased,
          ).getStyle(),

          keyIntensity: THREE.MathUtils.lerp(
            from.environment.keyIntensity,
            to.environment.keyIntensity,
            eased,
          ),

          rimIntensity: THREE.MathUtils.lerp(
            from.environment.rimIntensity,
            to.environment.rimIntensity,
            eased,
          ),

          fillIntensity: THREE.MathUtils.lerp(
            from.environment.fillIntensity,
            to.environment.fillIntensity,
            eased,
          ),
        };

        updateColors({
          gradient: currentGradient,
          colors: currentColors,
          environment: currentEnvironment,
        });
      }

      /* -------------------------------------------------------
         Controller rotation
         ------------------------------------------------------- */

      ctrl.rotation.set(rotX, rotY, options.transform.rotationZ);

      /* -------------------------------------------------------
         Camera
         ------------------------------------------------------- */

      const distance = baseDist / zoom;

      camera.position.set(0, distance * 0.09, distance);

      camera.lookAt(
        options.camera.lookAtX,
        options.camera.lookAtY,
        options.camera.lookAtZ,
      );

      /* -------------------------------------------------------
         Render
         ------------------------------------------------------- */

      renderer.render(scene, camera);

      animationFrame = requestAnimationFrame(frame);
    };

    animationFrame = requestAnimationFrame(frame);

    /* =========================================================
       CLEANUP
       ========================================================= */

    return () => {
      disposed = true;

      cancelAnimationFrame(animationFrame);

      resizeObserver.disconnect();

      stage.removeEventListener("pointerdown", pointerDown);

      stage.removeEventListener("pointermove", pointerMove);

      stage.removeEventListener("pointerup", endDrag);

      stage.removeEventListener("pointercancel", endDrag);

      stage.removeEventListener("wheel", wheel);

      stage.classList.remove("drag");

      const geometries = new Set<THREE.BufferGeometry>();

      const materials = new Set<THREE.Material>();

      const textures = new Set<THREE.Texture>();

      scene.traverse((object: THREE.Object3D) => {
        const mesh = object as THREE.Mesh;

        if (mesh.geometry) {
          geometries.add(mesh.geometry);
        }

        if (mesh.material) {
          const materialList = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          materialList.forEach((material: THREE.Material) => {
            materials.add(material);

            const textured = material as THREE.Material & {
              map?: THREE.Texture | null;
              alphaMap?: THREE.Texture | null;
              aoMap?: THREE.Texture | null;
              bumpMap?: THREE.Texture | null;
              displacementMap?: THREE.Texture | null;
              emissiveMap?: THREE.Texture | null;
              metalnessMap?: THREE.Texture | null;
              normalMap?: THREE.Texture | null;
              roughnessMap?: THREE.Texture | null;
            };

            [
              textured.map,
              textured.alphaMap,
              textured.aoMap,
              textured.bumpMap,
              textured.displacementMap,
              textured.emissiveMap,
              textured.metalnessMap,
              textured.normalMap,
              textured.roughnessMap,
            ].forEach((texture) => {
              if (texture) {
                textures.add(texture);
              }
            });
          });
        }
      });

      geometries.forEach((geometry) => {
        geometry.dispose();
      });

      textures.forEach((texture) => {
        texture.dispose();
      });

      materials.forEach((material) => {
        material.dispose();
      });

      environmentTexture.dispose();

      scene.clear();

      renderer.dispose();

      if (renderer.domElement.parentNode === stage) {
        stage.removeChild(renderer.domElement);
      }
    };
  }, [ariaLabel, options]);

  const stageStyle: CSSProperties = {
    ...(fullscreen
      ? {
          position: "fixed",
          inset: 0,
        }
      : {
          position: "relative",
          width: "100%",
          height: "100%",
        }),

    overflow: "hidden",
    cursor: "grab",
    touchAction: "none",

    backgroundColor: options.background.lightSecondary,

    backgroundImage: `radial-gradient(
          ellipse at 50% 42%,
          ${options.background.light},
          ${options.background.lightSecondary} 80%
        )`,

    ...style,
  };

  return (
    <>
      <style>{`
        [data-controller-stage] {
          --controller-bg-light:
            ${options.background.light};

          --controller-bg-light-secondary:
            ${options.background.lightSecondary};

          --controller-bg-dark:
            ${options.background.dark};

          --controller-bg-dark-secondary:
            ${options.background.darkSecondary};
        }

        [data-controller-stage].drag {
          cursor: grabbing;
        }

        [data-controller-stage] canvas {
          display: block;
          width: 100%;
          height: 100%;
        }

        @media (prefers-color-scheme: dark) {
          :root:not([data-theme="light"])
            [data-controller-stage] {
            background-color:
              var(--controller-bg-dark-secondary);

            background-image:
              radial-gradient(
                ellipse at 50% 42%,
                var(--controller-bg-dark),
                var(--controller-bg-dark-secondary) 80%
              );
          }
        }

        :root[data-theme="dark"]
          [data-controller-stage] {
          background-color:
            var(--controller-bg-dark-secondary);

          background-image:
            radial-gradient(
              ellipse at 50% 42%,
              var(--controller-bg-dark),
              var(--controller-bg-dark-secondary) 80%
            );
        }
      `}</style>

      <div
        ref={stageRef}
        data-controller-stage
        className={className}
        style={stageStyle}
      />
    </>
  );
}
