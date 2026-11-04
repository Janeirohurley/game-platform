"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
  createPersonPortraitModel,
  type PortraitParamOverrides,
} from "@/lib/person-portrait-model";

export interface PortraitViewerProps {
  portrait?: PortraitParamOverrides;

  autoRotate?: boolean;
  autoRotateSpeed?: number;

  enableRotation?: boolean;
  enableZoom?: boolean;

  minDistance?: number;
  maxDistance?: number;

  cameraDistance?: number;

  exposure?: number;

  background?:
    | "transparent"
    | string;

  camera?: {
    fov?: number;
    near?: number;
    far?: number;
    position?: [number, number, number];
    target?: [number, number, number];
  };

  lights?: {
    ambient?: number;
    key?: {
      color?: string;
      intensity?: number;
      position?: [number, number, number];
    };
    fill?: {
      color?: string;
      intensity?: number;
      position?: [number, number, number];
    };
    rim?: {
      color?: string;
      intensity?: number;
      position?: [number, number, number];
    };
  };

  style?: React.CSSProperties;

  className?: string;
}

const DEFAULT_CAMERA = {
  fov: 34,
  near: 0.1,
  far: 100,
  position: [0, 0.1, 5.6] as [number, number, number],
  target: [0, -0.55, 0] as [number, number, number],
};

const DEFAULT_LIGHTS = {
  ambient: 1.4,

  key: {
    color: "#fff4e8",
    intensity: 3.2,
    position: [-3.5, 4.5, 5] as [number, number, number],
  },

  fill: {
    color: "#8ccfff",
    intensity: 1.7,
    position: [4, 1.5, 3] as [number, number, number],
  },

  rim: {
    color: "#b88cff",
    intensity: 3.5,
    position: [1.5, 3.5, -4] as [number, number, number],
  },
};

