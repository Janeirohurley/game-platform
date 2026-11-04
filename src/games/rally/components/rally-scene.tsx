"use client";

import { useRef } from "react";
import { ContactShadows } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { ACESFilmicToneMapping, type Group, type Mesh } from "three";

import { RallyNet, RallyScoreboard } from "./rally-court-details";
import { TABLE } from "../engine/constants";

/** Where things are right now, whoever decided it. */
export interface CourtPositions {
  ball: { x: number; y: number; z: number };
  near: { x: number; y: number; vx?: number };
  far: { x: number; y: number; vx?: number };
}

/**
 * One camera for local and online Rally. It is set back slightly so the
 * room is legible without changing the table coordinates or controls.
 */
export const RALLY_CAMERA: {
  position: [number, number, number];
  rotation: [number, number, number];
  fov: number;
} = {
  // Vue haute et reculée : elle reprend le cadrage de salle du visuel de référence.
  position: [0, 4.25, 10.8],
  rotation: [-0.3, 0, 0],
  fov: 46,
};

/** Shared renderer settings keep local and online Rally visually identical. */
export const RALLY_RENDERER = {
  antialias: true,
  powerPreference: "high-performance",
  toneMapping: ACESFilmicToneMapping,
  toneMappingExposure: 1.08,
} as const;

/**
 * The court.
 *
 * Reads positions every frame through a getter rather than React state:
 * at 120 steps a second, re-rendering the tree would be wasteful and
 * would stutter. It does not care whether the numbers come from a local
 * engine or from an authoritative server — it only draws them.
 */
