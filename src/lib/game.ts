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

/**
 * Is a piece dropped with its centroid at (x, y) (map units) close enough to where it belongs?
 * `pxPerUnit` lets the tolerance stay finger-sized on every screen.
 */
export function isCorrectDrop(region: Region, x: number, y: number, pxPerUnit: number) {
  const [x0, y0, x1, y1] = region.bbox;
  const diag = Math.hypot(x1 - x0, y1 - y0);
  const tolerance = Math.max(30 / pxPerUnit, diag * 0.3);
  return Math.hypot(x - region.cx, y - region.cy) <= tolerance;
}
