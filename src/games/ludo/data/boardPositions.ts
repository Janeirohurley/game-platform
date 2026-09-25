// Board position mapping - path-based Ludo layout
export const BOARD_POSITIONS = {
  // Starting positions for each color (first position in their path)
  START_POSITIONS: { yellow: 0, green: 0, blue: 0, red: 0 },
  // Safe positions on main track (star positions)
  SAFE_POSITIONS: [0, 8, 13, 21, 26, 34, 39, 47],
  // Home run start (last 6 positions of each path)
  HOME_RUN_START: 50,
  // Finished position
  FINISHED_POSITION: 56,
};
