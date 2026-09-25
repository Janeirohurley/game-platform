"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// 3D Dice with GLB model and Three.js rotation
function DiceComponent({
  position,
  rotation,
  isAnimating,
  onClick,
}: {
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

  // Spin in place while rolling, otherwise sit still showing the result
  useFrame((state, delta) => {
    if (!diceRef.current) return;

    // The dice never leaves its spot on the board - only its rotation changes.
    diceRef.current.position.set(...position);

    if (isAnimating) {
      // Tumble on all three axes to sell the "rolling" feel.
      diceRef.current.rotation.x += delta * 9;
      diceRef.current.rotation.y += delta * 7;
      diceRef.current.rotation.z += delta * 5;
    } else {
      // Settled - show the exact rotation for the rolled value.
      diceRef.current.rotation.set(...rotation);
    }
  });

  return (
    <group
      ref={diceRef}
      position={position}
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
      {/* GLB Dice Model */}
      <primitive
        object={clonedModel}
        scale={[0.5, 0.5, 0.5]} // Scale down the model to fit our scene
      />
    </group>
  );
}

// Preload the dice model
useGLTF.preload("/dice_highres_red.glb");

export default DiceComponent;