export function RallyScene({
  read,
  scores,
  scoreLabels,
}: {
  read: () => CourtPositions;
  scores?: readonly number[];
  scoreLabels?: readonly string[];
}) {
  const ball = useRef<Mesh>(null);
  const playerPaddle = useRef<Group>(null);
  const cpuPaddle = useRef<Group>(null);

  useFrame(() => {
    const world = read();

    if (ball.current) {
      ball.current.position.set(world.ball.x, world.ball.y, world.ball.z);
    }
    if (playerPaddle.current) {
      playerPaddle.current.position.set(
        world.near.x,
        world.near.y,
        TABLE.paddleZ,
      );
      // Tilt with the sweep, so a fast move reads as a swing.
      playerPaddle.current.rotation.z = -(world.near.vx ?? 0) * 0.06;
    }
    if (cpuPaddle.current) {
      cpuPaddle.current.position.set(world.far.x, world.far.y, -TABLE.paddleZ);
      cpuPaddle.current.rotation.z = -(world.far.vx ?? 0) * 0.06;
    }
  });

  const { halfWidth, halfLength, top, ballRadius, paddleRadius } =
    TABLE;

  return (
    <>
      <RallyRoom />

      {/* Playing surface */}
      <mesh
        position={[0, top, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <planeGeometry args={[halfWidth * 2, halfLength * 2]} />
        <meshPhysicalMaterial
          color="#087eaa"
          roughness={0.48}
          metalness={0.05}
          clearcoat={0.18}
          clearcoatRoughness={0.32}
        />
      </mesh>

      {/* Table edge */}
      <mesh position={[0, top - 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[halfWidth * 2 + 0.06, 0.08, halfLength * 2 + 0.06]} />
        <meshStandardMaterial color="#e9e5d9" roughness={0.5} metalness={0.08} />
      </mesh>
      <TableUndercarriage />

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

      <RallyNet />
      <RallyScoreboard scores={scores} labels={scoreLabels} />

      {/* Ball */}
      <mesh ref={ball} castShadow>
        <sphereGeometry args={[ballRadius, 24, 24]} />
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
        <Paddle radius={paddleRadius} face="#23865e" />
      </group>
    </>
  );
}

/**
 * Le terrain reste le seul element interactif : cette salle ne contient que
 * du decor. Ainsi, le meme rendu peut habiller le match local et le match
 * autoritaire sans introduire de seconde source d'etat ou de collision.
 */
function RallyRoom() {
  const tableLegs = [
    [-1.8, -3.05],
    [1.8, -3.05],
    [-1.8, 3.05],
    [1.8, 3.05],
  ] as const;

  return (
    <>
      <ambientLight intensity={0.46} />
      <hemisphereLight args={["#b8c8c2", "#463c32", 0.56]} />
      <spotLight
        position={[0, 9, 3]}
        angle={0.62}
        penumbra={0.7}
        intensity={1.8}
        color="#fff7dd"
        castShadow
        shadow-bias={-0.00015}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
        shadow-normalBias={0.025}
      />
      <pointLight
        position={[-6, 3.4, -4]}
        intensity={2.25}
        distance={9}
        color="#dceef0"
      />
      <pointLight
        position={[6, 3.4, -4]}
        intensity={1.65}
        distance={8}
        color="#fff1c8"
      />

      {/* Sol sombre : il recueille les ombres de la table et donne une echelle a la salle. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[36, 34]} />
        <meshStandardMaterial color="#735f49" roughness={0.82} metalness={0.03} />
      </mesh>
      <Floorboards />
      <ContactShadows
        position={[0, 0.025, 0]}
        opacity={0.32}
        scale={17}
        blur={2.4}
        far={5}
        color="#172326"
      />

      {/* Mur du fond et murs lateraux : la salle s'ouvre autour de la table,
          comme un vrai gymnase plutot qu'un decor serre. */}
      <mesh position={[0, 3.9, -13.5]} receiveShadow>
        <boxGeometry args={[27, 7.8, 0.3]} />
        <meshStandardMaterial color="#78878a" roughness={0.9} />
      </mesh>
      <mesh position={[-13.35, 3.9, -1]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[25.5, 7.8, 0.3]} />
        <meshStandardMaterial color="#65787c" roughness={0.92} />
      </mesh>
      <mesh position={[13.35, 3.9, -1]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <boxGeometry args={[25.5, 7.8, 0.3]} />
        <meshStandardMaterial color="#65787c" roughness={0.92} />
      </mesh>
      {/* L'entree reste ouverte face a la camera, mais un linteau ferme la
          silhouette de la salle sans masquer le terrain. */}
      <mesh position={[0, 6.9, 12.5]} receiveShadow>
        <boxGeometry args={[27, 1.8, 0.3]} />
        <meshStandardMaterial color="#65787c" roughness={0.92} />
      </mesh>
      <mesh position={[0, 1.3, -13.28]}>
        <boxGeometry args={[26.7, 1.65, 0.05]} />
        <meshStandardMaterial color="#4d696d" roughness={0.84} />
      </mesh>
      <mesh position={[0, 0.27, -11.7]} castShadow receiveShadow>
        <boxGeometry args={[20.5, 0.54, 1.55]} />
        <meshStandardMaterial color="#2d3638" roughness={0.78} />
      </mesh>
      <RearWindows />
      <CeilingBeams />

      {/* Les montants encadrent la table sans ajouter de HUD dans la zone de jeu. */}
      {[-6, 0, 6].map((x) => (
        <mesh key={x} position={[x, 3.9, -13.3]}>
          <boxGeometry args={[0.08, 4.2, 0.04]} />
          <meshStandardMaterial color="#344548" roughness={0.68} />
        </mesh>
      ))}

      {/* Les suspensions chaudes separent la zone de jeu des tribunes sans
          placer d'element entre le joueur et la table. */}
      {[-5, 5].map((x) => (
        <group key={x} position={[x, 7.1, -1.5]}>
          <mesh>
            <cylinderGeometry args={[0.26, 0.38, 0.18, 20]} />
            <meshStandardMaterial
              color="#faf6e9"
              emissive="#faf6e9"
              emissiveIntensity={0.7}
            />
          </mesh>
          <pointLight intensity={1.6} distance={7.4} color="#fff7dd" />
        </group>
      ))}

      {/* Petites tribunes laterales : elles renforcent le lieu sans masquer le duel. */}
      {[-1, 1].map((side) => (
        <SpectatorBench key={side} side={side} />
      ))}
      <EquipmentBench />

      {/* Les pieds restent purement visuels : les dimensions de simulation demeurent dans TABLE. */}
      {tableLegs.map(([x, z]) => (
        <group key={`${x}-${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.18, 0.72, 0.18]} />
            <meshStandardMaterial color="#aa4037" roughness={0.65} metalness={0.16} />
          </mesh>
          <mesh position={[0, 0.025, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 0.05, 16]} />
            <meshStandardMaterial color="#22292a" roughness={0.42} metalness={0.52} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Three shallow rows read as seating while keeping the court unobstructed. */
function SpectatorBench({ side }: { side: number }) {
  return (
    <group position={[side * 9.6, 0, -1.2]}>
      {[0, 1, 2].map((row) => (
        <mesh
          key={row}
          position={[0, 0.24 + row * 0.32, -0.72 + row * 0.48]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2.4, 0.48, 1.12]} />
          <meshStandardMaterial
            color={row === 2 ? "#20353a" : "#16272c"}
            roughness={0.82}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Les variations restent subtiles : le parquet semble reel sans devenir un motif distrayant. */
function Floorboards() {
  const shades = ["#7d654d", "#6f5944", "#876e53", "#735b45"] as const;

  return (
    <group>
      {Array.from({ length: 18 }, (_, index) => (
        <mesh key={`plank-${index}`} position={[-12.58 + index * 1.48, 0.011, -0.5]} receiveShadow>
          <boxGeometry args={[1.43, 0.018, 26.3]} />
          <meshStandardMaterial
            color={shades[index % shades.length]}
            roughness={0.68}
            metalness={0.04}
          />
        </mesh>
      ))}
      {Array.from({ length: 19 }, (_, index) => (
        <mesh key={`seam-${index}`} position={[0, 0.023, -11.7 + index * 1.3]}>
          <boxGeometry args={[26.7, 0.014, 0.018]} />
          <meshStandardMaterial color="#45362b" roughness={0.84} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The rear windows and curtains borrow the depth cues of the supplied club
 * reference. They stay behind the table, so visual atmosphere never masks a
 * ball or a paddle in the active court.
 */
function RearWindows() {
  return (
    <>
      {[-6, 0, 6].map((x) => (
        <group key={x} position={[x, 4, -13.28]}>
          <mesh>
            <boxGeometry args={[3.9, 3.2, 0.06]} />
            <meshStandardMaterial
              color="#bfd0d0"
              emissive="#c9d9d5"
              emissiveIntensity={0.12}
              roughness={0.38}
            />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[0.07, 3.4, 0.08]} />
            <meshStandardMaterial color="#17252c" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[4.04, 0.07, 0.08]} />
            <meshStandardMaterial color="#17252c" roughness={0.7} />
          </mesh>
          {[-2.08, 2.08].map((offset) => (
            <mesh key={offset} position={[offset, 0, 0.1]}>
              <boxGeometry args={[0.44, 3.65, 0.12]} />
              <meshStandardMaterial color="#182027" roughness={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Les poutres donnent une profondeur structurelle au plafond du gymnase. */
function CeilingBeams() {
  return (
    <group>
      {[-10, -3, 4, 11].map((z) => (
        <mesh key={z} position={[0, 7.62, z]} castShadow>
          <boxGeometry args={[26.7, 0.22, 0.36]} />
          <meshStandardMaterial color="#324245" roughness={0.72} metalness={0.14} />
        </mesh>
      ))}
      {[-8.8, 8.8].map((x) => (
        <mesh key={x} position={[x, 7.5, -0.8]} castShadow>
          <boxGeometry args={[0.3, 0.3, 25.8]} />
          <meshStandardMaterial color="#324245" roughness={0.72} metalness={0.14} />
        </mesh>
      ))}
    </group>
  );
}

/** Le châssis sombre sous le plateau lui donne une masse de table de competition. */
function TableUndercarriage() {
  return (
    <group>
      <mesh position={[0, TABLE.top - 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[TABLE.halfWidth * 2 - 0.24, 0.12, TABLE.halfLength * 2 - 1.1]} />
        <meshStandardMaterial color="#1e2c31" roughness={0.48} metalness={0.34} />
      </mesh>
      {[-2.75, 2.75].map((z) => (
        <mesh key={z} position={[0, TABLE.top - 0.32, z]} castShadow>
          <boxGeometry args={[TABLE.halfWidth * 2 - 0.5, 0.1, 0.14]} />
          <meshStandardMaterial color="#26363b" roughness={0.48} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

/** A small equipment bench makes the open side of the room feel occupied. */
function EquipmentBench() {
  return (
    <group position={[-8.2, 0.5, 5.8]} rotation={[0, 0.18, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.25, 0.22, 0.62]} />
        <meshStandardMaterial color="#26383c" roughness={0.72} />
      </mesh>
      {[-0.86, 0.86].map((x) => (
        <mesh key={x} position={[x, -0.55, 0]} castShadow>
          <boxGeometry args={[0.13, 0.98, 0.13]} />
          <meshStandardMaterial color="#17252a" roughness={0.68} metalness={0.22} />
        </mesh>
      ))}
      {[-0.44, 0.44].map((x) => (
        <mesh key={x} position={[x, 0.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.05, 20]} />
          <meshStandardMaterial color={x < 0 ? "#d9553a" : "#263238"} roughness={0.56} />
        </mesh>
      ))}
    </group>
  );
}

function Paddle({ radius, face }: { radius: number; face: string }) {
  return (
    <>
      <mesh position={[0, 0, -0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius + 0.018, radius + 0.018, 0.022, 28]} />
        <meshStandardMaterial color="#241d1b" roughness={0.5} metalness={0.18} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius, radius, 0.035, 28]} />
        <meshPhysicalMaterial color={face} roughness={0.48} clearcoat={0.12} />
      </mesh>
      {/* Handle */}
      <mesh position={[0, -radius - 0.16, 0]}>
        <boxGeometry args={[0.11, 0.34, 0.05]} />
        <meshStandardMaterial color="#c8b48c" roughness={0.75} />
      </mesh>
    </>
  );
}
