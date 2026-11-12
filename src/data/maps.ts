import { useEffect, useState } from 'react';
import indiaData from './generated/india.json';

export type Region = {
  id: string;
  name: string;
  group?: string;
  /** SVG path in map viewBox units */
  d: string;
  /** internal boundaries (districts etc.), used in Inline mode */
  inner?: string;
  districts?: string[];
  /** ids of regions sharing a border (India only) */
  neighbors?: string[];
  cx: number;
  cy: number;
  bbox: [number, number, number, number];
  /** bbox of the main landmass only */
  core: [number, number, number, number];
  area: number;
  /** kilometres per map unit around this region */
  km: number;
  /** rasterised shape over bbox, used to measure placement overlap */
  mask: { w: number; h: number; cell: number; count: number; bits: string };
  playable: boolean;
};

export type MapData = {
  id: string;
  width: number;
  height: number;
  border: string | null;
  regions: Region[];
};

export type MapDefinition = {
  id: 'india' | 'world';
  title: string;
  description: string;
  /** singular noun used in prompts, e.g. "state" */
  unit: string;
  supportsInline: boolean;
  /** what the base map shows in each diagram mode */
  modeHelp: { outline: string; inline: string };
  /** optional filters a teacher can pick (e.g. continents) */
  groups?: string[];
  data: MapData;
};

export type MapId = MapDefinition['id'];
export type MapMeta = Omit<MapDefinition, 'data'>;

/** Everything about each map except its geometry (cheap, always loaded). */
export const MAP_META: Record<MapId, MapMeta> = {
  india: {
    id: 'india',
    title: 'India',
    description: '28 states and 8 union territories',
    unit: 'state',
    supportsInline: true,
    modeHelp: {
      outline: "The map shows only India's outer border — you work out where each state sits.",
      inline: 'The map shows state borders, and each shape includes its district boundaries.',
    },
  },
  world: {
    id: 'world',
    title: 'World',
    description: 'Countries of every continent',
    unit: 'country',
    supportsInline: true,
    modeHelp: {
      outline: 'The map shows only coastlines — no country borders.',
      inline: 'The map shows every country border.',
    },
    groups: ['Asia', 'Africa', 'Europe', 'North America', 'South America', 'Oceania'],
  },
};

/** India is used by every game and the landing page, so it ships with the app. */
export const INDIA: MapDefinition = { ...MAP_META.india, data: indiaData as MapData };

const loaded: Partial<Record<MapId, MapDefinition>> = { india: INDIA };
const pending: Partial<Record<MapId, Promise<MapDefinition>>> = {};

/**
 * Loads a map's geometry. The world map (~400 KB) is a separate download that only happens when
 * someone opens World Explorer, which keeps the first page load small.
 */
export function loadMap(id: MapId): Promise<MapDefinition> {
  const ready = loaded[id];
  if (ready) return Promise.resolve(ready);
  pending[id] ??= import('./generated/world.json').then((m) => {
    const data = ((m as { default?: unknown }).default ?? m) as MapData;
    const def = { ...MAP_META[id], data };
    loaded[id] = def;
    return def;
  });
  return pending[id]!;
}

/** The map with its geometry, or null while it is still downloading. */
export function useMap(id: string | undefined): MapDefinition | null {
  const key: MapId = id === 'world' ? 'world' : 'india';
  const [map, setMap] = useState<MapDefinition | null>(loaded[key] ?? null);
  useEffect(() => {
    let alive = true;
    if (!loaded[key]) loadMap(key).then((m) => alive && setMap(m));
    else setMap(loaded[key]!);
    return () => {
      alive = false;
    };
  }, [key]);
  return map;
}

/** Start downloading a map in the background (e.g. when its card is tapped). */
export function prefetchMap(id: MapId) {
  loadMap(id).catch(() => {});
}

export type View = { x: number; y: number; w: number; h: number };

/** The part of the map to show: the whole map, or framed around one group (e.g. a continent). */
export function getView(map: MapDefinition, group?: string): View {
  const { width, height, regions } = map.data;
  const full = { x: 0, y: 0, w: width, h: height };
  if (!group) return full;
  // Ignore giant countries (Russia spans Europe and Asia) so the frame stays tight.
  const rs = regions.filter((r) => r.group === group && r.playable && r.core[2] - r.core[0] < width * 0.25);
  if (!rs.length) return full;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const r of rs) {
    x0 = Math.min(x0, r.core[0]);
    y0 = Math.min(y0, r.core[1]);
    x1 = Math.max(x1, r.core[2]);
    y1 = Math.max(y1, r.core[3]);
  }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width, x1 + pad);
  y1 = Math.min(height, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function inView(r: Region, v: View) {
  return r.cx >= v.x && r.cx <= v.x + v.w && r.cy >= v.y && r.cy <= v.y + v.h;
}
