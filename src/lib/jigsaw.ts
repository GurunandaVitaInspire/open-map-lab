/**
 * Classic jigsaw cut: a rows × cols grid where every inner edge gets a round knob that sticks out
 * of one piece and into its neighbour. Paths are in picture units, so the same shapes are used for
 * clipping the picture, drawing the piece outline and drawing the seams on the board.
 */

export type Piece = {
  id: string;
  row: number;
  col: number;
  /** cell rectangle in picture units */
  x: number;
  y: number;
  w: number;
  h: number;
  /** closed outline (clockwise), picture units */
  path: string;
};

export type Jigsaw = {
  rows: number;
  cols: number;
  cellW: number;
  cellH: number;
  /** how far knobs can stick out of a cell, picture units */
  margin: number;
  pieces: Piece[];
};

type Edge = { dir: 1 | -1; center: number }; // dir: knob points +x / +y; center: 0..1 along the edge

/** Grid shapes per piece count, chosen to keep cells close to square for a portrait-ish map. */
export const PUZZLE_SIZES: Record<number, { rows: number; cols: number }> = {
  12: { rows: 4, cols: 3 },
  20: { rows: 5, cols: 4 },
  30: { rows: 6, cols: 5 },
};

// One knob, mirror-symmetric around its centre (u = 0), in units of the knob scale `s`.
// u runs along the edge, v outwards. Same curve read backwards = same shape, so neighbours match.
const KNOB: [number, number][][] = [
  [[-0.08, 0], [-0.06, 0.07], [-0.09, 0.12]],
  [[-0.15, 0.2], [-0.1, 0.27], [0, 0.27]],
  [[0.1, 0.27], [0.15, 0.2], [0.09, 0.12]],
  [[0.06, 0.07], [0.08, 0], [0.12, 0]],
];
export const KNOB_HEIGHT = 0.27;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const f = (n: number) => Math.round(n * 10) / 10;

/**
 * Draws one edge from (x0,y0) to (x1,y1). `nx,ny` is the piece's outward normal and `sign` says
 * whether the knob goes out (+1), in (-1) or the edge is flat (0).
 */
function edge(x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, sign: number, center: number, s: number) {
  if (!sign) return ` L${f(x1)} ${f(y1)}`;
  const L = Math.hypot(x1 - x0, y1 - y0);
  const tx = (x1 - x0) / L;
  const ty = (y1 - y0) / L;
  const cx = x0 + tx * center * L;
  const cy = y0 + ty * center * L;
  const P = (u: number, v: number) => `${f(cx + tx * u * s + nx * v * s * sign)} ${f(cy + ty * u * s + ny * v * s * sign)}`;
  let d = ` L${P(-0.12, 0)}`;
  for (const seg of KNOB) d += ` C${P(...seg[0])} ${P(...seg[1])} ${P(...seg[2])}`;
  return d + ` L${f(x1)} ${f(y1)}`;
}

export function makeJigsaw(width: number, height: number, rows: number, cols: number, seed = Date.now()): Jigsaw {
  const rand = rng(seed);
  const cellW = width / cols;
  const cellH = height / rows;
  const s = Math.min(cellW, cellH); // knob scale
  const pick = (): Edge => ({ dir: rand() < 0.5 ? 1 : -1, center: 0.42 + rand() * 0.16 });
  // horizontal inner edges (between row r-1 and r) and vertical inner edges (between col c-1 and c)
  const hEdges = Array.from({ length: rows + 1 }, (_, r) => Array.from({ length: cols }, () => (r > 0 && r < rows ? pick() : null)));
  const vEdges = Array.from({ length: rows }, () => Array.from({ length: cols + 1 }, (_, c) => (c > 0 && c < cols ? pick() : null)));

  const pieces: Piece[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW;
      const y = r * cellH;
      const top = hEdges[r][c];
      const bottom = hEdges[r + 1][c];
      const left = vEdges[r][c];
      const right = vEdges[r][c + 1];
      let d = `M${f(x)} ${f(y)}`;
      // top: left→right, outward normal up; knob "+y" points into this piece
      d += edge(x, y, x + cellW, y, 0, -1, top ? -top.dir : 0, top?.center ?? 0.5, s);
      // right: top→bottom, outward normal +x
      d += edge(x + cellW, y, x + cellW, y + cellH, 1, 0, right ? right.dir : 0, right?.center ?? 0.5, s);
      // bottom: right→left (reversed), outward normal +y
      d += edge(x + cellW, y + cellH, x, y + cellH, 0, 1, bottom ? bottom.dir : 0, bottom ? 1 - bottom.center : 0.5, s);
      // left: bottom→top (reversed), outward normal -x
      d += edge(x, y + cellH, x, y, -1, 0, left ? -left.dir : 0, left ? 1 - left.center : 0.5, s);
      pieces.push({ id: `${r}-${c}`, row: r, col: c, x, y, w: cellW, h: cellH, path: d + ' Z' });
    }
  }
  return { rows, cols, cellW, cellH, margin: s * (KNOB_HEIGHT + 0.06), pieces };
}
