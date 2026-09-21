export const PLAYER_PALETTE: Readonly<Record<PlayerColor, { main: string; dark: string; ink: string }>> = {
  red: { main: "#d0343a", dark: "#8a1f24", ink: "#fff7e8" },
  green: { main: "#2f8f4e", dark: "#1c5c33", ink: "#f3fae8" },
  yellow: { main: "#f2c14e", dark: "#a9821f", ink: "#201a03" },
  blue: { main: "#2b6dd6", dark: "#173f8a", ink: "#eef4ff" },
};

export type PlayerColor = "red" | "green" | "yellow" | "blue";
