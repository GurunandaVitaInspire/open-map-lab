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

/** someone pulling the rope at x (px) with force f (in card weights; + pulls down, − lifts) */
export type Pull = { x: number; f: number };

export type Cable = {
  /** sag below the supports at x (px) for the given load on each card (1 = resting weight) */
  dipAt: (x: number, loads: number[], pull?: Pull) => number;
  /** the rope's slope at x (average of both sides where it bends) */
  slopeAt: (x: number, loads: number[], pull?: Pull) => number;
  /** how far the rope at x moves per unit of pull at px */
  influence: (x: number, px: number) => number;
  /** SVG path of the cable */
  path: (top: number, loads: number[], pull?: Pull) => string;
  /** average slope at each card at rest (for a natural tilt) */
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
  const at = (pull?: Pull) => (pull ? Math.max(1, Math.min(L - 1, pull.x - x0)) : 0);
  const M = (u: number, loads: number[], pull?: Pull) =>
    Mw(u) + as.reduce((m, a, i) => m + loads[i] * Mp(u, a), 0) + (pull ? pull.f * Mp(u, at(pull)) : 0);
  const dM = (u: number, loads: number[], right: boolean, pull?: Pull) =>
    dMw(u) + as.reduce((m, a, i) => m + loads[i] * dMp(u, a, right), 0) + (pull ? pull.f * dMp(u, at(pull), right) : 0);

  // choose the tension so the deepest point dips `sag` px with every card at rest
  const rest = cards.map(() => 1);
  let maxM = 0;
  for (let k = 0; k <= 200; k++) maxM = Math.max(maxM, M((L * k) / 200, rest));
  for (const a of as) maxM = Math.max(maxM, M(a, rest));
  const H = maxM > 0 ? maxM / Math.max(sag, 1) : 1;

  const dipAt = (x: number, loads: number[], pull?: Pull) => M(x - x0, loads, pull) / H;
  const slopeAt = (x: number, loads: number[], pull?: Pull) => (dM(x - x0, loads, false, pull) + dM(x - x0, loads, true, pull)) / 2 / H;
  const influence = (x: number, px: number) => Mp(x - x0, Math.max(1, Math.min(L - 1, px - x0))) / H;
  const path = (top: number, loads: number[], pull?: Pull) => {
    // the rope bends at every card and at the hand pulling it; between bends each stretch is a parabola
    const knots = [0, ...as, L];
    if (pull && pull.f !== 0) knots.push(at(pull));
    knots.sort((a, b) => a - b);
    let d = `M${x0.toFixed(1)} ${top.toFixed(1)}`;
    for (let k = 0; k < knots.length - 1; k++) {
      const p = knots[k];
      const q = knots[k + 1];
      if (q - p < 0.01) continue;
      const yp = M(p, loads, pull) / H;
      const yq = M(q, loads, pull) / H;
      const slope = dM(p, loads, true, pull) / H;
      const cx = x0 + (p + q) / 2;
      const cy = top + yp + (slope * (q - p)) / 2;
      d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${(x0 + q).toFixed(1)} ${(top + yq).toFixed(1)}`;
    }
    return d;
  };
  const slopes = cards.map((x) => slopeAt(x, rest));
  return { dipAt, slopeAt, influence, path, slopes };
}