export default function PortraitViewer({
  portrait = {},

  autoRotate = true,
  autoRotateSpeed = 0.2,

  enableRotation = true,
  enableZoom = true,

  minDistance = 4.2,
  maxDistance = 8,

  cameraDistance = 5.6,

  exposure = 1.1,

  background = "transparent",

  camera = {},
  lights = {},

  style,
  className = "",
}: PortraitViewerProps) {
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    // -------------------------------------------------------------------------
    // Scene
    // -------------------------------------------------------------------------

    const scene = new THREE.Scene();

    // -------------------------------------------------------------------------
    // Camera
    // -------------------------------------------------------------------------

    const cameraConfig = {
      ...DEFAULT_CAMERA,
      ...camera,
      position:
        camera.position ??
        DEFAULT_CAMERA.position,
      target:
        camera.target ??
        DEFAULT_CAMERA.target,
    };

    const perspectiveCamera =
      new THREE.PerspectiveCamera(
        cameraConfig.fov,
        1,
        cameraConfig.near,
        cameraConfig.far,
      );

    perspectiveCamera.position.set(
      ...cameraConfig.position,
    );

    // -------------------------------------------------------------------------
    // Renderer
    // -------------------------------------------------------------------------

    const renderer =
      new THREE.WebGLRenderer({
        canvas,
        alpha: background === "transparent",
        antialias: true,
        powerPreference: "high-performance",
      });

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure =
      exposure;

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        2,
      ),
    );

    if (background === "transparent") {
      renderer.setClearColor(
        0x000000,
        0,
      );
    } else {
      renderer.setClearColor(
        new THREE.Color(background),
        1,
      );
    }

    // -------------------------------------------------------------------------
    // Lighting
    // -------------------------------------------------------------------------

    const ambientIntensity =
      lights.ambient ??
      DEFAULT_LIGHTS.ambient;

    const ambientLight =
      new THREE.HemisphereLight(
        "#ffffff",
        "#10131a",
        ambientIntensity,
      );

    scene.add(ambientLight);

    const keyConfig = {
      ...DEFAULT_LIGHTS.key,
      ...lights.key,
      position:
        lights.key?.position ??
        DEFAULT_LIGHTS.key.position,
    };

    const keyLight =
      new THREE.DirectionalLight(
        keyConfig.color,
        keyConfig.intensity,
      );

    keyLight.position.set(
      ...keyConfig.position,
    );

    scene.add(keyLight);

    const fillConfig = {
      ...DEFAULT_LIGHTS.fill,
      ...lights.fill,
      position:
        lights.fill?.position ??
        DEFAULT_LIGHTS.fill.position,
    };

    const fillLight =
      new THREE.DirectionalLight(
        fillConfig.color,
        fillConfig.intensity,
      );

    fillLight.position.set(
      ...fillConfig.position,
    );

    scene.add(fillLight);

    const rimConfig = {
      ...DEFAULT_LIGHTS.rim,
      ...lights.rim,
      position:
        lights.rim?.position ??
        DEFAULT_LIGHTS.rim.position,
    };

    const rimLight =
      new THREE.DirectionalLight(
        rimConfig.color,
        rimConfig.intensity,
      );

    rimLight.position.set(
      ...rimConfig.position,
    );

    scene.add(rimLight);

    // -------------------------------------------------------------------------
    // Portrait model
    // -------------------------------------------------------------------------

    const portraitModel =
      createPersonPortraitModel(
        portrait,
      );

    const portraitRoot =
      portraitModel.root;

    /*
     * Center the bust vertically.
     *
     * The procedural model currently extends approximately
     * from y = -3.7 to y = 1.05.
     */
    portraitRoot.position.y =
      1.25;

    scene.add(portraitRoot);

    // -------------------------------------------------------------------------
    // Controls
    // -------------------------------------------------------------------------

    const controls =
      new OrbitControls(
        perspectiveCamera,
        renderer.domElement,
      );

    controls.target.set(
      ...cameraConfig.target,
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.06;

    controls.enableRotate =
      enableRotation;

    controls.enableZoom =
      enableZoom;

    controls.minDistance =
      minDistance;

    controls.maxDistance =
      maxDistance;

    /*
     * Keep the viewer focused around the face.
     */
    controls.minPolarAngle =
      THREE.MathUtils.degToRad(62);

    controls.maxPolarAngle =
      THREE.MathUtils.degToRad(118);

    /*
     * Avoid looking too far underneath the bust.
     */
    controls.maxAzimuthAngle =
      Infinity;

    controls.minAzimuthAngle =
      -Infinity;

    /*
     * Prevent panning.
     */
    controls.enablePan = false;

    /*
     * Auto rotation.
     */
    controls.autoRotate =
      autoRotate;

    controls.autoRotateSpeed =
      autoRotateSpeed;

    // -------------------------------------------------------------------------
    // Resize
    // -------------------------------------------------------------------------

    const resize = () => {
      const width =
        canvas.clientWidth ||
        canvas.parentElement?.clientWidth ||
        window.innerWidth;

      const height =
        canvas.clientHeight ||
        canvas.parentElement?.clientHeight ||
        window.innerHeight;

      if (height <= 0) {
        return;
      }

      perspectiveCamera.aspect =
        width / height;

      perspectiveCamera.updateProjectionMatrix();

      renderer.setSize(
        width,
        height,
        false,
      );

      /*
       * Keep portrait distance slightly adaptive.
       */
      perspectiveCamera.position.z =
        cameraDistance;
    };

    resize();

    const resizeObserver =
      new ResizeObserver(resize);

    resizeObserver.observe(canvas);

    if (canvas.parentElement) {
      resizeObserver.observe(
        canvas.parentElement,
      );
    }

    // -------------------------------------------------------------------------
    // Animation
    // -------------------------------------------------------------------------

    // THREE.Clock est déprécié depuis three 0.186 : Timer le remplace.
    const timer =
      new THREE.Timer();

    let animationFrame = 0;

    const animate = () => {
      animationFrame =
        window.requestAnimationFrame(
          animate,
        );

      timer.update();

      const elapsed =
        timer.getElapsed();

      /*
       * Very subtle breathing movement.
       * Keeps the portrait alive without looking like
       * a cartoon animation.
       */
      portraitRoot.position.y =
        1.25 +
        Math.sin(elapsed * 0.7) *
          0.008;

      controls.update();

      renderer.render(
        scene,
        perspectiveCamera,
      );
    };

    animate();

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    return () => {
      window.cancelAnimationFrame(
        animationFrame,
      );

      resizeObserver.disconnect();

      controls.dispose();

      portraitModel.dispose();

      renderer.dispose();
    };
  }, [
    // The viewer is intended to receive a stable configuration.
    // Recreate the scene when these configuration objects change.
    portrait,
    autoRotate,
    autoRotateSpeed,
    enableRotation,
    enableZoom,
    minDistance,
    maxDistance,
    cameraDistance,
    exposure,
    background,
    camera,
    lights,
  ]);

  return (
    <div
      className={[
        "relative h-full min-h-[420px] w-full",
        className,
      ].join(" ")}
      style={style}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        aria-label="Interactive 3D portrait"
      />
    </div>
  );
}