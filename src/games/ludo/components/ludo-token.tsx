"use client";

import { memo } from "react";
import type { Point, Token } from "../engine";
import { PLAYER_PALETTE } from "../utils/colors";

export interface LudoTokenProps {
  token: Token;
  point: Point;
  /** 1 for a lone token, smaller when several tokens share a cell. */
  scale: number;
  movable: boolean;
  captured: boolean;
  /** Accessible name, e.g. "Red token 3". */
  label: string;
  /** Accessible name when movable, e.g. "Move red token 3". */
  actionLabel: string;
  onSelect: (tokenId: string) => void;
  onHover: (tokenId: string | null) => void;
}

/** One pawn. Its board position is driven by CSS transforms (so moves can be animated),
 * but the authoritative position always lives in the game state.
 */
export const LudoToken = memo(function LudoToken({
  token,
  point,
  scale,
  movable,
  captured,
  label,
  actionLabel,
  onSelect,
  onHover,
}: LudoTokenProps) {
  const palette = PLAYER_PALETTE[token.color];
  const number = token.index + 1;

  const activate = () => {
    if (movable) onSelect(token.id);
  };

  return (
    <g
      className="ludo-token"
      data-token-id={token.id}
      data-movable={movable ? "true" : "false"}
      style={{ transform: `translate(${point.x}px, ${point.y}px)` }}
      role={movable ? "button" : "img"}
      aria-label={movable ? actionLabel : label}
      aria-disabled={movable ? undefined : true}
      tabIndex={movable ? 0 : -1}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
      onPointerEnter={() => movable && onHover(token.id)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => movable && onHover(token.id)}
      onBlur={() => onHover(null)}
    >
      <g className="ludo-token-scale" style={{ transform: `scale(${scale})` }}>
        {movable && <circle className="ludo-ring" r={0.56} fill="none" stroke={palette.dark} strokeWidth={0.09} />}
        <circle className="ludo-focus" r={0.62} fill="none" stroke="currentColor" strokeWidth={0.1} opacity={0} />
        {captured && <circle r={0.6} fill="none" stroke="#111" strokeWidth={0.1} strokeDasharray="0.18 0.14" />}
        <circle r={0.4} cy={0.04} fill="rgba(0,0,0,0.28)" />
        <circle r={0.4} fill={palette.main} stroke={palette.dark} strokeWidth={0.07} />
        <circle r={0.27} fill="none" stroke={palette.ink} strokeOpacity={0.55} strokeWidth={0.04} />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={0.36}
          fontWeight={700}
          fill={palette.ink}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {number}
        </text>
      </g>
    </g>
  );
});
