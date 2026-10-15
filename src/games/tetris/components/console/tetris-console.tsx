import type { ReactNode } from "react";

import type { TetrisState } from "../../engine";
import { ConsoleDecor } from "./console-decor";
import { ConsoleKeyboard } from "./console-keyboard";
import type { ConsoleKey, ConsolePhase, ConsolePressed } from "./console-keys";
import { LcdClock } from "./lcd-clock";
import { MusicIcon, PauseIcon } from "./lcd-icons";
import { LcdMatrix, LcdNext } from "./lcd-matrix";
import { LcdNumber } from "./lcd-number";
import styles from "./tetris-console.module.css";

interface TetrisConsoleProps {
  game: TetrisState;
  paused: boolean;
  best: number;
  soundOn: boolean;
  pressed: ConsolePressed;
  /** Vrai un court instant après une chute : la console « recule » d'un cran. */
  dropped: boolean;
  onKey: (key: ConsoleKey, phase: ConsolePhase) => void;
  /** Contenu posé par-dessus l'écran (ex. l'écran de démarrage). */
  overlay?: ReactNode;
}

/**
 * Console portable complète (cadre, écran LCD, panneau d'état, boutons).
 * Composant purement visuel : il ne connaît ni le moteur ni le clavier, il
 * affiche l'état reçu et remonte les appuis via `onKey`.
 * Taille fixe 640 x 960 ; `ConsoleFit` se charge de l'adapter à l'écran.
 */
export function TetrisConsole({
  game,
  paused,
  best,
  soundOn,
  pressed,
  dropped,
  onKey,
  overlay,
}: TetrisConsoleProps) {
  // Comme l'original : le libellé passe à « Max » quand on bat le record.
  const isRecord = game.score > 0 && game.score >= best;

  return (
    <div className={styles.app}>
      <div className={`${styles.rect} ${dropped ? styles.drop : ""}`}>
        <ConsoleDecor />

        <div className={styles.screen}>
          <div className={styles.panel}>
            <LcdMatrix game={game} />

            <div className={styles.state}>
              <p className={styles.stateLabel}>{isRecord ? "Max" : "Score"}</p>
              <div className={styles.stateValue}>
                <LcdNumber value={game.score} label="Score" />
              </div>

              <p className={styles.stateLabel}>Lignes</p>
              <div className={styles.stateValue}>
                <LcdNumber value={game.lines} label="Lignes" />
              </div>

              <p className={styles.stateLabel}>Niveau</p>
              <div className={styles.stateValue}>
                <LcdNumber value={game.level} length={1} label="Niveau" />
              </div>

              <p className={styles.stateLabel}>Prochain</p>
              <LcdNext type={game.queue[0]} />

              <div className={styles.bottom}>
                <MusicIcon on={soundOn} />
                <PauseIcon paused={paused} />
                <LcdClock />
              </div>
            </div>
          </div>

          {overlay}
        </div>
      </div>

      <ConsoleKeyboard pressed={pressed} onKey={onKey} />
    </div>
  );
}
