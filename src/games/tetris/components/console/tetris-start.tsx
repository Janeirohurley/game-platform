"use client";

import { MAX_START_LEVEL, MAX_START_LINES } from "../../local/use-tetris-loop";
import styles from "./tetris-console.module.css";

export interface TetrisStartProps {
  startLines: number;
  startLevel: number;
  best: number;
  onChange: (config: { startLines: number; startLevel: number }) => void;
  onStart: () => void;
}

const LINE_CHOICES = Array.from({ length: MAX_START_LINES + 1 }, (_, i) => i);
const LEVEL_CHOICES = Array.from({ length: MAX_START_LEVEL }, (_, i) => i + 1);

/**
 * Écran de démarrage de la partie locale, posé par-dessus l'écran LCD.
 * Deux réglages, comme l'accueil de l'original : le nombre de lignes de
 * débris (0 a 10) et la vitesse de chute (1 a 6). Le plateau d'aperçu, dessous,
 * se met à jour en direct quand on change un réglage.
 */
export function TetrisStart({
  startLines,
  startLevel,
  best,
  onChange,
  onStart,
}: TetrisStartProps) {
  return (
    <div className={styles.startOverlay}>
      <div className={styles.startPanel}>
        <p className={styles.startTitle}>Tetris</p>

        <div className={styles.startRow}>
          <p className={styles.startLabel}>Lignes de départ</p>
          <div className={styles.startChoices}>
            {LINE_CHOICES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={value === startLines}
                className={`${styles.startChoice} ${
                  value === startLines ? styles.startChoiceOn : ""
                }`}
                onClick={() => onChange({ startLines: value, startLevel })}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.startRow}>
          <p className={styles.startLabel}>Vitesse</p>
          <div className={styles.startChoices}>
            {LEVEL_CHOICES.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={level === startLevel}
                className={`${styles.startChoice} ${
                  level === startLevel ? styles.startChoiceOn : ""
                }`}
                onClick={() => onChange({ startLines, startLevel: level })}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className={styles.startButton} onClick={onStart}>
          Commencer
        </button>

        {best > 0 && <p className={styles.startBest}>Record : {best}</p>}
      </div>
    </div>
  );
}
