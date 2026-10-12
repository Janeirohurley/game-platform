// Game types and interfaces
import type { LudoColor } from "../data/track";
import type { BotDifficulty } from "../bot/types";

// Re-exported so components can import the color union from a single
// place instead of each re-declaring a 4-color union (which is what made
// orange and purple impossible to add).
export type { LudoColor };

export interface Player {
  id: string;
  name: string;
  color: LudoColor;
  pieces: GamePiece[];
  isActive: boolean;
  /**
   * Siège piloté par l'IA (mode local uniquement). Le serveur n'assied
   * jamais de bot : ce champ n'existe que pour la partie locale.
   */
  isBot?: boolean;
  /** Niveau de l'IA, présent quand `isBot`. */
  botDifficulty?: BotDifficulty;
}

export interface GamePiece {
  id: string;
  playerId: string;
  /** -1 = zone d'attente, 0-56 = chemin, 57 = centre (terminé). */
  position: number;
  isSelected: boolean;
  canMove: boolean;
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  diceValue: number | null;
  gamePhase: "setup" | "playing" | "finished";
  winner: Player | null;
  lastRoll: number | null;
  canRollAgain: boolean;
  turnStartTime: number | null;
  autoPlayEnabled: boolean;
  /**
   * Taille de la table (2 à 6). Doit correspondre à `players.length`
   * une fois la partie lancée : c'est ce qui décide de la géométrie
   * du plateau et de l'ordre des sièges.
   */
  playerCount: number;
}

// Color theme typing
export interface ColorTheme {
  name: string;
  boardBase: string;
  trackTiles: string;
  /**
   * Les six couleurs de siège, pas seulement les joueurs actuellement
   * assis : le rendu a besoin de la palette complète pour habiller les
   * cases neutres et le dégradé du centre.
   */
  players: Record<LudoColor, string>;
}
