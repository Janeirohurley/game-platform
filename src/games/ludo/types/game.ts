// Game types and interfaces
export interface Player {
  id: string;
  name: string;
  color: "yellow" | "green" | "blue" | "red";
  pieces: GamePiece[];
  isActive: boolean;
}

export interface GamePiece {
  id: string;
  playerId: string;
  position: number; // -1 = home, 0-56 = path positions, 57 = finished
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
}

// Color theme typing
export interface ColorTheme {
  name: string;
  boardBase: string;
  trackTiles: string;
  players: Record<"yellow" | "green" | "blue" | "red", string>;
}
