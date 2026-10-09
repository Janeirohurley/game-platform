// Contrats d'index de position, extraits pour que le rendu ne dépende
// que d'un seul endroit.
//
// DOUBLE SOURCE DE VÉRITÉ : `server-games/src/games/ludo/ludo-state.ts`
// exporte les mêmes trois constantes. Si elles divergent ici, le client
// dessine une case que le serveur ne compte jamais, et l'anomalie n'apparaît
// qu'en partie. Toute modification doit être faite dans les deux dépôts.

import {
  HEX_FINISHED_POSITION,
  HEX_HOME_COLUMN_START,
  HEX_MIN_PLAYER_COUNT,
} from "./track";

// Ces deux constantes décrivent le plateau CLASSIQUE (2 à 4 joueurs).
// Les tables de 5 et 6 joueurs jouent sur le plateau hexagonal, dont le
// parcours est plus long : utiliser `homeColumnStartFor` et
// `finishedPositionFor` dès que la taille de la table est connue.

/** Début de la colonne maison privée, plateau classique (6 cases : 51 à 56). */
export const HOME_COLUMN_START = 51;
/** Case atteinte en dernier, plateau classique : le centre du plateau. */
export const FINISHED_POSITION = 57;

/** Début de la colonne maison d'une table de `playerCount` joueurs. */
export function homeColumnStartFor(playerCount: number): number {
  return playerCount >= HEX_MIN_PLAYER_COUNT
    ? HEX_HOME_COLUMN_START
    : HOME_COLUMN_START;
}

/** Position du centre pour une table de `playerCount` joueurs. */
export function finishedPositionFor(playerCount: number): number {
  return playerCount >= HEX_MIN_PLAYER_COUNT
    ? HEX_FINISHED_POSITION
    : FINISHED_POSITION;
}
