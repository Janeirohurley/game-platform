import type { Metadata } from "next";

import {
  listGames,
  listCategories,
  type GameEntry,
} from "@/lib/games/registry";
import { GamesBrowser } from "./games-browser";



export const metadata: Metadata = {
  title: "Games | Game Arena",
  description:
    "Browse the Game Arena catalog — realtime multiplayer games playable online or locally.",
};

export default function GamesPage() {
  const games = listGames();
  const categories = listCategories();

  return <GamesBrowser games={games} categories={categories} />;
}

export type { GameEntry };
