"use client";

import dynamic from "next/dynamic";

/**
 * Charge la partie locale SANS rendu serveur : elle relit une éventuelle
 * sauvegarde dans `localStorage` dès son premier rendu, ce qui différerait du
 * HTML serveur (erreur d'hydratation). Même schéma que `local-tetris.tsx`.
 */
const LocalRally = dynamic(
  () => import("@/games/rally/local/local-rally").then((module) => module.LocalRally),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="text-sm text-slate-500">
        Préparation du match…
      </p>
    ),
  },
);

export function RallyLocalClient() {
  return <LocalRally />;
}
