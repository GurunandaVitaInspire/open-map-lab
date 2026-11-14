import riversData from '../data/generated/india-rivers.json';

/** One river, already projected onto the India map (map units). */
export type River = {
  id: string;
  name: string;
  /** SVG path of the river's course inside India */
  d: string;
  /** points every ~4 map units along the course, used for scoring */
  pts: [number, number][];
  /** where it starts (or enters India) */
  start: [number, number];
  /** states it flows through, from the source onwards */
  states: string[];
};

export const RIVERS = riversData as unknown as River[];

export type Stroke = [number, number][];

/** Resample a freehand drawing to points every `step` map units. */
function resample(strokes: Stroke[], step: number): [number, number][] {
  const out: [number, number][] = [];
  for (const s of strokes) {
    if (!s.length) continue;
    out.push(s[0]);
    let carry = 0;
    for (let i = 1; i < s.length; i++) {
      const [ax, ay] = s[i - 1];
      const [bx, by] = s[i];
      const len = Math.hypot(bx - ax, by - ay);
      let t = step - carry;
      while (t <= len) {
        const k = t / len;
        out.push([ax + (bx - ax) * k, ay + (by - ay) * k]);
        t += step;
      }
      carry = len - (t - step);
    }
  }
  return out;
}

const nearest = (p: [number, number], set: [number, number][]) => {
  let best = Infinity;
  for (const q of set) {
    const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
};

export type RiverScore = {
  /** 0–100 */
  score: number;
  /** share of the real river the drawing followed (0–1) */
  coverage: number;
  /** average distance of the drawing from the river, map units */
  offset: number;
};

/**
 * How well does a freehand drawing follow the river? Combines
 *  - coverage: how much of the real river has the drawing close to it (soft: full credit when
 *    close, fading out further away), and
 *  - closeness: how far the drawn line strays from the river on average.
 * Tolerances never shrink below a finger-width on screen (`pxPerUnit`), because the aim is
 * "roughly right" (the right region and direction), not a tracing exercise.
 * On the India map (1000 units ≈ 3,000 km): ~20 units off still scores ~90, ~45 units ~50–75.
 */
export function scoreRiver(river: River, strokes: Stroke[], pxPerUnit: number): RiverScore {
  const drawn = resample(strokes, 4);
  if (drawn.length < 3) return { score: 0, coverage: 0, offset: Infinity };
  const full = Math.max(12, 6 / pxPerUnit); // this close counts fully as "on the river"
  const fade = Math.max(45, 18 / pxPerUnit); // credit fades to nothing this much further out
  const slack = Math.max(6, 4 / pxPerUnit); // wobble that costs nothing
  const credit = (d: number) => Math.max(0, Math.min(1, 1 - (d - full) / fade));
  const covered = river.pts.reduce((a, p) => a + credit(nearest(p, drawn)), 0) / river.pts.length;
  const offsets = drawn.map((p) => Math.min(nearest(p, river.pts), 150));
  const offset = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  const closeness = Math.max(0, Math.min(1, 1 - (offset - slack) / (fade * 1.3)));
  const score = Math.round(100 * (0.7 * covered + 0.3 * closeness));
  return { score: Math.max(0, Math.min(100, score)), coverage: covered, offset };
}

/** Freehand drawing is never pixel-perfect, so the tiers are a little more forgiving. */
export function riverTier(score: number): 'perfect' | 'great' | 'good' | 'close' | 'missed' {
  if (score >= 90) return 'perfect';
  if (score >= 75) return 'great';
  if (score >= 50) return 'good';
  if (score > 0) return 'close';
  return 'missed';
}
