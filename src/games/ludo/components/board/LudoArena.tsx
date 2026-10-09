import { useMemo } from "react";
import * as THREE from "three";
import { getTrack } from "../../utils/positionUtils";

const WOOD_LIGHT = "#5b3b28";
const WOOD_DARK = "#4a2f20";
const WOOD_SEAM = "#2e1c12";

/**
 * Reproduction fidèle du fond bois du HTML de référence 6 joueurs.
 * Canvas 1080 (largeur) × 940 (hauteur) : 6 planches de 160 de haut,
 * séparées par un trait #2e1c12 (strokeRect). Placé à y = -20 dans l'échelle
 * SVG, ramené dans le monde (board.scale U).
 */
function WoodFloor() {
  const woodTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 940;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? WOOD_DARK : WOOD_LIGHT;
        ctx.fillRect(0, i * 160, 1080, 160);
        ctx.strokeStyle = WOOD_SEAM;
        ctx.lineWidth = 3;
        ctx.strokeRect(0, i * 160, 1080, 160);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }, []);

  return (
    <mesh position={[0, -0.427, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[23.126, 20.128]} />
      <meshStandardMaterial map={woodTexture} roughness={0.95} metalness={0} />
    </mesh>
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