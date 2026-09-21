"use client";

import { useCallback } from "react";
import Dice from "@/components/dice";
import type { DiceValue } from "../engine";
import { buttonPrimary } from "../utils/ui";

export interface LudoDiceProps {
  value: DiceValue | null;
  rolling: boolean;
  canRoll: boolean;
  onRoll: () => void;
}

export function LudoDice({ value, rolling, canRoll, onRoll }: LudoDiceProps) {
  const handleClick = useCallback(() => {
    if (!canRoll || rolling) return;
    onRoll();
  }, [canRoll, rolling, onRoll]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: 96, height: 96 }}>
        <Dice
          size={2.4}
          value={value ?? 1}
          clickable={canRoll && !rolling}
          rollDuration={rolling ? 900 : 0}
          colorAnimation={{
            enabled: true,
            duration: 4000,
            palettes: [
              { body: "#5bd8f3", pip: "#07101b", light: "#63dcff" },
              { body: "#bd67ff", pip: "#08040e", light: "#c77dff" },
              { body: "#ffad4d", pip: "#161006", light: "#ffb45c" },
            ],
          }}
        />
      </div>
      <button
        type="button"
        className={buttonPrimary}
        disabled={!canRoll || rolling}
        onClick={handleClick}
        aria-label={canRoll ? "Roll the dice" : "Dice unavailable"}
      >
        {rolling ? "Rolling…" : canRoll ? "Roll the dice" : "Unavailable"}
      </button>
    </div>
  );
}
