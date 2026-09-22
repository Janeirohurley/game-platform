"use client";

import { Text } from "@react-three/drei";

// Safe zone star markers
function SafeZoneStars({
  safeZones,
}: {
  safeZones: Array<{ x: number; z: number; color: string }>;
}) {
  return (
    <>
      {safeZones.map((zone, index) => (
        <group key={`star-${index}`}>
          {/* Star symbol using Text - white for visibility on colored background */}
          <Text
            position={[zone.x, 0.18, zone.z]}
            fontSize={0.5}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            rotation={[-Math.PI / 2, 0, 0]}
          >
            ⭐
          </Text>
        </group>
      ))}
    </>
  );
}

export default SafeZoneStars;
