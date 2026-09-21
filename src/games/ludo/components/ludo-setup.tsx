"use client";

import { useMemo, useState } from "react";
import {
  COLOR_LABELS,
  LudoConfigError,
  MAX_HUMAN_PLAYERS,
  MIN_HUMAN_PLAYERS,
  PLAYER_COLORS,
  createLudoConfig,
  defaultPlayerName,
  type GameEndMode,
  type LudoGameConfig,
  type LudoState,
} from "../engine";
import { PLAYER_PALETTE } from "../utils/colors";
import { LABELS } from "../utils/labels";
import { buttonPrimary, buttonSecondary, panel } from "../utils/ui";
import { BotIcon, UserIcon } from "./ludo-icons";

export interface LudoSetupProps {
  onStart: (config: LudoGameConfig) => void;
  /** A valid saved game, if one exists on this device. */
  savedGame?: LudoState | null;
  onResume?: (state: LudoState) => void;
  defaultHumanPlayers?: number;
  defaultGameEnd?: GameEndMode;
}

const HUMAN_OPTIONS = Array.from(
  { length: MAX_HUMAN_PLAYERS - MIN_HUMAN_PLAYERS + 1 },
  (_, i) => MIN_HUMAN_PLAYERS + i,
);

export function LudoSetup({
  onStart,
  savedGame = null,
  onResume,
  defaultHumanPlayers = 2,
  defaultGameEnd = "full_ranking",
}: LudoSetupProps) {
  const [humans, setHumans] = useState(defaultHumanPlayers);
  const [names, setNames] = useState<string[]>(() => PLAYER_COLORS.map(() => ""));
  const [gameEnd, setGameEnd] = useState<GameEndMode>(defaultGameEnd);
  const [error, setError] = useState<string | null>(null);

  const seats = useMemo(
    () =>
      PLAYER_COLORS.map((color, seat) => ({
        color,
        seat,
        type: seat < humans ? ("human" as const) : ("bot" as const),
      })),
    [humans],
  );

  const start = () => {
    try {
      onStart(createLudoConfig({ humanPlayers: humans, names, rules: { gameEnd } }));
    } catch (e) {
      setError(e instanceof LudoConfigError ? e.message : "Could not start the game.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{LABELS.setupTitle}</h2>
        <p className="mt-1 text-sm opacity-70">{LABELS.setupIntro}</p>
      </div>

      {savedGame && onResume && (
        <div className={`${panel} flex flex-wrap items-center justify-between gap-3 p-3`}>
          <p className="text-sm">{LABELS.resumeHint}</p>
          <button type="button" className={buttonSecondary} onClick={() => onResume(savedGame)}>
            {LABELS.resume}
          </button>
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-semibold">{LABELS.humanPlayers}</legend>
        <div role="radiogroup" aria-label={LABELS.humanPlayers} className="mt-2 grid grid-cols-4 gap-2">
          {HUMAN_OPTIONS.map((n) => {
            const selected = n === humans;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setHumans(n)}
                className={`rounded-md border px-2 py-3 text-center text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-white ${
                  selected
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                }`}
              >
                <span className="block text-lg font-semibold leading-none">{n}</span>
                <span className="mt-1 block text-xs opacity-80">{n === 1 ? "human" : "humans"}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <h3 className="text-sm font-semibold">
          {LABELS.configurationPreview} — {LABELS.humanCount(humans)}, {4 - humans} {4 - humans === 1 ? "bot" : "bots"}
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {seats.map(({ color, seat, type }) => {
            const palette = PLAYER_PALETTE[color];
            const Icon = type === "human" ? UserIcon : BotIcon;
            return (
              <li key={color} className={`${panel} flex items-center gap-3 p-2.5`}>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                  style={{ background: palette.main, color: palette.ink, border: `2px solid ${palette.dark}` }}
                  aria-hidden="true"
                >
                  {COLOR_LABELS[color].charAt(0)}
                </span>
                <span className="w-16 shrink-0 text-sm font-medium">{COLOR_LABELS[color]}</span>
                {type === "human" ? (
                  <input
                    type="text"
                    value={names[seat]}
                    maxLength={20}
                    placeholder={defaultPlayerName("human", color, seat)}
                    aria-label={LABELS.playerName(seat)}
                    onChange={(e) => setNames((prev) => prev.map((n, i) => (i === seat ? e.target.value : n)))}
                    className="min-w-0 flex-1 rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-900 dark:border-white/20 dark:focus-visible:outline-white"
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm opacity-70">{defaultPlayerName("bot", color, seat)}</span>
                )}
                <span className="inline-flex shrink-0 items-center gap-1 text-xs opacity-80">
                  <Icon className="h-4 w-4" />
                  {type === "human" ? LABELS.human : LABELS.bot}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">{LABELS.gameEnd}</legend>
        <div className="mt-2 flex flex-col gap-2">
          {(
            [
              ["full_ranking", LABELS.gameEndFull],
              ["first_winner", LABELS.gameEndFirst],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="ludo-game-end" checked={gameEnd === value} onChange={() => setGameEnd(value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button type="button" className={`${buttonPrimary} w-full py-3`} onClick={start}>
        {LABELS.start}
      </button>
    </div>
  );
}
