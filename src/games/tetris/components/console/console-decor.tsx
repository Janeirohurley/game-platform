import styles from "./tetris-console.module.css";

/**
 * Pixel-art des deux côtés de l'écran, repris du composant `Decorate` d'origine.
 * Chaque ligne liste ses cases (1 = noire, 0 = vide) ; `null` est une ligne
 * blanche. La colonne ne fait que 2 cases de large : une ligne de 4 cases
 * passe donc sur deux rangées, comme avec les `float` de l'original.
 */
type DecorRow = readonly number[] | null;

const RIGHT_VIEW: readonly DecorRow[] = [
  [1], [1, 1], [0, 1], null,
  [0, 1], [1, 1], [0, 1], null,
  [1, 1, 1, 1], null,
  [1], [1, 1], [1], null,
  [1, 1], [1], [1], null,
  [0, 1], [0, 1], [0, 1], [0, 1],
];

const LEFT_VIEW: readonly DecorRow[] = [
  [0, 1], [1, 1], [1], null,
  [1], [1, 1], [1], null,
  [1, 1, 1, 1], null,
  [0, 1], [1, 1], [0, 1], null,
  [1, 1], [0, 1], [0, 1], null,
  [1], [1], [1], [1],
];

/** Découpe les lignes de plus de 2 cases en rangées de 2. */
function toRows(view: readonly DecorRow[]): Array<readonly number[] | null> {
  return view.flatMap((row) => {
    if (row === null) return [null];
    const chunks: number[][] = [];
    for (let i = 0; i < row.length; i += 2) chunks.push(row.slice(i, i + 2) as number[]);
    return chunks;
  });
}

function DecorView({ view, left }: { view: readonly DecorRow[]; left?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`${styles.decoView} ${left ? styles.decoViewLeft : ""}`}
    >
      {toRows(view).map((row, y) =>
        row === null ? (
          <div key={y} className={styles.decoRow} />
        ) : (
          <div key={y} className={styles.decoRow}>
            {row.map((filled, x) =>
              filled ? (
                <b key={x} className={`${styles.cell} ${styles.on}`} />
              ) : (
                <span key={x} className={styles.decoGap} />
              ),
            )}
          </div>
        ),
      )}
    </div>
  );
}

export function ConsoleDecor() {
  return (
    <div aria-hidden="true">
      <div className={styles.topBorder}>
        <div className={styles.topBorderGroup}>
          <span style={{ width: 40 }} />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className={`${styles.topBorderGroup} ${styles.topBorderGroupRight}`}>
          <span style={{ width: 40 }} />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      <h1 className={styles.title}>T E T R I S</h1>
      <DecorView view={RIGHT_VIEW} />
      <DecorView view={LEFT_VIEW} left />
    </div>
  );
}
