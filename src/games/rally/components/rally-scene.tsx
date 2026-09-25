"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";

import { TABLE } from "../engine/constants";
import type { RallyMatch } from "../engine/rally-match";

/**
 * The court.
 *
 * Reads the match directly every frame through a ref rather than React
 * state: at 120 steps a second, re-rendering the tree would be wasteful
 * and would stutter. The engine owns the numbers, this only draws them.
 */
export function RallyScene({ match }: { match: RallyMatch }) {
  const ball = useRef<Mesh>(null);
  const playerPaddle = useRef<Group>(null);
  const cpuPaddle = useRef<Group>(null);

  useFrame(() => {
    if (ball.current) {
      ball.current.position.set(match.ball.x, match.ball.y, match.ball.z);
    }
    if (playerPaddle.current) {
      playerPaddle.current.position.set(
        match.player.x,
        match.player.y,
        match.player.z,
      );
      // Tilt with the sweep, so a fast move reads as a swing.
      playerPaddle.current.rotation.z = -match.player.vx * 0.06;
    }
    if (cpuPaddle.current) {
      cpuPaddle.current.position.set(match.cpu.x, match.cpu.y, match.cpu.z);
      cpuPaddle.current.rotation.z = -match.cpu.vx * 0.06;
    }
  });

  const { halfWidth, halfLength, top, netHeight, ballRadius, paddleRadius } =
    TABLE;

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 9, 6]} intensity={1.5} castShadow />
      <directionalLight position={[-4, 6, -4]} intensity={0.4} />

      {/* Playing surface */}
      <mesh position={[0, top, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[halfWidth * 2, halfLength * 2]} />
        <meshStandardMaterial color="#1d4f3f" roughness={0.85} />
      </mesh>

      {/* Table edge */}
      <mesh position={[0, top - 0.04, 0]}>
        <boxGeometry args={[halfWidth * 2 + 0.06, 0.08, halfLength * 2 + 0.06]} />
        <meshStandardMaterial color="#e9e7df" roughness={0.7} />
      </mesh>

      {/* Centre line, along the length */}
      <mesh position={[0, top + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.03, halfLength * 2]} />
        <meshBasicMaterial color="#f4f2ec" />
      </mesh>

      {/* Side lines */}
      {[-halfWidth + 0.03, halfWidth - 0.03].map((x) => (
        <mesh
          key={x}
          position={[x, top + 0.002, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.05, halfLength * 2]} />
          <meshBasicMaterial color="#f4f2ec" />
        </mesh>
      ))}

      {/* End lines */}
      {[-halfLength + 0.03, halfLength - 0.03].map((z) => (
        <mesh
          key={z}
          position={[0, top + 0.002, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[halfWidth * 2, 0.05]} />
          <meshBasicMaterial color="#f4f2ec" />
        </mesh>
      ))}

      {/* Net */}
      <mesh position={[0, top + netHeight / 2, 0]}>
        <boxGeometry args={[halfWidth * 2 + 0.26, netHeight, 0.015]} />
        <meshStandardMaterial
          color="#20302a"
          transparent
          opacity={0.55}
          roughness={1}
        />
      </mesh>
      <mesh position={[0, top + netHeight, 0]}>
        <boxGeometry args={[halfWidth * 2 + 0.3, 0.035, 0.03]} />
        <meshStandardMaterial color="#f4f2ec" />
      </mesh>

      {/* Ball */}
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[ballRadius, 20, 20]} />
        <meshStandardMaterial
          color="#fffdf5"
          emissive="#fff3d0"
          emissiveIntensity={0.35}
          roughness={0.45}
        />
      </mesh>

      {/* Player paddle — terracotta, the reference's accent */}
      <group ref={playerPaddle}>
        <Paddle radius={paddleRadius} face="#d9553a" />
      </group>

      {/* Opponent paddle */}
      <group ref={cpuPaddle}>
        <Paddle radius={paddleRadius} face="#24302b" />
      </group>
    </>
  );
}

function Paddle({ radius, face }: { radius: number; face: string }) {
  return (
    <>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.035, 28]} />
        <meshStandardMaterial color={face} roughness={0.6} />
      </mesh>
      {/* Handle */}
      <mesh position={[0, -radius - 0.16, 0]}>
        <boxGeometry args={[0.11, 0.34, 0.05]} />
        <meshStandardMaterial color="#c8b48c" roughness={0.75} />
      </mesh>
    </>
  );
}
