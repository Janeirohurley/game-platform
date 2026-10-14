"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/** Durée du glissement vers la base du joueur actif. */
const MOVE_SECONDS = 0.5;
/** Échelle du modèle GLB dans la scène (inchangée). */
const SCALE = 0.5;

// 3D Dice with GLB model and Three.js rotation
function DiceComponent({
  position,
  rotation,
  isAnimating,
  onClick,
}: {
  /**
   * Point de POSE au sol (x, y du dessus de la plaque, z). Le dé se pose
   * dessus : le groupe est remonté de la demi-hauteur réelle du modèle
   * pour que sa boîte repose sur la plaque, et non son origine.
   */
  position: [number, number, number];
  rotation: [number, number, number];
  isAnimating: boolean;
  onClick?: () => void;
}) {
  const diceRef = useRef<THREE.Group>(null);

  // Load the GLB dice model
  const { scene: diceModel } = useGLTF("/dice_highres_red.glb");

  // Clone the model to avoid sharing between instances
  const clonedModel = useMemo(() => {
    const cloned = diceModel.clone();
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return cloned;
  }, [diceModel]);

  /*
   * Mesures réelles du GLB, pas supposées.
   *
   * On ne peut pas compter sur le fait que l'origine du modèle soit en bas
   * ou au centre : on lit la boîte englobante, on recentre le modèle sur
   * l'origine du groupe (rotation propre autour de son centre) et on
   * retient sa hauteur pour le poser exactement sur la plaque. La boîte
   * sert aussi de base à la zone tactile élargie.
   */
  const box = useMemo(
    () => new THREE.Box3().setFromObject(clonedModel),
    [clonedModel],
  );
  const size = useMemo(() => box.getSize(new THREE.Vector3()), [box]);
  const boxCenter = useMemo(() => box.getCenter(new THREE.Vector3()), [box]);
  const halfHeight = (size.y * SCALE) / 2;
  const halfExtent = (Math.max(size.x, size.z) * SCALE) / 2;

  // La cible réelle : le point au sol rehaussé d'une demi-hauteur, pour que
  // le DESSOUS du dé touche la plaque (et non son centre).
  const target = useMemo(
    () =>
      new THREE.Vector3(
        position[0],
        position[1] + halfHeight,
        position[2],
      ),
    [position, halfHeight],
  );

  const from = useRef(target.clone());
  const goal = useRef(target.clone());
  const progress = useRef(1);
  const reduceMotion = useRef<boolean | null>(null);

  useFrame((_, delta) => {
    const group = diceRef.current;
    if (!group) return;

    if (reduceMotion.current === null) {
      reduceMotion.current =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    // Nouvelle destination : on repart d'ici, quel que soit l'état.
    if (!goal.current.equals(target)) {
      from.current.copy(group.position);
      goal.current.copy(target);
      progress.current = 0;
    }

    if (reduceMotion.current) {
      progress.current = 1;
    } else if (progress.current < 1) {
      progress.current = Math.min(1, progress.current + delta / MOVE_SECONDS);
    }

    const t = progress.current;
    // Lissage aux deux bouts : départ et arrivée posés.
    const ease = t * t * (3 - 2 * t);
    const straightY = from.current.y + (goal.current.y - from.current.y) * ease;
    const distance = Math.hypot(
      goal.current.x - from.current.x,
      goal.current.z - from.current.z,
    );
    // Petit arc pendant le trajet, jamais à l'arrêt.
    const arc = t < 1 ? Math.sin(Math.PI * t) * Math.min(0.5, distance * 0.3 + 0.2) : 0;

    group.position.set(
      from.current.x + (goal.current.x - from.current.x) * ease,
      straightY + arc,
      from.current.z + (goal.current.z - from.current.z) * ease,
    );

    if (isAnimating) {
      // Tumble on all three axes to sell the "rolling" feel.
      group.rotation.x += delta * 9;
      group.rotation.y += delta * 7;
      group.rotation.z += delta * 5;
    } else {
      // Settled - show the exact rotation for the rolled value.
      group.rotation.set(...rotation);
    }
  });

  return (
    <group
      ref={diceRef}
      position={[position[0], position[1] + halfHeight, position[2]]}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={() => {
        if (onClick) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {/* GLB Dice Model, recentré pour tourner autour de son centre. */}
      <primitive
        object={clonedModel}
        scale={[SCALE, SCALE, SCALE]}
        position={[
          -boxCenter.x * SCALE,
          -boxCenter.y * SCALE,
          -boxCenter.z * SCALE,
        ]}
      />

      {/* Zone tactile élargie, invisible : le dé reste petit à l'écran mais
          reste facile à toucher. `opacity 0` (et non `visible={false}`)
          pour rester une cible de raycast. */}
      <mesh>
        <boxGeometry
          args={[
            Math.max(halfExtent, halfHeight) * 2 * 2.6,
            Math.max(halfExtent, halfHeight) * 2 * 2.2,
            Math.max(halfExtent, halfHeight) * 2 * 2.6,
          ]}
        />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Preload the dice model
useGLTF.preload("/dice_highres_red.glb");

export default DiceComponent;
