// Converts raw TopoJSON / GeoJSON in data-sources/ into compact, pre-projected
// SVG path data that the app can render on any platform without a GIS runtime.
//
//   npm run build:maps
//
// Output: src/data/generated/<map>.json
//   { id, width, height, border, regions: [{ id, name, group, d, inner?, cx, cy, bbox, core, area, km, mask, playable }] }
// All coordinates are in the map's own viewBox space (width is always 1000).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea, geoContains, geoDistance, geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature, mesh, neighbors } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile, filter, filterWeight } from 'topojson-simplify';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (f) => join(root, 'data-sources', f);
const outDir = join(root, 'src', 'data', 'generated');
mkdirSync(outDir, { recursive: true });

const WIDTH = 1000;
const PAD = 12;
const r1 = (n) => Math.round(n * 10) / 10;

function fitProjection(projection, fc) {
  projection.fitWidth(WIDTH - PAD * 2, fc);
  const [[, y0], [, y1]] = geoPath(projection).bounds(fc);
  const height = Math.ceil(y1 - y0) + PAD * 2;
  projection.fitExtent([[PAD, PAD], [WIDTH - PAD, height - PAD]], fc);
  return { height, projection, path: geoPath(projection).digits(1) };
}

// Simplification can flip a tiny ring's winding, which d3 then reads as "the whole globe
// except this polygon". Rewind any polygon whose spherical area exceeds a hemisphere.
function fixWinding(fc) {
  const fixPoly = (rings) =>
    geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map((r) => r.slice().reverse()) : rings;
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') g.coordinates = fixPoly(g.coordinates);
    if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(fixPoly);
  }
  return fc;
}

const MASK_CELLS = 40; // resolution of the placement-accuracy mask along the longer side

// Rasterise a region into a small bitmask over its bbox. The app shifts this mask by the
// drop offset and measures how much of the shape still overlaps itself = placement accuracy.
function rasterMask(projection, f, [x0, y0, x1, y1]) {
  const cell = Math.max(x1 - x0, y1 - y0, 0.5) / MASK_CELLS;
  const w = Math.max(1, Math.ceil((x1 - x0) / cell));
  const h = Math.max(1, Math.ceil((y1 - y0) / cell));
  const bytes = new Uint8Array(Math.ceil((w * h) / 8));
  let count = 0;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const ll = projection.invert([x0 + (i + 0.5) * cell, y0 + (j + 0.5) * cell]);
      if (ll && geoContains(f, ll)) {
        const k = j * w + i;
        bytes[k >> 3] |= 1 << (k & 7);
        count++;
      }
    }
  }
  return { w, h, cell: Math.round(cell * 1000) / 1000, count, bits: Buffer.from(bytes).toString('base64') };
}

/** Kilometres per map unit around a point (for "off by ~120 km" feedback). */
function kmPerUnit(projection, [x, y]) {
  const a = projection.invert([x - 0.5, y]);
  const b = projection.invert([x + 0.5, y]);
  return Math.round(geoDistance(a, b) * 6371 * 100) / 100;
}

function regionRecord(path, f, extra, projection) {
  const [cx, cy] = path.centroid(f);
  const [[x0, y0], [x1, y1]] = path.bounds(f);
  // bbox of the largest polygon only (e.g. mainland France without French Guiana),
  // used to frame a continent view without overseas territories stretching it.
  let core = [[x0, y0], [x1, y1]];
  if (f.geometry?.type === 'MultiPolygon') {
    let best = -1;
    for (const coordinates of f.geometry.coordinates) {
      const poly = { type: 'Polygon', coordinates };
      const a = path.area(poly);
      if (a > best) {
        best = a;
        core = path.bounds(poly);
      }
    }
  }
  return {
    ...extra,
    d: path(f),
    cx: r1(cx),
    cy: r1(cy),
    bbox: [r1(x0), r1(y0), r1(x1), r1(y1)],
    core: [r1(core[0][0]), r1(core[0][1]), r1(core[1][0]), r1(core[1][1])],
    area: Math.round(path.area(f)),
    km: kmPerUnit(projection, [cx, cy]),
    mask: rasterMask(projection, f, [x0, y0, x1, y1]),
  };
}

