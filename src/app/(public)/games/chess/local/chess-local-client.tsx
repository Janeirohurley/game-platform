"use client";

import dynamic from "next/dynamic";

/**
 * The scene touches `window`, WebGL, workers and asset loaders. Rendering it
 * on the server would only produce an empty shell, so the whole game is
 * client-only, exactly like the local Checkers and Rally clients.
 */
const LocalChess = dynamic(
  () => import("@/games/chess/local/local-chess").then((module) => module.LocalChess),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="text-sm text-slate-500">
        Préparation de l&apos;échiquier…
      </p>
    ),
  },
);

export function ChessLocalClient() {
  return <LocalChess />;
}
