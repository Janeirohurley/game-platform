import type { Metadata } from "next";

import LudoPlay from "@/games/ludo/components/LudoPlay";

export const metadata: Metadata = {
  title: "Ludo — Mode local | Game Arena",
  description:
    "Joue au Ludo en local sur un seul écran, jusqu'à 4 joueurs sur le même appareil.",
};

/**
 * Local (same-screen) Ludo game — the original 3D experience, unchanged,
 * now on its dedicated route so /games/ludo can be the landing page.
 */
export default function LudoLocalPage() {
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <div className="fixed inset-0">
        <LudoPlay />
      </div>

      <a
        href="/games/ludo"
        className="absolute left-4 top-4 z-20 rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/80"
      >
        ← Retour
      </a>
    </div>
  );
}
