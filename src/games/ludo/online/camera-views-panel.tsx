"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CameraIcon,
  RefreshIcon,
  EyeIcon,
  EyeOffIcon,
} from "@hugeicons/core-free-icons";

import type { CameraViewName } from "./camera-controls";

export interface CameraViewsPanelProps {
  view: CameraViewName | "free";
  onViewChange: (view: CameraViewName) => void;
  autoRotate: boolean;
  onAutoRotateChange: (value: boolean) => void;
  locked: boolean;
  onLockedChange: (value: boolean) => void;
  onReset: () => void;
}

const VIEW_BUTTONS: { name: CameraViewName; label: string }[] = [
  { name: "overview", label: "Table" },
  { name: "top", label: "Dessus" },
  { name: "front", label: "Face" },
  { name: "left", label: "Gauche" },
  { name: "right", label: "Droite" },
];

/**
 * The camera panel, bottom-right of the board (spec: "bien positionner
 * la table"). Named views glide the camera, auto-rotate is opt-in, the
 * lock freezes the view entirely, Reset restores the default framing.
 * Collapsible so it never covers the board on small screens.
 */
export function CameraViewsPanel({
  view,
  onViewChange,
  autoRotate,
  onAutoRotateChange,
  locked,
  onLockedChange,
  onReset,
}: CameraViewsPanelProps) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir les vues caméra"
        className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs font-medium text-white/85 shadow-lg backdrop-blur-md transition hover:bg-black/75"
      >
        <HugeiconsIcon icon={CameraIcon} size={14} strokeWidth={1.8} />
        Caméra
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-44 rounded-xl border border-white/10 bg-black/70 p-3 text-white shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
          Vues caméra
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Replier les vues caméra"
          className="rounded-md px-1.5 py-0.5 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <HugeiconsIcon icon={EyeOffIcon} size={13} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {VIEW_BUTTONS.map(({ name, label }) => (
          <button
            key={name}
            type="button"
            onClick={() => onViewChange(name)}
            aria-pressed={view === name}
            className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
              view === name
                ? "bg-white text-slate-950"
                : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onAutoRotateChange(!autoRotate)}
          aria-pressed={autoRotate}
          className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition"
        >
          <span
            className={`size-2 rounded-full ${
              autoRotate ? "bg-amber-400" : "bg-white/25"
            }`}
          />
          {autoRotate ? "Rotation auto ON" : "Rotation auto OFF"}
        </button>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-500/90 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-red-500"
      >
        <HugeiconsIcon icon={RefreshIcon} size={13} strokeWidth={2} />
        Réinitialiser
      </button>

      <button
        type="button"
        onClick={() => onLockedChange(!locked)}
        aria-pressed={locked}
        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1.5 text-[11px] font-medium text-white/75 transition hover:bg-white/15 hover:text-white"
      >
        <HugeiconsIcon icon={EyeIcon} size={13} strokeWidth={1.8} />
        {locked ? "Vue verrouillée" : "Verrouiller la vue"}
      </button>
    </div>
  );
}
