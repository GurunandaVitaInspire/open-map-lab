import indiaData from './generated/india.json';
import worldData from './generated/world.json';

export type Region = {
  id: string;
  name: string;
  group?: string;
  /** SVG path in map viewBox units */
  d: string;
  /** internal boundaries (districts etc.), used in Inline mode */
  inner?: string;
  districts?: string[];
  cx: number;
  cy: number;
  bbox: [number, number, number, number];
  /** bbox of the main landmass only */
  core: [number, number, number, number];
  area: number;
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
  /** optional filters a teacher can pick (e.g. continents) */
  groups?: string[];
  data: MapData;
};

export const MAPS: Record<MapDefinition['id'], MapDefinition> = {
  india: {
    id: 'india',
    title: 'India',
    description: '28 states and 8 union territories',
    unit: 'state',
    supportsInline: true,
    data: indiaData as MapData,
  },
  world: {
    id: 'world',
    title: 'World',
    description: 'Countries of every continent',
    unit: 'country',
    supportsInline: false,
    groups: ['Asia', 'Africa', 'Europe', 'North America', 'South America', 'Oceania'],
    data: worldData as MapData,
  },
};

export const MAP_LIST = [MAPS.india, MAPS.world];

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

export function getMap(id: string | undefined): MapDefinition {
  return (id && MAPS[id as MapDefinition['id']]) || MAPS.india;
}
