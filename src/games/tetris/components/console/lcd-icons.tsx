import styles from "./tetris-console.module.css";

/** Icône haut-parleur : pleine quand le son est actif, fantôme sinon. */
export function MusicIcon({ on }: { on: boolean }) {
  return (
    <svg
      role="img"
      aria-label={on ? "Son activé" : "Son coupé"}
      width="25"
      height="21"
      viewBox="0 0 25 21"
      className={`${styles.musicIcon} ${on ? "" : styles.lcdGhost}`}
    >
      <path d="M1 7h5l6-5v17l-6-5H1z" />
      <path
        d="M15 7q3 3.5 0 7M18.5 4q6 6.5 0 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icône pause : clignote pendant la pause, comme sur la console d'origine. */
export function PauseIcon({ paused }: { paused: boolean }) {
  return (
    <svg
      role="img"
      aria-label={paused ? "Jeu en pause" : "Jeu en cours"}
      width="20"
      height="18"
      viewBox="0 0 20 18"
      className={`${styles.pauseIcon} ${paused ? styles.blink : styles.lcdGhost}`}
    >
      <rect x="2" y="1" width="6" height="16" />
      <rect x="12" y="1" width="6" height="16" />
    </svg>
  );
}
