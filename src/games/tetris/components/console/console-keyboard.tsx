import type { ConsoleKey, ConsolePhase, ConsolePressed } from "./console-keys";
import styles from "./tetris-console.module.css";

type ButtonColor = "blue" | "green" | "red";
type ButtonSize = "s0" | "s1" | "s2";
type ArrowDirection = "up" | "down" | "left" | "right";

interface ButtonSpec {
  key: ConsoleKey;
  color: ButtonColor;
  size: ButtonSize;
  top: number;
  left: number;
  label: string;
  /** Texte lu par les lecteurs d'écran (le libellé visible peut être court). */
  name: string;
  arrow?: ArrowDirection;
  /** Libellé placé à droite du bouton plutôt qu'en dessous. */
  labelSide?: boolean;
}

/** Positions copiées de la console d'origine (clavier de 580 x 330). */
const BUTTONS: readonly ButtonSpec[] = [
  { key: "rotate", color: "blue", size: "s1", top: 0, left: 374, label: "Rotation", name: "Tourner la pièce", arrow: "up", labelSide: true },
  { key: "down", color: "blue", size: "s1", top: 180, left: 374, label: "Bas", name: "Descendre la pièce", arrow: "down" },
  { key: "left", color: "blue", size: "s1", top: 90, left: 284, label: "Gauche", name: "Déplacer à gauche", arrow: "left" },
  { key: "right", color: "blue", size: "s1", top: 90, left: 464, label: "Droite", name: "Déplacer à droite", arrow: "right" },
  { key: "drop", color: "blue", size: "s0", top: 100, left: 52, label: "Tomber (ESPACE)", name: "Faire tomber la pièce" },
  { key: "reset", color: "red", size: "s2", top: 0, left: 196, label: "Reset (R)", name: "Recommencer la partie" },
  { key: "music", color: "green", size: "s2", top: 0, left: 106, label: "Son (S)", name: "Activer ou couper le son" },
  { key: "pause", color: "green", size: "s2", top: 0, left: 16, label: "Pause (P)", name: "Mettre en pause ou reprendre" },
];

const ARROW_ROTATION: Record<ArrowDirection, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

interface ConsoleKeyboardProps {
  pressed: ConsolePressed;
  onKey: (key: ConsoleKey, phase: ConsolePhase) => void;
}

/**
 * Boutons de la console. Ce sont de vrais `<button>` (focus, nom accessible)
 * alors que l'original utilisait des `<i>`. Les gestes sont des « pointer
 * events » : ils couvrent souris, doigt et stylet avec un seul code, sans les
 * doubles déclenchements touch + mouse que l'original devait filtrer.
 */
export function ConsoleKeyboard({ pressed, onKey }: ConsoleKeyboardProps) {
  return (
    <div className={styles.keyboard}>
      {BUTTONS.map((spec) => (
        <div
          key={spec.key}
          className={`${styles.button} ${styles[spec.size]}`}
          style={{ top: spec.top, left: spec.left }}
        >
          <button
            type="button"
            aria-label={spec.name}
            className={`${styles.circle} ${styles[spec.color]} ${pressed[spec.key] ? styles.active : ""}`}
            onPointerDown={(event) => {
              // Garde le geste même si le doigt glisse hors du bouton.
              event.currentTarget.setPointerCapture(event.pointerId);
              onKey(spec.key, "down");
            }}
            onPointerUp={() => onKey(spec.key, "up")}
            onPointerCancel={() => onKey(spec.key, "up")}
            onContextMenu={(event) => event.preventDefault()}
          />
          {spec.arrow && (
            <svg
              aria-hidden="true"
              width="16"
              height="32"
              viewBox="0 0 16 32"
              className={styles.arrow}
              // Triangle de 16 x 16 (l'original étirait un triangle de 8 de haut
              // par 2), tourné autour de son propre centre pour rester au milieu.
              style={{ transform: `rotate(${ARROW_ROTATION[spec.arrow]}deg)` }}
            >
              <polygon points="0,24 16,24 8,8" />
            </svg>
          )}
          <span
            aria-hidden="true"
            className={`${styles.label} ${spec.labelSide ? styles.labelSide : ""}`}
          >
            {spec.label}
          </span>
        </div>
      ))}
    </div>
  );
}
