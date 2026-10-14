"use client";

import { useState } from "react";
import { playSound } from "@/lib/sounds";

const VIEW_LABELS: Record<string, string> = {
  top: "Dessus",
  front: "Face",
  left: "Gauche",
  right: "Droite",
};

// Commandes caméra, repliées derrière un bouton.
//
// Sur téléphone, un panneau déplié en permanence recouvrait le plateau et se
// mélangeait au reste de l'interface. Il est donc rangé derrière une pastille
// en haut à droite : fermé, il ne prend qu'une icône ; ouvert, il se déploie
// juste en dessous.
function CameraPanel({
  onView,
  autoRotate,
  onToggleAutoRotate,
  onReset,
}: {
  onView: (view: string) => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => {
          playSound("buttonClick");
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/55 px-3.5 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md transition-colors hover:bg-black/70"
      >
        Caméra
        <span className="text-[10px] text-white/70">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute right-3 top-[3.75rem] z-20 w-44 rounded-xl bg-black/65 p-2.5 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/60">
            Vues
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {(["top", "front", "left", "right"] as const).map((view) => (
              <button
                key={view}
                onClick={() => {
                  playSound("buttonClick");
                  onView(view);
                }}
                className="rounded-md bg-white/10 px-2 py-1.5 transition-colors hover:bg-white/20"
              >
                {VIEW_LABELS[view]}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              playSound("buttonClick");
              onToggleAutoRotate();
            }}
            className={`mt-1.5 w-full rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
              autoRotate
                ? "bg-emerald-500/80 hover:bg-emerald-500"
                : "bg-white/10 hover:bg-white/20"
            }`}
          >
            Rotation auto : {autoRotate ? "ON" : "OFF"}
          </button>

          <button
            onClick={() => {
              playSound("buttonClick");
              onReset();
            }}
            className="mt-1.5 w-full rounded-md bg-red-500/80 px-2 py-1.5 text-xs font-semibold transition-colors hover:bg-red-500"
          >
            Recentrer
          </button>
        </div>
      )}
    </>
  );
}

export default CameraPanel;
