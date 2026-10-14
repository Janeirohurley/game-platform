"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Dimensions de conception de la console (cf. `tetris-console.module.css`). */
const DESIGN_WIDTH = 640;
const DESIGN_HEIGHT = 960;
/** Marge verticale réservée à la barre de navigation et au titre de la page. */
const PAGE_CHROME_PX = 150;
const MIN_SCALE = 0.35;

function computeScale(containerWidth: number): number {
  const byWidth = containerWidth / DESIGN_WIDTH;
  const byHeight = (window.innerHeight - PAGE_CHROME_PX) / DESIGN_HEIGHT;
  return Math.min(1, Math.max(MIN_SCALE, Math.min(byWidth, byHeight)));
}

/**
 * Met la console à l'échelle de l'espace disponible, comme le `transform:
 * scale` calculé sur la taille de la fenêtre dans l'original. On mesure ici
 * le conteneur (et non la fenêtre) : la console s'adapte à la colonne de la
 * page, navigation comprise.
 */
export function ConsoleFit({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(() =>
    computeScale(Math.min(window.innerWidth - 32, DESIGN_WIDTH)),
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => setScale(computeScale(element.clientWidth));
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          position: "relative",
          width: DESIGN_WIDTH * scale,
          height: DESIGN_HEIGHT * scale,
        }}
      >
        {/* Le transform ne change pas la boîte de mise en page : le parent
            ci-dessus réserve donc lui-même la taille mise à l'échelle. */}
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
