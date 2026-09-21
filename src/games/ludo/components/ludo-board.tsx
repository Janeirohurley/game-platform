"use client";

import { useCallback, useMemo } from "react";
import type { LudoState, Point, Token } from "../engine";
import { createBoardCells, getTokenPoint } from "../engine";
import { PLAYER_PALETTE } from "../utils/colors";
import { LABELS, PLAYER_COLOR_NAMES } from "../utils/labels";
import { LudoToken } from "./ludo-token";

export interface LudoBoardProps {
  state: LudoState;
  tokenPositions: Readonly<Record<string, number>>;
  capturedTokenIds: ReadonlySet<string>;
  movableTokenIds: ReadonlySet<string>;
  onTokenSelect: (tokenId: string) => void;
  onTokenHover: (tokenId: string | null) => void;
}

function scaleForCell(tokens: readonly Token[], cellKey: string): number {
  const onCell = tokens.filter((t) => {
    if (t.status === "base" || t.status === "home") return false;
    const pos = t.position;
    if (pos >= 51) {
      const color = t.color;
      const idx = pos - 51;
      return `${color}-${idx}` === cellKey;
    }
    return false;
  }).length;
  if (onCell <= 1) return 1;
  return Math.max(0.72, 1 - (onCell - 1) * 0.12);
}

export function LudoBoard({
  state,
  tokenPositions,
  capturedTokenIds,
  movableTokenIds,
  onTokenSelect,
  onTokenHover,
}: LudoBoardProps) {
  const cells = useMemo(
    () => createBoardCells(state.config.rules.safeOffsets),
    [state.config.rules.safeOffsets],
  );

  const tokens = useMemo(
    () =>
      state.tokens.map((token) => {
        const position = tokenPositions[token.id] ?? token.position;
        const point = getTokenPoint(token.color, position, token.index);
        const cellKey =
          position === -1
            ? `base-${token.color}-${token.index}`
            : position >= 51
              ? `${token.color}-${position - 51}`
              : `track-${position}`;
        const scale = scaleForCell(state.tokens, cellKey);
        const movable = movableTokenIds.has(token.id);
        const captured = capturedTokenIds.has(token.id);
        const label = `${LABELS.tokensHome(state.tokens.filter((t) => t.playerId === token.playerId && t.status === "home").length)} — ${PLAYER_COLOR_NAMES[token.color]} token ${token.index + 1}`;
        const actionLabel = movable
          ? `Move ${PLAYER_COLOR_NAMES[token.color].toLowerCase()} token ${token.index + 1}`
          : label;
        return { token, point, scale, movable, captured, label, actionLabel };
      }),
    [state.tokens, tokenPositions, capturedTokenIds, movableTokenIds],
  );

  const handleTokenSelect = useCallback(
    (tokenId: string) => {
      onTokenSelect(tokenId);
    },
    [onTokenSelect],
  );

  const handleTokenHover = useCallback(
    (tokenId: string | null) => {
      onTokenHover(tokenId);
    },
    [onTokenHover],
  );

  return (
    <svg
      viewBox="0 0 15 15"
      className="w-full max-w-lg aspect-square overflow-visible"
      role="img"
      aria-label="Ludo board"
    >
      <g fill="none" stroke="#111827" strokeWidth="0.06">
        {cells.map((cell) => {
          const palette = cell.playerColor ? PLAYER_PALETTE[cell.playerColor] : undefined;
          const fill =
            cell.type === "start"
              ? palette?.main
              : cell.type === "home_column"
                ? `${palette?.main}55`
                : cell.isSafe
                  ? "#f3f4f6"
                  : "#f8fafc";
          const strokeColor = cell.type === "start" ? palette?.dark : "#cbd5e1";
          return (
            <rect
              key={cell.id}
              x={cell.col}
              y={cell.row}
              width={1}
              height={1}
              fill={fill}
              stroke={strokeColor}
              strokeWidth={cell.type === "start" ? 0.1 : 0.04}
              data-cell={cell.id}
              data-safe={cell.isSafe ? "true" : "false"}
            />
          );
        })}
      </g>

      <g className="ludo-tokens" aria-hidden="false">
        {tokens.map(({ token, point, scale, movable, captured, label, actionLabel }) => (
          <LudoToken
            key={token.id}
            token={token}
            point={point}
            scale={scale}
            movable={movable}
            captured={captured}
            label={label}
            actionLabel={actionLabel}
            onSelect={handleTokenSelect}
            onHover={handleTokenHover}
          />
        ))}
      </g>
    </svg>
  );
}
