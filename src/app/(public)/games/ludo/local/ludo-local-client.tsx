"use client";

import dynamic from "next/dynamic";

/**
 * Charge la partie locale SANS rendu serveur : elle relit une éventuelle
 * sauvegarde dans `localStorage` dès son premier rendu, ce qui différerait du
 * HTML serveur (erreur d'hydratation). Le rendu 3D (three.js) n'a de toute
 * façon rien à faire côté serveur.
 */
const LudoPlay = dynamic(() => import("@/games/ludo/components/LudoPlay"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black text-sm text-slate-400">
      Préparation de la partie…
    </div>
  ),
});

export function LudoLocalClient() {
  return <LudoPlay />;
}
