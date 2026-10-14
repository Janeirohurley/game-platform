"use client";

import dynamic from "next/dynamic";

/**
 * Point d'entrée de la partie locale, utilisé par la page serveur.
 *
 * La session lit `window` et tire une graine aléatoire dès son premier
 * rendu ; elle est donc chargée sans rendu serveur (`ssr: false`). Le HTML
 * serveur ne contient que le message de chargement, et il n'y a plus de
 * graine qui puisse différer entre serveur et client.
 */
const TetrisSession = dynamic(
  () => import("./tetris-session").then((module) => module.TetrisSession),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="text-sm text-slate-500">
        Préparation de la partie…
      </p>
    ),
  },
);

export function LocalTetris() {
  return <TetrisSession />;
}
