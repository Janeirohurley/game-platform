// Board position mapping - path-based Ludo layout
//
// Path-index convention (MUST mirror the server's ludo-state.ts, which
// is the authority):
//   -1      → in base
//   0–50    → shared ring (51 cells travelled before the home column)
//   51–56   → the color's private home column (6 cells)
//   57      → finished — the board CENTER ([0, 0]); not a path cell
//
// Each PLAYER_PATHS array holds indexes 0–56 (57 entries); the center
// is reached with an EXACT roll from the last column cell (56 + 1).
export const BOARD_POSITIONS = {
  // Starting positions for each color (first position in their path)
  START_POSITIONS: { yellow: 0, green: 0, blue: 0, red: 0 },
  // Safe positions on main track (star positions)
  SAFE_POSITIONS: [0, 8, 13, 21, 26, 34, 39, 47],
  // First index of the private home column (last 6 cells before the center)
  HOME_RUN_START: 51,
  // Finished position — the board center, reached by exact count only
  FINISHED_POSITION: 57,
};
