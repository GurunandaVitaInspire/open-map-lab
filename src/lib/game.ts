import { getView, inView, type MapDefinition, type Region } from '../data/maps';

export type DiagramMode = 'outline' | 'inline';

export type GameConfig = {
  mapId: MapDefinition['id'];
  mode: DiagramMode;
  group?: string; // e.g. continent filter
  count: number; // 0 = all
};

export function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuestions(map: MapDefinition, config: GameConfig): Region[] {
  const view = getView(map, config.group);
  const pool = map.data.regions.filter(
    (r) => r.playable && (!config.group || r.group === config.group) && inView(r, view),
  );
  const q = shuffle(pool);
  return config.count > 0 ? q.slice(0, config.count) : q;
}

// ---- placement accuracy ------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const maskCache = new Map<string, Uint8Array>();

function decodeMask(r: Region): Uint8Array {
  const cached = maskCache.get(r.id);
  if (cached) return cached;
  const { bits, w, h } = r.mask;
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (bits[i + k] === '=' || bits[i + k] === undefined ? 0 : B64.indexOf(bits[i + k])));
    const v = (n[0] << 18) | (n[1] << 12) | (n[2] << 6) | n[3];
    bytes.push((v >> 16) & 255, (v >> 8) & 255, v & 255);
  }
  const cells = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) cells[k] = (bytes[k >> 3] >> (k & 7)) & 1;
  maskCache.set(r.id, cells);
  return cells;
}

export type Placement = {
  /** 0–100: share of the shape that lands on its true position */
  accuracy: number;
  /** distance between where it was dropped and where it belongs */
  km: number;
};

/**
 * How accurately was a region placed?
 * (dx, dy) is the drop offset from the true position, in map units. We slide the region's
 * mask by that offset and measure how much of it still covers the true shape.
 * `slackUnits` forgives tiny finger/mouse jitter (a few screen pixels).
 */
export function measurePlacement(r: Region, dx: number, dy: number, slackUnits: number): Placement {
  const dist = Math.hypot(dx, dy);
  const km = Math.round(dist * r.km);
  if (dist <= slackUnits) return { accuracy: 100, km };
  const k = (dist - slackUnits) / dist;
  const { w, h, cell, count } = r.mask;
  const sx = Math.round((dx * k) / cell);
  const sy = Math.round((dy * k) / cell);
  if (Math.abs(sx) >= w || Math.abs(sy) >= h || count === 0) return { accuracy: 0, km };
  const m = decodeMask(r);
  let hit = 0;
  for (let j = Math.max(0, sy); j < Math.min(h, h + sy); j++) {
    for (let i = Math.max(0, sx); i < Math.min(w, w + sx); i++) {
      if (m[j * w + i] && m[(j - sy) * w + (i - sx)]) hit++;
    }
  }
  return { accuracy: Math.round((hit / count) * 100), km };
}

// ---- feedback copy --------------------------------------------------------------

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export const CHEERS = {
  perfect: ['Bullseye!', 'Geo genius!', 'Pinpoint perfect!', 'Map master!', 'Nailed it!'],
  great: ['Awesome!', 'So close to perfect!', 'Sharp eyes!', 'Brilliant!'],
  good: ['Nice!', 'Getting there!', 'Good placement!'],
  close: [
    "Almost! Focus on its neighbours and you'll get the next one.",
    'Every explorer misses sometimes. Deep breath, you can do this!',
    "You're learning — that's how great map-makers start.",
  ],
  missed: [
    "Don't worry! Look at the green outline and remember it.",
    'Mistakes draw the map in your memory. Keep going!',
    'Focus mode on — you can totally get the next one!',
  ],
};

export function cheer(tier: keyof typeof CHEERS) {
  return pick(CHEERS[tier]);
}

function compass(dx: number, dy: number, still = 0.12): string {
  // dx east+, dy south+ (screen space). Returns e.g. "north-west"
  const len = Math.hypot(dx, dy) || 1;
  const ns = dy / len < -still * 3 ? 'north' : dy / len > still * 3 ? 'south' : '';
  const ew = dx / len > still * 3 ? 'east' : dx / len < -still * 3 ? 'west' : '';
  return ns && ew ? `${ns}-${ew}` : ns || ew;
}

/** A short, location-based tip, e.g. "Kerala is in the south-west of India. You were too far north." */
export function placementTip(map: MapDefinition, r: Region, dx: number, dy: number): string {
  const { width, height } = map.data;
  let where: string;
  if (map.id === 'india') {
    const d = compass(r.cx - width / 2, r.cy - height / 2, 0.08);
    where = d ? `${r.name} is in the ${d} of India.` : `${r.name} is in central India.`;
  } else {
    where = r.group ? `${r.name} is in ${r.group}.` : '';
  }
  const off = compass(dx, dy);
  return off ? `${where} You were too far ${off}.` : where;
}

/** Stars and points for one answer. Streaks of strong answers add a bonus. */
export function pointsFor(accuracy: number, streak: number) {
  const bonus = accuracy >= 80 && streak >= 2 ? Math.min(streak, 5) * 10 : 0;
  return { base: accuracy, bonus, total: accuracy + bonus };
}
