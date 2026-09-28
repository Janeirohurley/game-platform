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

const VIEW_BUTTONS: {
  name: CameraViewName;
  label: string;
}[] = [
  { name: "overview", label: "Vue générale" },
  { name: "top", label: "Vue dessus" },
  { name: "front", label: "Vue face" },
  { name: "left", label: "Vue gauche" },
  { name: "right", label: "Vue droite" },
];

function CameraActionTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group/tooltip relative flex items-center">
      {children}

      <div
        className="
          pointer-events-none
          absolute bottom-full left-1/2
          mb-2
          -translate-x-1/2 translate-y-1
          whitespace-nowrap
          rounded-md
          border border-white/10
          bg-black/90
          px-2.5 py-1.5
          text-[11px] font-medium
          text-white
          opacity-0
          shadow-lg
          backdrop-blur-md
          transition-all duration-150
          group-hover/tooltip:translate-y-0
          group-hover/tooltip:opacity-100
        "
      >
        {label}
      </div>
    </div>
  );
}

export function CameraViewsPanel({
  view,
  onViewChange,
  autoRotate,
  onAutoRotateChange,
  locked,
  onLockedChange,
  onReset,
}: CameraViewsPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-auto flex items-center">
      {/* Actions horizontales */}
      <div
        className={`
          overflow-visible
          transition-all
          duration-300
          ease-[cubic-bezier(.4,0,.2,1)]
          ${
            open
              ? "mr-2 w-auto translate-x-0 opacity-100"
              : "pointer-events-none mr-0 w-0 translate-x-4 opacity-0"
          }
        `}
      >
        <div
          className="
            flex h-11
            items-center
            gap-1
            rounded-xl
            border border-white/10
            bg-black/70
            px-2
            shadow-xl
            backdrop-blur-xl
          "
        >
          {/* Vues */}
          {VIEW_BUTTONS.map(({ name, label }, index) => (
            <CameraActionTooltip key={name} label={label}>
              <button
                type="button"
                onClick={() => onViewChange(name)}
                aria-label={label}
                aria-pressed={view === name}
                className={`
                  flex size-8
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  transition-all
                  duration-200
                  ${
                    view === name
                      ? "bg-white text-slate-950"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }
                `}
              >
                <HugeiconsIcon
                  icon={EyeIcon}
                  size={15}
                  strokeWidth={1.8}
                  className={
                    index === 1
                      ? "rotate-180"
                      : index === 2
                        ? "-rotate-90"
                        : index === 4
                          ? "rotate-90"
                          : ""
                  }
                />
              </button>
            </CameraActionTooltip>
          ))}

          <div className="mx-1 h-5 w-px bg-white/10" />

          {/* Rotation automatique */}
          <CameraActionTooltip
            label={
              autoRotate
                ? "Désactiver la rotation automatique"
                : "Activer la rotation automatique"
            }
          >
            <button
              type="button"
              onClick={() => onAutoRotateChange(!autoRotate)}
              aria-label={
                autoRotate
                  ? "Désactiver la rotation automatique"
                  : "Activer la rotation automatique"
              }
              aria-pressed={autoRotate}
              className={`
                flex size-8
                shrink-0
                items-center
                justify-center
                rounded-lg
                transition
                ${
                  autoRotate
                    ? "bg-amber-400 text-slate-950"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                size={15}
                strokeWidth={1.8}
                className={autoRotate ? "animate-spin" : ""}
              />
            </button>
          </CameraActionTooltip>

          {/* Reset */}
          <CameraActionTooltip label="Réinitialiser la caméra">
            <button
              type="button"
              onClick={onReset}
              aria-label="Réinitialiser la caméra"
              className="
                flex size-8
                shrink-0
                items-center
                justify-center
                rounded-lg
                text-white/60
                transition
                hover:bg-white/10
                hover:text-white
              "
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                size={15}
                strokeWidth={1.8}
              />
            </button>
          </CameraActionTooltip>

          {/* Verrouillage */}
          <CameraActionTooltip
            label={
              locked
                ? "Déverrouiller la caméra"
                : "Verrouiller la caméra"
            }
          >
            <button
              type="button"
              onClick={() => onLockedChange(!locked)}
              aria-label={
                locked
                  ? "Déverrouiller la caméra"
                  : "Verrouiller la caméra"
              }
              aria-pressed={locked}
              className={`
                flex size-8
                shrink-0
                items-center
                justify-center
                rounded-lg
                transition
                ${
                  locked
                    ? "bg-white text-slate-950"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              <HugeiconsIcon
                icon={locked ? EyeOffIcon : EyeIcon}
                size={15}
                strokeWidth={1.8}
              />
            </button>
          </CameraActionTooltip>
        </div>
      </div>

      {/* Bouton caméra */}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={
          open
            ? "Fermer les contrôles caméra"
            : "Ouvrir les contrôles caméra"
        }
        aria-expanded={open}
        className="
          relative
          z-10
          flex size-11
          shrink-0
          items-center
          justify-center
          rounded-xl
          border border-white/10
          bg-black/70
          text-white/80
          shadow-xl
          backdrop-blur-xl
          transition
          duration-200
          hover:bg-black/85
          hover:text-white
          focus:outline-none
          focus:ring-2
          focus:ring-white/20
        "
      >
        <HugeiconsIcon
          icon={CameraIcon}
          size={18}
          strokeWidth={1.8}
        />
      </button>
    </div>
  );
}

