"use client";

import { useEffect, useState } from "react";

import { LcdText } from "./lcd-number";
import styles from "./tetris-console.module.css";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Horloge de l'écran (heures:minutes) dont les deux points clignotent chaque
 * seconde. Le composant n'est monté que côté client (la session est chargée
 * en `ssr: false`) : lire `new Date()` à l'initialisation est donc sans risque
 * d'écart d'hydratation.
 */
export function LcdClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const colon = now.getSeconds() % 2 === 0 ? ":" : " ";
  const text = `${pad(now.getHours())}${colon}${pad(now.getMinutes())}`;

  return (
    <div className={styles.clock}>
      <LcdText text={text} label={`Heure ${pad(now.getHours())}:${pad(now.getMinutes())}`} />
    </div>
  );
}
