/**
 * Chiffres à 7 segments de l'écran LCD. L'original les tirait d'une image
 * (sprite) hébergée à distance ; on les dessine en SVG pour ne dépendre
 * d'aucune ressource externe. Les segments éteints restent visibles en
 * « fantôme », comme sur un vrai afficheur LCD.
 */

type Segment = "a" | "b" | "c" | "d" | "e" | "f" | "g";

const DIGIT_SEGMENTS: Record<string, readonly Segment[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "d", "c"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"],
};

/** [x, y, largeur, hauteur] dans une boîte de 14 x 24. */
const SEGMENT_RECTS: Record<Segment, readonly [number, number, number, number]> = {
  a: [2.5, 1, 9, 2.6],
  b: [10.4, 2.5, 2.6, 9],
  c: [10.4, 12.5, 2.6, 9],
  d: [2.5, 20.4, 9, 2.6],
  e: [1, 12.5, 2.6, 9],
  f: [1, 2.5, 2.6, 9],
  g: [2.5, 10.7, 9, 2.6],
};

const ALL_SEGMENTS = Object.keys(SEGMENT_RECTS) as Segment[];

function Glyph({ char }: { char: string }) {
  const lit = DIGIT_SEGMENTS[char] ?? [];

  if (char === ":" || char === " ") {
    // Deux points ; `" "` éteint le séparateur (clignotement de l'horloge).
    return (
      <svg width="14" height="24" viewBox="0 0 14 24" aria-hidden="true">
        <rect x="5.5" y="7" width="3" height="3" opacity={char === ":" ? 1 : 0.12} />
        <rect x="5.5" y="14" width="3" height="3" opacity={char === ":" ? 1 : 0.12} />
      </svg>
    );
  }

  return (
    <svg width="14" height="24" viewBox="0 0 14 24" aria-hidden="true">
      {ALL_SEGMENTS.map((segment) => {
        const [x, y, w, h] = SEGMENT_RECTS[segment];
        return (
          <rect
            key={segment}
            x={x}
            y={y}
            width={w}
            height={h}
            opacity={lit.includes(segment) ? 1 : 0.1}
          />
        );
      })}
    </svg>
  );
}

interface LcdNumberProps {
  value: number;
  /** Nombre de chiffres affichés ; les positions vides restent en fantôme. */
  length?: number;
  label: string;
}

export function LcdNumber({ value, length = 6, label }: LcdNumberProps) {
  const digits = String(Math.max(0, Math.trunc(value)));
  const padded = digits.padStart(length, "n").slice(-length);

  return (
    <div role="img" aria-label={`${label} : ${value}`} style={{ display: "flex" }}>
      {padded.split("").map((char, index) => (
        <Glyph key={index} char={char} />
      ))}
    </div>
  );
}

/** Affiche une chaîne déjà formatée (par ex. « 09:41 ») avec le même afficheur. */
export function LcdText({ text, label }: { text: string; label: string }) {
  return (
    <div role="img" aria-label={label} style={{ display: "flex" }}>
      {text.split("").map((char, index) => (
        <Glyph key={index} char={char} />
      ))}
    </div>
  );
}