const slug = (s) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function write(name, data) {
  const file = join(outDir, `${name}.json`);
  const json = JSON.stringify(data);
  writeFileSync(file, json);
  console.log(`${name}: ${data.regions.length} regions, ${(json.length / 1024).toFixed(0)} KB`);
}

// ---------------------------------------------------------------- India ----
{
  let topo = JSON.parse(readFileSync(src('india.topo.json'), 'utf8'));
  topo = presimplify(topo);
  topo = simplify(topo, quantile(topo, 0.35)); // keep 35% of vertices

  const states = fixWinding(feature(topo, topo.objects.states));
  const { height, path, projection } = fitProjection(geoMercator(), states);
  const districtGeoms = topo.objects.districts.geometries;

  // which states share a border (used for tricky quiz options)
  const stateGeoms = topo.objects.states.geometries;
  const touching = neighbors(stateGeoms);

  const regions = states.features.map((f, idx) => {
    const name = f.properties.st_nm;
    const own = districtGeoms.filter((g) => g.properties.st_nm === name);
    const inner = mesh(topo, { type: 'GeometryCollection', geometries: own }, (a, b) => a !== b);
    const rec = regionRecord(path, f, { id: slug(name), name }, projection);
    rec.inner = path(inner) ?? undefined;
    rec.districts = own.map((g) => g.properties.district).sort();
    rec.neighbors = touching[idx].map((j) => slug(stateGeoms[j].properties.st_nm)).sort();
    return rec;
  });

  // Union territories (for labels / filtering later)
  const UTS = new Set([
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  ]);
  for (const r of regions) {
    r.group = UTS.has(r.name) ? 'Union Territory' : 'State';
    // tiny regions are drawn but are too small to drag on a phone
    r.playable = r.area >= 40;
  }

  write('india', {
    id: 'india',
    width: WIDTH,
    height,
    border: path(mesh(topo, topo.objects.states, (a, b) => a === b)),
    regions: regions.sort((a, b) => a.name.localeCompare(b.name)),
  });

  buildRivers(states, projection);
}

// ---------------------------------------------------------------- World ----
{
  // Natural Earth 1:10m admin-0, India point-of-view edition (public domain).
  const ne = JSON.parse(readFileSync(src('ne_10m_admin_0_countries_ind.geojson'), 'utf8'));
  ne.features = ne.features.filter((f) => f.properties.ADM0_A3 !== 'ATA');
  const pre = presimplify(topology({ countries: ne }, 1e5));
  let topo = simplify(pre, quantile(pre, 0.03));
  topo = filter(topo, filterWeight(topo, 0.0003));

  const countries = fixWinding(feature(topo, topo.objects.countries));
  const { height, path, projection } = fitProjection(geoNaturalEarth1(), countries);

  const seen = new Set();
  // ids first, so neighbours (countries sharing a border) can refer to them
  const ids = countries.features.map((f) => {
    const p = f.properties;
    let id = (p.ADM0_A3_IN && p.ADM0_A3_IN !== '-99' ? p.ADM0_A3_IN : p.ADM0_A3).toLowerCase();
    while (seen.has(id)) id += '_';
    seen.add(id);
    return id;
  });
  const touching = neighbors(topo.objects.countries.geometries);
  const regions = countries.features
    .map((f, idx) => {
      const p = f.properties;
      const id = ids[idx];
      const rec = regionRecord(path, f, {
        id,
        name: p.NAME_EN || p.NAME,
        group: p.CONTINENT,
      }, projection);
      rec.neighbors = touching[idx].map((j) => ids[j]).sort();
      return rec;
    })
    .filter((r) => r.d && r.mask.count > 0);

  for (const r of regions) r.playable = r.area >= 25 && r.group !== 'Seven seas (open ocean)';

  // A tiny, very simplified copy just for thumbnails (the landing-page card), so the full world
  // map only has to load when someone actually opens World Explorer.
  let lite = simplify(pre, quantile(pre, 0.006));
  lite = filter(lite, filterWeight(lite, 0.02));
  const litePath = geoPath(projection).digits(0);
  const liteRegions = fixWinding(feature(lite, lite.objects.countries))
    .features.map((f) => ({
      id: (f.properties.ADM0_A3_IN && f.properties.ADM0_A3_IN !== '-99' ? f.properties.ADM0_A3_IN : f.properties.ADM0_A3).toLowerCase(),
      d: litePath(f),
    }))
    .filter((r) => r.d);
  write('world-lite', { id: 'world-lite', width: WIDTH, height, border: null, regions: liteRegions });

  write('world', {
    id: 'world',
    width: WIDTH,
    height,
    // coastlines / outer edges only — used as the "outline" base map
    border: path(mesh(topo, topo.objects.countries, (a, b) => a === b)),
    regions: regions.sort((a, b) => a.name.localeCompare(b.name)),
  });

}

