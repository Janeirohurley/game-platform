"use client";

import dynamic from "next/dynamic";

/**
 * Charge la partie locale SANS rendu serveur : elle relit une éventuelle
 * sauvegarde dans `localStorage` dès son premier rendu, ce qui différerait du
 * HTML serveur (erreur d'hydratation). Même schéma que `local-tetris.tsx`.
 */
const LocalCheckers = dynamic(
  () => import("@/games/checkers/local/local-checkers").then((module) => module.LocalCheckers),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="text-sm text-slate-500">
        Préparation de la partie…
      </p>
    ),
  },
);

export function CheckersLocalClient() {
  return <LocalCheckers />;
}
