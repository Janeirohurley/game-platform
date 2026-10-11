/** Les 8 boutons de la console, identiques à ceux du Tetris d'origine. */
export type ConsoleKey =
  | "rotate"
  | "down"
  | "left"
  | "right"
  | "drop"
  | "reset"
  | "music"
  | "pause";

export type ConsolePressed = Partial<Record<ConsoleKey, boolean>>;

/** Phase d'un appui : `down` au contact, `up` au relâchement. */
export type ConsolePhase = "down" | "up";
