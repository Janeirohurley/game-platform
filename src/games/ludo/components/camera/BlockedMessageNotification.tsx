"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

// Camera-facing blocked message notification
function BlockedMessageNotification() {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Always face the camera (billboard effect)
      meshRef.current.lookAt(state.camera.position);

      // Position it in front of the camera at a reasonable distance
      const cameraDirection = new THREE.Vector3();
      state.camera.getWorldDirection(cameraDirection);

      // Position 8 units in front of camera
      const notificationPosition = state.camera.position.clone();
      notificationPosition.add(cameraDirection.multiplyScalar(8));

      meshRef.current.position.copy(notificationPosition);
    }
  });

  return (
    <group ref={meshRef}>
      {/* Bright red background - impossible to miss */}
      <mesh>
        <planeGeometry args={[6, 1.5]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.9} />
      </mesh>

      {/* White border for contrast */}
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[6.2, 1.7]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={1.0}
          wireframe
        />
      </mesh>

      {/* Reasonably sized black text on red background */}
      <Text
        position={[0, 0.1, 0.01]}
        fontSize={0.3}
        color="#000000"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        🎲 DICE IS ALREADY ROLLING
      </Text>

      {/* Subtitle */}
      <Text
        position={[0, -0.3, 0.01]}
        fontSize={0.2}
        color="#000000"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        PLEASE WAIT...
      </Text>
    </group>
  );
}

export default BlockedMessageNotification;
