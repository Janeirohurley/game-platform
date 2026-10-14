// Moteur de tour du mode LOCAL, en fonctions PURES.
//
// En ligne, c'est le serveur qui décide du tour (voir `ludo-room.ts`). En
// local, il n'y a personne : c'est CE module qui prend la décision. Il est
// isolé de React et du rendu pour deux raisons :
//   - on peut vérifier « un lancer / un coup = une seule transition d'état »
//     sans monter un composant 3D ;
//   - le composant ne fait plus que déclencher une action, il ne calcule plus
//     la suite de la partie (c'est là que les anciennes transitions se
//     marchaient dessus et faisaient sauter ou rejouer des tours).
//
// Il réutilise `utils/rules.ts` : une seule définition de ce qu'est un coup
// légal et de ce qui donne un tour supplémentaire.
//
// RÈGLE DE TOUR (identique au serveur, `ludo-rules.ts`) :
//   - un 6, une capture ou un pion arrivé au centre → le MÊME joueur relance ;
//   - sinon → le joueur suivant ;
//   - un lancer sans aucun coup légal → le joueur suivant (le dé est consommé).

import type { GameState, Player } from "../types/game";
import { getTrack } from "../utils/positionUtils";
import { destinationOf, grantsExtraTurn } from "../utils/rules";

/** Copie profonde du strict nécessaire : joueurs + pions. */
function clonePlayers(players: readonly Player[]): Player[] {
  return players.map((player) => ({
    ...player,
    pieces: player.pieces.map((piece) => ({ ...piece })),
  }));
}

/** Efface les marques de sélection/déplacement de toute la table. */
function clearMoveFlags(players: Player[]): Player[] {
  for (const player of players) {
    for (const piece of player.pieces) {
      piece.isSelected = false;
      piece.canMove = false;
    }
  }
  return players;
}

/**
 * Résultat d'un lancer : marque les pions déplaçables du joueur courant et,
 * si aucun ne peut bouger, passe immédiatement au joueur suivant (le dé est
 * consommé, personne ne « garde » un lancer inutile).
 *
 * `canRollAgain` est TOUJOURS remis à `false` quand un nouveau dé est posé :
 * sans ça, le « relance » accordé par le coup précédent restait collé au
 * coup suivant et laissait rejouer le même joueur.
 */
export function withRoll(state: GameState, dice: number, now: number): GameState {
  const players = clonePlayers(state.players);
  const current = players[state.currentPlayerIndex];
  if (!current) return state;

  clearMoveFlags(players);
  const track = getTrack(state.playerCount);

  let moveable = 0;
  for (const piece of current.pieces) {
    const canMove =
      destinationOf(
        { index: 0, position: piece.position },
        dice,
        track.finishedPosition,
      ) !== null;
    piece.canMove = canMove;
    if (canMove) moveable++;
  }

  if (moveable === 0) {
    return {
      ...state,
      players,
      currentPlayerIndex: (state.currentPlayerIndex + 1) % players.length,
      diceValue: null,
      canRollAgain: false,
      turnStartTime: now,
    };
  }

  return {
    ...state,
    players,
    diceValue: dice,
    lastRoll: dice,
    canRollAgain: false,
    turnStartTime: now,
  };
}

/**
 * Applique le coup d'un pion (par index chez le joueur `playerIndex`) avec le
 * dé courant. Gère les captures, la victoire, le tour supplémentaire et le
 * passage au joueur suivant.
 *
 * Rend l'état inchangé si le coup est illégal ou si aucun dé n'est posé : le
 * jeu n'a donc jamais besoin de revérifier avant d'appeler.
 */
export function withMove(
  state: GameState,
  playerIndex: number,
  pieceIndex: number,
  now: number,
): GameState {
  const dice = state.diceValue;
  if (dice === null) return state;

  const players = clonePlayers(state.players);
  const mover = players[playerIndex];
  const piece = mover?.pieces[pieceIndex];
  if (!mover || !piece) return state;

  const track = getTrack(state.playerCount);
  const destination = destinationOf(
    { index: pieceIndex, position: piece.position },
    dice,
    track.finishedPosition,
  );
  if (destination === null) return state;

  // Captures : anneau partagé uniquement, jamais une case sûre, jamais la
  // colonne maison. On compare des INDICES D'ANNEAU, pas des positions de
  // chemin : deux couleurs ont un index de chemin différent pour la même
  // case, et une position de chemin n'est comparable qu'à l'intérieur d'un
  // même joueur.
  let captured = false;
  if (destination >= 0 && destination < track.homeColumnStart) {
    const targetRing = track.ringIndexOf(mover.color, destination);
    if (!track.isSafeCell(targetRing)) {
      players.forEach((player, otherIndex) => {
        if (otherIndex === playerIndex) return;
        for (const opponentPiece of player.pieces) {
          if (opponentPiece.position < 0) continue;
          if (opponentPiece.position >= track.homeColumnStart) continue;
          const opponentRing = track.ringIndexOf(
            player.color,
            opponentPiece.position,
          );
          if (opponentRing !== targetRing) continue;
          opponentPiece.position = -1;
          captured = true;
        }
      });
    }
  }

  piece.position = destination;

  const finishedCount = mover.pieces.filter(
    (candidate) => candidate.position === track.finishedPosition,
  ).length;
  const base: GameState = { ...state, players: clearMoveFlags(players) };

  if (finishedCount === mover.pieces.length && mover.pieces.length > 0) {
    return {
      ...base,
      winner: players[playerIndex],
      gamePhase: "finished",
      diceValue: null,
      canRollAgain: false,
      turnStartTime: now,
    };
  }

  const extraTurn = grantsExtraTurn(dice, {
    captures: captured ? [0] : [],
    finishes: destination === track.finishedPosition,
  });

  if (extraTurn) {
    return {
      ...base,
      diceValue: null,
      canRollAgain: true,
      turnStartTime: now,
    };
  }

  return {
    ...base,
    currentPlayerIndex: (playerIndex + 1) % players.length,
    diceValue: null,
    canRollAgain: false,
    turnStartTime: now,
  };
}
