import type { CSSProperties } from "react";

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  getCells,
  getShape,
  type PieceType,
  type TetrisState,
} from "../../engine";
import styles from "./tetris-console.module.css";

/** Plateau + pièce courante, aplatis en cases allumées / éteintes. */
function buildMatrix(game: TetrisState): boolean[][] {
  const matrix = game.board.map((row) => row.map((cell) => cell !== 0));
  for (const [x, y] of getCells(game.current)) {
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) matrix[y][x] = true;
  }
  return matrix;
}

export function LcdMatrix({ game }: { game: TetrisState }) {
  const over = game.status === "over";
  // En LCD toutes les pièces sont noires : la couleur n'existe pas sur cet écran.
  const matrix = buildMatrix(game);

  return (
    <div className={styles.matrixWrap}>
      <div
        role="img"
        aria-label={`Plateau de Tetris : ${game.lines} lignes, score ${game.score}`}
        className={`${styles.matrix} ${over ? styles.over : ""}`}
      >
        {matrix.map((row, y) => (
          <div
            key={y}
            className={styles.row}
            // Le remplissage de fin de partie part du bas et remonte.
            style={{ "--delay": `${(BOARD_HEIGHT - 1 - y) * 40}ms` } as CSSProperties}
          >
            {row.map((on, x) => (
              <b key={x} className={`${styles.cell} ${on ? styles.on : ""}`} />
            ))}
          </div>
        ))}
      </div>

      {over && (
        <div role="status" className={styles.gameOver}>
          <strong>
            PARTIE
            <br />
            TERMINÉE
          </strong>
          <span>Appuie sur R</span>
        </div>
      )}
    </div>
  );
}

/** Position de chaque pièce dans l'aperçu 2 x 4 (copiée de l'original). */
const NEXT_OFFSET: Record<PieceType, readonly [number, number]> = {
  I: [1, 0],
  L: [0, 0],
  J: [0, 0],
  Z: [0, 0],
  S: [0, 0],
  O: [0, 1],
  T: [0, 0],
};

export function LcdNext({ type }: { type: PieceType }) {
  const cells = Array.from({ length: 2 }, () => Array<boolean>(4).fill(false));
  const shape = getShape(type, 0).filter((row) => row.some(Boolean));
  const [dy, dx] = NEXT_OFFSET[type];

  shape.forEach((row, y) =>
    row.forEach((filled, x) => {
      if (filled && cells[y + dy]?.[x + dx] !== undefined) cells[y + dy][x + dx] = true;
    }),
  );

  return (
    <div role="img" aria-label={`Prochaine pièce : ${type}`} className={styles.nextGrid}>
      {cells.map((row, y) => (
        <div key={y} className={styles.nextRow}>
          {row.map((on, x) => (
            <b key={x} className={`${styles.cell} ${on ? styles.on : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