// ---------------------------------------------------------------- Rivers ---
// Natural Earth 1:10m rivers (public domain), clipped to India and projected onto the India map.
function buildRivers(states, projection) {
  const RIVERS = [
    { id: 'ganga', name: 'Ganga', ne: ['Ganges'], source: [79.07, 30.99] },
    { id: 'yamuna', name: 'Yamuna', ne: ['Yamuna'], source: [78.46, 31.03] },
    { id: 'brahmaputra', name: 'Brahmaputra', ne: ['Brahmaputra', 'Dihang'], source: [95.25, 28.75] },
    { id: 'indus', name: 'Indus (Sindhu)', ne: ['Indus'], source: [79.45, 32.7] },
    { id: 'godavari', name: 'Godavari', ne: ['Godävari'], source: [73.53, 19.94] },
    { id: 'krishna', name: 'Krishna', ne: ['Krishna'], source: [73.66, 17.92] },
    { id: 'kaveri', name: 'Kaveri', ne: ['Cauvery'], source: [75.53, 12.39] },
    { id: 'narmada', name: 'Narmada', ne: ['Narmada'], source: [81.75, 22.67] },
    { id: 'tapi', name: 'Tapi', ne: ['Tapi'], source: [78.26, 21.77] },
    { id: 'mahanadi', name: 'Mahanadi', ne: ['Mahäna Nadï'], source: [81.93, 20.13] },
    { id: 'sutlej', name: 'Sutlej', ne: ['Sutlej'], source: [78.75, 31.83] },
    { id: 'beas', name: 'Beas', ne: ['Beas'], source: [77.08, 32.37] },
    { id: 'chenab', name: 'Chenab', ne: ['Chenab'], source: [77.0, 32.55] },
    { id: 'jhelum', name: 'Jhelum', ne: ['Jhelum'], source: [75.25, 33.55] },
    { id: 'chambal', name: 'Chambal', ne: ['Chambal'], source: [75.68, 22.46] },
    { id: 'son', name: 'Son', ne: ['Son'], source: [81.93, 22.72] },
    { id: 'gandak', name: 'Gandak', ne: ['Gandak'], source: [84.15, 27.45] },
    { id: 'ghaghara', name: 'Ghaghara', ne: ['Ghäghara'], source: [81.1, 28.4] },
    { id: 'tungabhadra', name: 'Tungabhadra', ne: ['Tungabhadra'], source: [75.68, 13.97] },
    { id: 'teesta', name: 'Teesta', ne: ['Tista'], source: [88.65, 27.95] },
  ];
  const ne = JSON.parse(readFileSync(src('ne_10m_rivers_lake_centerlines.geojson'), 'utf8'));
  const stateOf = (lonlat) => states.features.find((f) => geoContains(f, lonlat))?.properties.st_nm;
  const out = [];
  const lite = [];
  for (const river of RIVERS) {
    const lines = [];
    for (const f of ne.features) {
      const n = f.properties.name_en || f.properties.name;
      if (!river.ne.includes(n) || !f.geometry) continue;
      const g = f.geometry;
      lines.push(...(g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]));
    }
    // keep only the stretches inside India (split where the river leaves the country)
    const segs = [];
    let km = 0;
    for (const line of lines) {
      let cur = [];
      for (const ll of line) {
        if (stateOf(ll)) {
          if (cur.length) km += geoDistance(cur[cur.length - 1], ll) * 6371;
          cur.push(ll);
        } else if (cur.length) {
          if (cur.length > 1) segs.push(cur);
          cur = [];
        }
      }
      if (cur.length > 1) segs.push(cur);
    }
    const proj = segs.map((seg) => seg.map((ll) => projection(ll)));
    const d = proj.map((seg) => 'M' + seg.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')).join('');

    // evenly spaced sample points (map units) for scoring drawings, with their lon/lat
    const STEP = 4;
    const pts = [];
    const ptsLL = [];
    proj.forEach((seg, si) => {
      pts.push([r1(seg[0][0]), r1(seg[0][1])]);
      ptsLL.push(segs[si][0]);
      let carry = 0;
      for (let i = 1; i < seg.length; i++) {
        const [ax, ay] = seg[i - 1];
        const [bx, by] = seg[i];
        const len = Math.hypot(bx - ax, by - ay);
        let t = STEP - carry;
        while (t <= len) {
          const k = t / len;
          const a = segs[si][i - 1];
          const b = segs[si][i];
          pts.push([r1(ax + (bx - ax) * k), r1(ay + (by - ay) * k)]);
          ptsLL.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
          t += STEP;
        }
        carry = len - (t - STEP);
      }
    });

    // the start dot: the river point closest to the known source (or where it enters India)
    const [sx, sy] = projection(river.source);
    let best = 0;
    pts.forEach(([x, y], i) => {
      const [bx, by] = pts[best];
      if (Math.hypot(x - sx, y - sy) < Math.hypot(bx - sx, by - sy)) best = i;
    });
    const start = pts[best];

    // states it flows through, ordered from the source: walk along the river from the start dot
    // (nearest unvisited point each step), then order states by the middle of their stretch, so
    // border stretches (Yamuna: Haryana/UP) don't put the state it ends in (UP) too early.
    const walk = [best];
    const seen = new Set(walk);
    while (walk.length < pts.length) {
      const [cx, cy] = pts[walk[walk.length - 1]];
      let nxt = -1;
      pts.forEach(([x, y], i) => {
        if (seen.has(i)) return;
        if (nxt < 0 || Math.hypot(x - cx, y - cy) < Math.hypot(pts[nxt][0] - cx, pts[nxt][1] - cy)) nxt = i;
      });
      walk.push(nxt);
      seen.add(nxt);
    }
    const steps = new Map();
    walk.forEach((i, step) => {
      const st = stateOf(ptsLL[i]);
      if (!st) return;
      if (!steps.has(st)) steps.set(st, []);
      steps.get(st).push(step);
    });
    const middle = (xs) => xs[Math.floor(xs.length / 2)];
    const through = [...steps.entries()].sort((a, b) => middle(a[1]) - middle(b[1])).map(([st]) => st);

    out.push({ id: river.id, name: river.name, d, pts, start, states: through, km: Math.round(km / 10) * 10 });
    if (['ganga', 'brahmaputra', 'godavari', 'narmada', 'krishna', 'indus'].includes(river.id)) {
      const thin = proj.map((seg) => 'M' + seg.filter((_, i) => i % 3 === 0 || i === seg.length - 1).map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L'));
      lite.push({ id: river.id, d: thin.join('') });
    }
    console.log(`  ${river.name}: ${pts.length} pts, ~${Math.round(km)} km in India: ${through.join(' > ')}`);
  }
  writeFileSync(join(outDir, 'india-rivers.json'), JSON.stringify(out));
  writeFileSync(join(outDir, 'india-rivers-lite.json'), JSON.stringify(lite));
  console.log(`india-rivers: ${out.length} rivers, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB (thumbnail ${(JSON.stringify(lite).length / 1024).toFixed(1)} KB)`);
}
