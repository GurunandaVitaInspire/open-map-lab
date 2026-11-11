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

export type Rating = { label: string; color: string; fill: string };

export function rate(accuracy: number): Rating {
  if (accuracy >= 90) return { label: 'Perfect', color: '#1F8A4C', fill: '#7CC99A' };
  if (accuracy >= 70) return { label: 'Great', color: '#4D8F1F', fill: '#B9DE8F' };
  if (accuracy >= 45) return { label: 'Close', color: '#A87300', fill: '#F3D27A' };
  if (accuracy > 0) return { label: 'Nearly', color: '#B4561A', fill: '#F2B07E' };
  return { label: 'Missed', color: '#C03434', fill: '#EBA3A3' };
}

export const RATING_LEGEND = [95, 80, 55, 20, 0].map(rate);
