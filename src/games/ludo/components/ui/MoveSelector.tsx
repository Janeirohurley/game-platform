"use client";

import type { GameState } from "../../types/game";
import { destinationOf } from "../../utils/rules";
import { getTrack } from "../../utils/positionUtils";
import { themeFor } from "../../data/boardTheme";
import { playSound } from "@/lib/sounds";

// Sélection précise du pion à jouer.
//
// Viser un pion dans la scène 3D est imprécis — surtout au doigt, et plus
// encore quand deux pions partagent une case et se recouvrent. Ce panneau
// liste les pions RÉELLEMENT jouables (ceux que le moteur a marqués
// `canMove`) sous forme de gros boutons : la cible est large, sans ambiguïté
// et indépendante de l'angle de caméra.
//
// Le libellé dit ce que le pion VA faire. Deux pions empilés ont forcément
// la même destination, donc le même libellé : quand les libellés se
// ressemblent, le choix n'a pas d'importance — et sinon ils sont distincts.
function MoveSelector({
  gameState,
  onSelectPiece,
}: {
  gameState: GameState;
  onSelectPiece: (pieceIndex: number) => void;
}) {
  const player = gameState.players[gameState.currentPlayerIndex];
  const dice = gameState.diceValue;
  if (!player || dice === null) return null;

  const movable = player.pieces
    .map((piece, index) => ({ piece, index }))
    .filter(({ piece }) => piece.canMove);

  if (movable.length === 0) return null;

  const track = getTrack(gameState.playerCount);
  const palette = themeFor(track.shape).players;

  const labelFor = (index: number, position: number) => {
    if (position === -1) return "Sortir de la base";
    const destination = destinationOf(
      { index, position },
      dice,
      track.finishedPosition,
    );
    if (destination === null) return "Avancer";
    if (destination === track.finishedPosition) return "Entrer au centre";
    if (destination >= track.homeColumnStart) {
      return `Couloir — case ${destination - track.homeColumnStart + 1}`;
    }
    return `Piste — case ${destination}`;
  };

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
        {movable.length > 1 ? "Choisir un pion" : "Jouer ce pion"}
      </div>
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${Math.min(movable.length, 2)}, minmax(0, 1fr))`,
        }}
      >
        {movable.map(({ piece, index }) => (
          <button
            key={piece.id}
            type="button"
            onClick={() => {
              playSound("buttonClick");
              onSelectPiece(index);
            }}
            className="flex min-h-[56px] items-center gap-2.5 rounded-xl bg-white/10 px-3 py-2 text-left ring-1 ring-white/20 transition-colors hover:bg-white/20 active:scale-[0.98]"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white shadow-inner ring-2 ring-white/50"
              style={{ backgroundColor: palette[player.color] }}
            >
              {index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-tight">
                Pion {index + 1}
              </span>
              <span className="block truncate text-[11px] text-white/70">
                {labelFor(index, piece.position)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default MoveSelector;
