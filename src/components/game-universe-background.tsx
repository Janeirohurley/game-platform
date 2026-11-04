"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type ParticleLayer = {
  points: THREE.Points;
  material: THREE.PointsMaterial;
  baseOpacity: number;
  baseSize: number;
};

export default function GameUniverseBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      45,
      1,
      0.1,
      100,
    );

    camera.position.set(0, 0, 15);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 1.75),
    );
    renderer.setClearColor(0x000000, 0);

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    const isDarkMode = () =>
      document.documentElement.classList.contains("dark");

    const lerp = (
      current: number,
      target: number,
      amount: number,
    ) => current + (target - current) * amount;

    const createParticleLayer = (
      count: number,
      radiusX: number,
      radiusY: number,
      minZ: number,
      maxZ: number,
      centerGap: number,
      size: number,
      opacity: number,
    ): ParticleLayer => {
      const positions = new Float32Array(count * 3);

      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3;

        let x = 0;
        let y = 0;

        /*
         * We reject positions too close to the center.
         * This keeps the Hero readable.
         */
        do {
          x = THREE.MathUtils.randFloatSpread(radiusX);
          y = THREE.MathUtils.randFloatSpread(radiusY);
        } while (
          Math.sqrt(
            Math.pow(x / radiusX, 2) +
              Math.pow(y / radiusY, 2),
          ) < centerGap
        );

        positions[i3] = x;

        positions[i3 + 1] = y;

        positions[i3 + 2] = THREE.MathUtils.randFloat(
          minZ,
          maxZ,
        );
      }

      const geometry = new THREE.BufferGeometry();

      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );

      const material = new THREE.PointsMaterial({
        color: 0xffffff,
        size,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(
        geometry,
        material,
      );

      scene.add(points);

      return {
        points,
        material,
        baseOpacity: opacity,
        baseSize: size,
      };
    };

    // ---------------------------------------------------------------------------
    // Particle layers
    // ---------------------------------------------------------------------------

    const starField = createParticleLayer(
      1250,
      38,
      24,
      -30,
      2,
      0.08,
      0.045,
      0.72,
    );

    const cyanField = createParticleLayer(
      380,
      32,
      20,
      -22,
      -4,
      0.2,
      0.085,
      0.38,
    );

    const violetField = createParticleLayer(
      260,
      35,
      22,
      -25,
      -6,
      0.25,
      0.07,
      0.3,
    );

    const distantField = createParticleLayer(
      500,
      44,
      28,
      -40,
      -12,
      0.02,
      0.025,
      0.22,
    );

    const layers: ParticleLayer[] = [
      starField,
      cyanField,
      violetField,
      distantField,
    ];

    // ---------------------------------------------------------------------------
    // Theme colors
    // ---------------------------------------------------------------------------

    const targetColors = {
      stars: new THREE.Color(),
      cyan: new THREE.Color(),
      violet: new THREE.Color(),
      distant: new THREE.Color(),
    };

    const currentColors = {
      stars: new THREE.Color(),
      cyan: new THREE.Color(),
      violet: new THREE.Color(),
      distant: new THREE.Color(),
    };

    const updateThemeTargets = () => {
      if (isDarkMode()) {
        /*
         * Dark:
         * bright, cold, cinematic.
         */
        targetColors.stars.set(0xf2fbff);
        targetColors.cyan.set(0x63dcff);
        targetColors.violet.set(0xb98cff);
        targetColors.distant.set(0x9ab9ff);

        starField.baseOpacity = 0.72;
        cyanField.baseOpacity = 0.4;
        violetField.baseOpacity = 0.34;
        distantField.baseOpacity = 0.2;
      } else {
        /*
         * Light:
         * darker saturated particles instead of gray dots.
         */
        targetColors.stars.set(0x334155);
        targetColors.cyan.set(0x0891b2);
        targetColors.violet.set(0x7c3aed);
        targetColors.distant.set(0x64748b);

        starField.baseOpacity = 0.42;
        cyanField.baseOpacity = 0.24;
        violetField.baseOpacity = 0.2;
        distantField.baseOpacity = 0.12;
      }
    };

    updateThemeTargets();

    currentColors.stars.copy(targetColors.stars);
    currentColors.cyan.copy(targetColors.cyan);
    currentColors.violet.copy(targetColors.violet);
    currentColors.distant.copy(targetColors.distant);

    const themeObserver = new MutationObserver(() => {
      updateThemeTargets();
    });

    themeObserver.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["class"],
      },
    );

    // ---------------------------------------------------------------------------
    // Mouse / touch parallax
    // ---------------------------------------------------------------------------

    const pointer = {
      x: 0,
      y: 0,
    };

    const targetPointer = {
      x: 0,
      y: 0,
    };

    const handlePointerMove = (
      event: PointerEvent,
    ) => {
      targetPointer.x =
        (event.clientX / window.innerWidth) * 2 - 1;

      targetPointer.y =
        -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener(
      "pointermove",
      handlePointerMove,
      {
        passive: true,
      },
    );

    // ---------------------------------------------------------------------------
    // Resize
    // ---------------------------------------------------------------------------

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      camera.aspect = width / height;

      /*
       * Keep enough space around the Hero on very narrow phones.
       */
      camera.position.z =
        width < 640 ? 18 : 15;

      camera.updateProjectionMatrix();

      renderer.setSize(
        width,
        height,
        false,
      );
    };

    resize();

    const resizeObserver =
      new ResizeObserver(resize);

    resizeObserver.observe(canvas);

    // ---------------------------------------------------------------------------
    // Animation
    // ---------------------------------------------------------------------------

    // THREE.Clock est déprécié depuis three 0.186 : Timer fournit les mêmes
    // mesures (écoulé/delta) et sait geler le temps quand l'onglet est masqué.
    const timer = new THREE.Timer();

    let animationFrame = 0;

    const animate = () => {
      animationFrame =
        requestAnimationFrame(animate);

      timer.update();

      const elapsed =
        timer.getElapsed();

      pointer.x = lerp(
        pointer.x,
        targetPointer.x,
        0.035,
      );

      pointer.y = lerp(
        pointer.y,
        targetPointer.y,
        0.035,
      );

      // Theme transition
      currentColors.stars.lerp(
        targetColors.stars,
        0.025,
      );

      currentColors.cyan.lerp(
        targetColors.cyan,
        0.025,
      );

      currentColors.violet.lerp(
        targetColors.violet,
        0.025,
      );

      currentColors.distant.lerp(
        targetColors.distant,
        0.025,
      );

      starField.material.color.copy(
        currentColors.stars,
      );

      cyanField.material.color.copy(
        currentColors.cyan,
      );

      violetField.material.color.copy(
        currentColors.violet,
      );

      distantField.material.color.copy(
        currentColors.distant,
      );

      /*
       * Slight breathing.
       */
      const pulse =
        1 +
        Math.sin(elapsed * 1.1) * 0.05;

      const cyanPulse =
        1 +
        Math.sin(elapsed * 0.8 + 1.5) *
          0.08;

      const violetPulse =
        1 +
        Math.sin(elapsed * 0.65 + 3) *
          0.07;

      starField.material.opacity =
        starField.baseOpacity *
        pulse;

      cyanField.material.opacity =
        cyanField.baseOpacity *
        cyanPulse;

      violetField.material.opacity =
        violetField.baseOpacity *
        violetPulse;

      distantField.material.opacity =
        distantField.baseOpacity;

      // Very slow movement
      starField.points.rotation.y += 0.00018;
      starField.points.rotation.x =
        Math.sin(elapsed * 0.055) *
        0.008;

      cyanField.points.rotation.y -=
        0.00011;

      cyanField.points.rotation.x =
        Math.sin(elapsed * 0.07) *
        0.012;

      violetField.points.rotation.y +=
        0.00008;

      violetField.points.rotation.x =
        Math.cos(elapsed * 0.06) *
        0.01;

      distantField.points.rotation.y -=
        0.00005;

      // Parallax
      starField.points.position.x =
        pointer.x * 0.18;

      starField.points.position.y =
        pointer.y * 0.1;

      cyanField.points.position.x =
        pointer.x * 0.3;

      cyanField.points.position.y =
        pointer.y * 0.18;

      violetField.points.position.x =
        pointer.x * -0.2;

      violetField.points.position.y =
        pointer.y * -0.12;

      distantField.points.position.x =
        pointer.x * 0.08;

      distantField.points.position.y =
        pointer.y * 0.05;

      // Camera parallax
      camera.position.x = lerp(
        camera.position.x,
        pointer.x * 0.3,
        0.02,
      );

      camera.position.y = lerp(
        camera.position.y,
        pointer.y * 0.18,
        0.02,
      );

      camera.lookAt(0, 0, -6);

      renderer.render(scene, camera);
    };

    animate();

    // ---------------------------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------------------------

    return () => {
      cancelAnimationFrame(
        animationFrame,
      );

      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );

      resizeObserver.disconnect();
      themeObserver.disconnect();

      layers.forEach(
        ({ points, material }) => {
          points.geometry.dispose();
          material.dispose();
        },
      );

      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}