import type { Metadata } from "next";
import { LudoGame } from "./components/ludo-game";
import { loadGame } from "./utils/storage";
import { parseLudoState, createLudoConfig } from "./engine";
import type { LudoGameConfig } from "./engine";

export const metadata: Metadata = {
  title: "Ludo",
  description: "Classic Ludo for 1–4 players with bots, captures and full ranking support.",
};

export default function LudoPage() {
  const savedRaw = typeof window !== "undefined" ? loadGame() : null;
  const savedState = savedRaw ? parseLudoState(savedRaw) : null;

  if (!savedState) {
    return <LudoGame config={defaultConfig()} />;
  }

  return <LudoGame config={savedState.config} savedState={savedState} />;
}

function defaultConfig(): LudoGameConfig {
  return createLudoConfig({ humanPlayers: 2, rules: { gameEnd: "full_ranking" }, names: ["Player 1", "Player 2"] });
}
