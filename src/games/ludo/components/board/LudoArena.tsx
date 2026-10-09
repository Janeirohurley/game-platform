import { getTrack } from "../../utils/positionUtils";

const WOOD_LIGHT = "#5b3b28";
const WOOD_DARK = "#4a2f20";
const WOOD_SEAM = "#2e1c12";

// Reproduit le panneau de la maquette 6 joueurs : une planche horizontale
// sur deux (#5b3b28 / #4a2f20), séparées par un trait #2e1c12. Échelle :
// la circonférence de l'hexagone (R 506u) vaut 10.2, donc 1u = 0.02016 ;
// le panneau fait 1080x940u soit 21.8 x 19, quatre planches de 160u (3.22).
const PANEL_HALF_WIDTH = (540 * 10.2) / 506; // 21.77 -> ~10.9 de chaque côté
const PLANKS = 6;
const PLANK_HALF_TALL = (80 * 10.2) / 506; // moitié d'une planche de 160u
const SEAM_WIDTH = (3 * 10.2) / 506;

function WoodFloor() {
  const plankCenters = Array.from(
    { length: PLANKS },
    (_, i) => -PLANK_HALF_TALL * PLANKS + PLANK_HALF_TALL + i * 2 * PLANK_HALF_TALL,
  );

  return (
    <group>
      {plankCenters.map((z, i) => (
        <mesh key={`plank-${i}`} position={[0, -0.19, z]}>
          <boxGeometry
            args={[PANEL_HALF_WIDTH * 2, 0.08, PLANK_HALF_TALL * 2]}
          />
          <meshStandardMaterial
            color={i % 2 === 0 ? WOOD_LIGHT : WOOD_DARK}
            roughness={0.9}
          />
        </mesh>
      ))}
      {plankCenters.slice(0, -1).map((z, i) => (
        <mesh key={`seam-${i}`} position={[0, -0.147, z + PLANK_HALF_TALL]}>
          <boxGeometry args={[PANEL_HALF_WIDTH * 2, 0.085, SEAM_WIDTH]} />
          <meshStandardMaterial color={WOOD_SEAM} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export default function LudoArena({
  playerCount,
}: {
  playerCount: number;
}) {
  if (getTrack(playerCount).shape === "hex") {
    return <WoodFloor />;
  }
  return <gridHelper args={[100, 100, "#ffffff", "#4D4D4D"]} />;
}