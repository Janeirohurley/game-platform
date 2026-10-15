import type { CSSProperties } from "react";

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  dropDistance,
  getCells,
  getShape,
  type PieceType,
  type TetrisState,
} from "../../engine";
import styles from "./tetris-console.module.css";

/** 0 = case éteinte, 1 = case allumée, 2 = « fantôme » (ombre de la pièce). */
type LcdCell = 0 | 1 | 2;

/** Plateau + pièce courante + fantôme, aplatis en cases éteintes / allumées / fantôme. */
function buildMatrix(game: TetrisState): LcdCell[][] {
  const matrix: LcdCell[][] = game.board.map((row) =>
    row.map((cell) => (cell !== 0 ? 1 : 0)),
  );

  const pieceCells = getCells(game.current);
  // Le fantôme n'apparaît que si la pièce touche déjà le plateau : au tout
  // début (ou pour un spectateur avant le départ) elle est encore hors-champ.
  if (pieceCells.some(([, y]) => y >= 0)) {
    const distance = dropDistance(game.board, game.current);
    if (distance > 0) {
      const shadow = getCells({ ...game.current, y: game.current.y + distance });
      for (const [x, y] of shadow) {
        if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH && matrix[y][x] === 0) {
          matrix[y][x] = 2;
        }
      }
    }
  }

  for (const [x, y] of pieceCells) {
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) matrix[y][x] = 1;
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
            {row.map((cell, x) => (
              <b
                key={x}
                className={`${styles.cell} ${
                  cell === 1 ? styles.on : cell === 2 ? styles.ghost : ""
                }`}
              />
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
