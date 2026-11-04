import { Html } from "@react-three/drei";

import { TABLE } from "../engine/constants";

const DIGIT_SEGMENTS = [
  { position: [0, 0.37, 0], size: [0.34, 0.06, 0.05] },
  { position: [0.19, 0.19, 0], size: [0.06, 0.34, 0.05] },
  { position: [0.19, -0.19, 0], size: [0.06, 0.34, 0.05] },
  { position: [0, -0.37, 0], size: [0.34, 0.06, 0.05] },
  { position: [-0.19, -0.19, 0], size: [0.06, 0.34, 0.05] },
  { position: [-0.19, 0.19, 0], size: [0.06, 0.34, 0.05] },
  { position: [0, 0, 0], size: [0.34, 0.06, 0.05] },
] as const;

const ACTIVE_SEGMENTS: Record<number, readonly number[]> = {
  0: [0, 1, 2, 3, 4, 5],
  1: [1, 2],
  2: [0, 1, 6, 4, 3],
  3: [0, 1, 6, 2, 3],
  4: [5, 6, 1, 2],
  5: [0, 5, 6, 2, 3],
  6: [0, 5, 6, 4, 2, 3],
  7: [0, 1, 2],
  8: [0, 1, 2, 3, 4, 5, 6],
  9: [0, 1, 2, 3, 5, 6],
};

/** Un filet en mailles : il laisse le duel visible, contrairement au panneau opaque. */
export function RallyNet() {
  const width = TABLE.halfWidth * 2 + 0.28;
  const netY = TABLE.top + TABLE.netHeight / 2;

  return (
    <group position={[0, netY, 0]}>
      {[-width / 2, width / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, TABLE.netHeight + 0.22, 12]} />
          <meshStandardMaterial color="#282d2d" roughness={0.45} metalness={0.55} />
        </mesh>
      ))}

      <mesh position={[0, TABLE.netHeight / 2, 0]} castShadow>
        <boxGeometry args={[width + 0.08, 0.055, 0.045]} />
        <meshStandardMaterial color="#83272a" roughness={0.58} metalness={0.18} />
      </mesh>

      {Array.from({ length: 25 }, (_, index) => {
        const x = -width / 2 + (width / 24) * index;
        return (
          <mesh key={`vertical-${index}`} position={[x, 0, 0]}>
            <boxGeometry args={[0.012, TABLE.netHeight, 0.018]} />
            <meshStandardMaterial color="#252526" roughness={0.86} />
          </mesh>
        );
      })}

      {Array.from({ length: 5 }, (_, index) => {
        const y = -TABLE.netHeight / 2 + (TABLE.netHeight / 4) * index;
        return (
          <mesh key={`horizontal-${index}`} position={[0, y, 0.01]}>
            <boxGeometry args={[width, 0.012, 0.018]} />
            <meshStandardMaterial color="#252526" roughness={0.86} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Tableau de salle purement visuel. Les chiffres et les noms viennent du HUD
 * local ou du snapshot Colyseus : ce composant n'est jamais une source d'etat.
 */
export function RallyScoreboard({
  scores,
  labels,
}: {
  scores?: readonly number[];
  labels?: readonly string[];
}) {
  const nearScore = normalizeScore(scores?.[0]);
  const farScore = normalizeScore(scores?.[1]);
  const nearLabel = normalizeLabel(labels?.[0], "JOUEUR 1");
  const farLabel = normalizeLabel(labels?.[1], "JOUEUR 2");

  return (
    <group position={[0, 5.6, -13.27]} scale={[1.18, 1.18, 1.18]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3.7, 1.95, 0.2]} />
        <meshStandardMaterial color="#171b1b" roughness={0.55} metalness={0.42} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <boxGeometry args={[3.42, 1.66, 0.03]} />
        <meshStandardMaterial color="#060808" roughness={0.38} metalness={0.3} />
      </mesh>

      <ScoreName label={nearLabel} color="#efb4a7" y={0.45} />
      <ScoreName label={farLabel} color="#94d9b9" y={-0.45} />
      <ScoreRow value={nearScore} color="#df654d" x={0.88} y={0.45} />
      <ScoreRow value={farScore} color="#42b783" x={0.88} y={-0.45} />

      {/* Fixe au mur, le tableau reste au-dessus du jeu au lieu d'encombrer le sol. */}
      {[-0.78, 0.78].map((x) => (
        <mesh key={x} position={[x, -0.58, -0.12]} castShadow>
          <boxGeometry args={[0.12, 0.86, 0.08]} />
          <meshStandardMaterial color="#202828" roughness={0.62} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function ScoreRow({
  value,
  color,
  x,
  y,
}: {
  value: number;
  color: string;
  x: number;
  y: number;
}) {
  const tens = Math.floor(value / 10);
  const units = value % 10;

  return (
    <group position={[x, y, 0.16]}>
      <ScoreDigit digit={tens} color={color} x={-0.43} />
      <ScoreDigit digit={units} color={color} x={0.43} />
    </group>
  );
}

/** Les noms restent lisibles meme lorsque la camera recule dans la salle. */
function ScoreName({
  label,
  color,
  y,
}: {
  label: string;
  color: string;
  y: number;
}) {
  return (
    <Html position={[-0.92, y, 0.18]} center>
      <span
        style={{
          color,
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "10px",
          fontWeight: 800,
          letterSpacing: "0.08em",
          pointerEvents: "none",
          textShadow: "0 1px 3px #000000",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </Html>
  );
}

function ScoreDigit({
  digit,
  color,
  x,
}: {
  digit: number;
  color: string;
  x: number;
}) {
  const active = ACTIVE_SEGMENTS[digit] ?? ACTIVE_SEGMENTS[0];

  return (
    <group position={[x, 0, 0]}>
      {DIGIT_SEGMENTS.map((segment, index) => {
        const lit = active.includes(index);
        return (
          <mesh key={index} position={segment.position}>
            <boxGeometry args={segment.size} />
            <meshStandardMaterial
              color={lit ? color : "#162020"}
              emissive={lit ? color : "#000000"}
              emissiveIntensity={lit ? 1.25 : 0}
              roughness={0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function normalizeScore(value: number | undefined) {
  return Math.max(0, Math.min(99, Math.trunc(value ?? 0)));
}

function normalizeLabel(value: string | undefined, fallback: string) {
  const label = value?.trim().replace(/\s+/g, " ") ?? "";
  return (label || fallback).slice(0, 10).toUpperCase();
}
