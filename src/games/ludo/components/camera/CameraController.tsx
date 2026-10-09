"use client";

import { useState } from "react";
import { useFrame } from "@react-three/fiber";

// Camera controller with reset and preset views
function CameraController({
  isSpacePressed,
  resetCamera,
  cameraView,
}: {
  isSpacePressed: boolean;
  resetCamera: boolean;
  cameraView: string | null;
}) {
  const [angle, setAngle] = useState(0);

  useFrame((state) => {
    // Handle camera reset
    if (resetCamera) {
      state.camera.position.set(0, 16, 16);
      state.camera.lookAt(0, 0, 0);
      return;
    }

    // Handle preset camera views
    if (cameraView) {
      const distance = 20;
      switch (cameraView) {
        case "top":
          state.camera.position.set(0, 25, 0);
          state.camera.lookAt(0, 0, 0);
          break;
        case "front":
          state.camera.position.set(0, 12, distance);
          state.camera.lookAt(0, 0, 0);
          break;
        case "left":
          state.camera.position.set(-distance, 12, 0);
          state.camera.lookAt(0, 0, 0);
          break;
        case "right":
          state.camera.position.set(distance, 12, 0);
          state.camera.lookAt(0, 0, 0);
          break;
        case "perspective":
          state.camera.position.set(0, 16, 16);
          state.camera.lookAt(0, 0, 0);
          break;
      }
      return;
    }

    // Handle space-pressed auto-rotate
    if (isSpacePressed) {
      setAngle((prev) => prev + 0.01);
      const radius = 20;
      state.camera.position.x = Math.cos(angle) * radius;
      state.camera.position.z = Math.sin(angle) * radius;
      state.camera.position.y = 15;
      state.camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

export default CameraController;
