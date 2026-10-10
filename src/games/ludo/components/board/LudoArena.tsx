import LudoScene from "./LudoScene";

/**
 * Conservé pour ne pas casser les imports existants : le décor est
 * maintenant `LudoScene` (table de jeu, lumières, ombres). L'ancien décor —
 * `gridHelper` pour la croix et planche de bois découpée pour l'hexagone —
 * est supprimé.
 */
export default function LudoArena({ playerCount }: { playerCount: number }) {
  return <LudoScene playerCount={playerCount} />;
}
