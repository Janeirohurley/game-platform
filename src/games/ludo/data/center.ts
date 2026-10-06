/**
 * center.ts — shared geometry of the centre finish zone.
 *
 * The centre is a diamond bound by |x| + |z| = CENTER_TRIANGLE_RADIUS, split
 * into four triangles, one per colour, each spanning the two axis directions
 * that lead towards that colour's home area. These constants are the single
 * source of truth: CenterArea draws the triangles and positionUtils spreads
 * finished pieces into their colour's triangle from the same values, so the
 * drawing and the placement cannot drift apart.
 *
 * The radius barely clears the ring cell beyond the home entry (that cell
 * starts at |x| + |z| = 2.55): the diamond cups the return lane but never
 * covers an in-play ring cell. The home-entry cells themselves (|x| = 2,
 * |z| = 2) are partially cupped, exactly like the previous, smaller diamond.
 */

export const CENTER_TRIANGLE_RADIUS = 2.4;

export type LudoColorName = "yellow" | "green" | "blue" | "red";

/**
 * Unit half-axes A (along x) and B (along z) of each colour's triangle,
 * pointing into the colour's quadrant. The triangle is the hull of
 * u*A + v*B with u >= 0, v >= 0 and u + v <= CENTER_TRIANGLE_RADIUS.
 */
export const COLOR_AXES: Record<
  LudoColorName,
  { readonly A: readonly [number, number]; readonly B: readonly [number, number] }
> = {
  yellow: { A: [-1, 0], B: [0, -1] }, // north-west, home at (-4.5, -4.5)
  green: { A: [-1, 0], B: [0, 1] }, // south-west, home at (-4.5, 4.5)
  blue: { A: [1, 0], B: [0, 1] }, // south-east, home at (4.5, 4.5)
  red: { A: [1, 0], B: [0, -1] }, // north-east, home at (4.5, -4.5)
};

/**
 * Finish slots per colour, along the triangle's bisector with a light lateral
 * offset for the middle pair so arrived pieces fan out instead of stacking.
 * `fraction` is a share of the maximum bisector reach (RADIUS / sqrt(2));
 * `lateral` is the perpendicular offset, in world units.
 */
const FINISH_SLOTS: ReadonlyArray<{ readonly fraction: number; readonly lateral: number }> = [
  { fraction: 0.3, lateral: 0 },
  { fraction: 0.55, lateral: 0.4 },
  { fraction: 0.55, lateral: -0.4 },
  { fraction: 0.95, lateral: 0 },
];

/**
 * World (x, z) of the `pieceIndex`-th finish slot for `color`. The bundle is
 * rotated so the four pieces of a colour sit in the quadrant that faces its
 * home area: yellow tops the board, red tops it on the right, etc.
 */
export function finishedSlotOffset(
  color: LudoColorName,
  pieceIndex: number,
): readonly [number, number] {
  const { A, B } = COLOR_AXES[color];
  const slot = FINISH_SLOTS[pieceIndex % FINISH_SLOTS.length];
  const depth = (CENTER_TRIANGLE_RADIUS / Math.SQRT2) * slot.fraction;
  // Parameter of the bisector point: u = v = depth / sqrt(2), which keeps
  // u + v <= RADIUS for every fraction <= 1 and touches the far edge only
  // at the last slot.
  const u = depth / Math.SQRT2;
  const v = u;

  let x = A[0] * u + B[0] * v;
  let z = A[1] * u + B[1] * v;

  if (slot.lateral !== 0) {
    const diagonalLength = Math.hypot(x, z);
    // Perpendicular of the bisector, normalized, signed by the slot.
    const perpX = -z / diagonalLength;
    const perpZ = x / diagonalLength;
    x += perpX * slot.lateral;
    z += perpZ * slot.lateral;
  }

  return [x, z];
}