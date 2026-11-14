/**
 * Physics of a hanging cable carrying cards, like a cable-car line.
 *
 * A flexible cable under horizontal tension H hangs so that its sag at any point is M(x) / H,
 * where M(x) is the bending moment that the same loads would cause in a simply supported beam
 * (the classic "cable theorem"). With a light rope and heavier cards that gives exactly what you
 * see on a real cable car line: nearly straight stretches between cars, a kink at every car, and
 * the lowest point in the middle. The rope's own weight adds a gentle curve to each stretch.
 *
 * Between two loads the shape is a parabola, so each stretch is drawn as one exact quadratic
 * Bézier, and the whole cable is only a handful of numbers to recompute while it bounces.
 */

/** the rope weighs about this many cards in total */
const ROPE_WEIGHT = 0.45;

export type Cable = {
  /** sag below the supports at x (px) for the given load on each card (1 = resting weight) */
  dipAt: (x: number, loads: number[]) => number;
  /** SVG path of the cable */
  path: (top: number, loads: number[]) => string;
  /** average slope at each card (for a natural tilt) */
  slopes: number[];
};

/**
 * @param x0 left support (px), @param x1 right support (px)
 * @param cards x of each card's clip, @param sag how far the middle dips with every card at rest
 */
export function makeCable(x0: number, x1: number, cards: number[], sag: number): Cable {
  const L = x1 - x0;
  const w = ROPE_WEIGHT / L; // rope weight per px (in "cards")
  const as = cards.map((x) => x - x0);
  // bending moment from the rope itself, and from one unit load at a, and their slopes
  const Mw = (u: number) => (w * u * (L - u)) / 2;
  const dMw = (u: number) => (w * (L - 2 * u)) / 2;
  const Mp = (u: number, a: number) => (u <= a ? (u * (L - a)) / L : (a * (L - u)) / L);
  const dMp = (u: number, a: number, right: boolean) => (u < a || (u === a && !right) ? (L - a) / L : -a / L);
  const M = (u: number, loads: number[]) => Mw(u) + as.reduce((m, a, i) => m + loads[i] * Mp(u, a), 0);
  const dM = (u: number, loads: number[], right: boolean) => dMw(u) + as.reduce((m, a, i) => m + loads[i] * dMp(u, a, right), 0);

  // choose the tension so the deepest point dips `sag` px with every card at rest
  const rest = cards.map(() => 1);
  let maxM = 0;
  for (let k = 0; k <= 200; k++) maxM = Math.max(maxM, M((L * k) / 200, rest));
  for (const a of as) maxM = Math.max(maxM, M(a, rest));
  const H = maxM / Math.max(sag, 1);

  const dipAt = (x: number, loads: number[]) => M(x - x0, loads) / H;
  const knots = [0, ...as, L];
  const path = (top: number, loads: number[]) => {
    let d = `M${x0.toFixed(1)} ${top.toFixed(1)}`;
    for (let k = 0; k < knots.length - 1; k++) {
      const p = knots[k];
      const q = knots[k + 1];
      const yp = M(p, loads) / H;
      const yq = M(q, loads) / H;
      const slope = dM(p, loads, true) / H;
      const cx = x0 + (p + q) / 2;
      const cy = top + yp + (slope * (q - p)) / 2;
      d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${(x0 + q).toFixed(1)} ${(top + yq).toFixed(1)}`;
    }
    return d;
  };
  const slopes = as.map((a) => (dM(a, rest, false) + dM(a, rest, true)) / 2 / H);
  return { dipAt, path, slopes };
}
