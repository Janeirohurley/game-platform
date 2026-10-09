"use client";

import { useEffect, useRef, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

/** The named angles the camera can snap to. */
export type CameraViewName = "overview" | "top" | "front" | "left" | "right";

/**
 * Camera positions per view. The board spans roughly 13×13 units centred
 * on the origin; every view keeps the WHOLE table in frame.
 */
export const CAMERA_VIEWS: Record<
  CameraViewName,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  // Default: three-quarter view from the yellow player's side.
  overview: { position: [0, 16, 16], target: [0, 0, 0] },
  // Straight down — the classic flat board reading.
  top: { position: [0.001, 17, 0.001], target: [0, 0, 0] },
  // Low angle from the near edge — pieces stand out.
  front: { position: [0, 7, 15], target: [0, 0, 0] },
  left: { position: [-15, 9, 0.001], target: [0, 0, 0] },
  right: { position: [15, 9, 0.001], target: [0, 0, 0] },
};

type OrbitRef = ComponentRef<typeof OrbitControls>;

export interface CameraRigProps {
  /** The view to frame. Changing it animates the camera there. */
  view: CameraViewName;
  /** Spin slowly around the table (off by default — a stable view). */
  autoRotate: boolean;
  /** When true, ignore user input: the view is locked. */
  locked: boolean;
  /** Fires when the user drags — clears the active view back to "free". */
  onUserMove?: () => void;
}

/**
 * OrbitControls wrapper that ANIMATES the camera to named views instead
 * of teleporting, and keeps the table centred: panning is disabled so a
 * stray drag can never push the board out of frame.
 */
export function CameraRig({
  view,
  autoRotate,
  locked,
  onUserMove,
}: CameraRigProps) {
  const controlsRef = useRef<OrbitRef | null>(null);
  const { camera } = useThree();

  // Where the animation is heading; null when idle.
  const flight = useRef<{
    fromPosition: THREE.Vector3;
    toPosition: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    start: number;
  } | null>(null);

  // Watch for view changes and start a smooth flight.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const destination = CAMERA_VIEWS[view];
    flight.current = {
      fromPosition: camera.position.clone(),
      toPosition: new THREE.Vector3(...destination.position),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(...destination.target),
      start: performance.now(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Drive the flight each frame until it lands.
  useFrame(() => {
    const controls = controlsRef.current;
    const current = flight.current;
    if (!controls || !current) return;

    const t = Math.min(
      1,
      (performance.now() - current.start) / 700,
    );
    // Ease in-out for a natural glide.
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    camera.position.lerpVectors(current.fromPosition, current.toPosition, eased);
    controls.target.lerpVectors(current.fromTarget, current.toTarget, eased);
    controls.update();

    if (t >= 1) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={!locked}
      enabled={!locked}
      autoRotate={autoRotate}
      autoRotateSpeed={0.8}
      minDistance={8}
      maxDistance={26}
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2.05}
      onStart={onUserMove}
    />
  );
}
