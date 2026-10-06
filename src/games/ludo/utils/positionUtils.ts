import { PLAYER_PATHS } from "../data/playerPaths";
import { finishedSlotOffset } from "../data/center";

// Convert game position to 3D coordinates using path.json
export function getPositionCoordinates(
  position: number,
  color: "yellow" | "green" | "blue" | "red",
  pieceIndex: number = 0,
): [number, number, number] {
  if (position === -1) {
    // Home positions - use pieceIndex to place pieces in different slots
    const homePositions = {
      yellow: [
        [-5.6, 0.2, -5.6],
        [-3.4, 0.2, -5.6],
        [-5.6, 0.2, -3.4],
        [-3.4, 0.2, -3.4],
      ],
      green: [
        [-5.6, 0.2, 3.4],
        [-3.4, 0.2, 3.4],
        [-5.6, 0.2, 5.6],
        [-3.4, 0.2, 5.6],
      ],
      blue: [
        [3.4, 0.2, 3.4],
        [5.6, 0.2, 3.4],
        [3.4, 0.2, 5.6],
        [5.6, 0.2, 5.6],
      ],
      red: [
        [3.4, 0.2, -5.6],
        [5.6, 0.2, -5.6],
        [3.4, 0.2, -3.4],
        [5.6, 0.2, -3.4],
      ],
    };
    return homePositions[color][pieceIndex % 4] as [number, number, number];
  }

  if (position === 57) {
    // Finished position: spread inside the colour's own triangle instead of
    // piling all arrived pieces onto the exact centre. The slot geometry is
    // shared with CenterArea so the drawing and the pieces agree.
    const [x, z] = finishedSlotOffset(color, pieceIndex);
    return [x, 0.2, z];
  }

  // Use path from JSON file
  let playerPath: number[][] | undefined;
  switch (color) {
    case "yellow":
      playerPath = PLAYER_PATHS.yellow_path;
      break;
    case "green":
      playerPath = PLAYER_PATHS.green_path;
      break;
    case "blue":
      playerPath = PLAYER_PATHS.blue_path;
      break;
    case "red":
      playerPath = PLAYER_PATHS.red_path;
      break;
    default:
      playerPath = undefined;
  }

  if (playerPath && position >= 0 && position < playerPath.length) {
    const [x, z] = playerPath[position];
    return [x, 0.2, z];
  }

  // Fallback to center if position not found
  return [0, 0.2, 0];
}
