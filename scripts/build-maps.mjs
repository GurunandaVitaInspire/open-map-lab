// Converts raw TopoJSON / GeoJSON in data-sources/ into compact, pre-projected
// SVG path data that the app can render on any platform without a GIS runtime.
//
//   npm run build:maps
//
// Output: src/data/generated/<map>.json
//   { id, width, height, border, regions: [{ id, name, group, d, inner?, cx, cy, bbox, area, playable }] }
// All coordinates are in the map's own viewBox space (width is always 1000).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea, geoMercator, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
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
  return { height, path: geoPath(projection).digits(1) };
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

function regionRecord(path, f, extra) {
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
  const { height, path } = fitProjection(geoMercator(), states);
  const districtGeoms = topo.objects.districts.geometries;

  const regions = states.features.map((f) => {
    const name = f.properties.st_nm;
    const own = districtGeoms.filter((g) => g.properties.st_nm === name);
    const inner = mesh(topo, { type: 'GeometryCollection', geometries: own }, (a, b) => a !== b);
    const rec = regionRecord(path, f, { id: slug(name), name });
    rec.inner = path(inner) ?? undefined;
    rec.districts = own.map((g) => g.properties.district).sort();
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
}

// ---------------------------------------------------------------- World ----
{
  // Natural Earth 1:10m admin-0, India point-of-view edition (public domain).
  const ne = JSON.parse(readFileSync(src('ne_10m_admin_0_countries_ind.geojson'), 'utf8'));
  ne.features = ne.features.filter((f) => f.properties.ADM0_A3 !== 'ATA');
  let topo = topology({ countries: ne }, 1e5);
  topo = presimplify(topo);
  topo = simplify(topo, quantile(topo, 0.03));
  topo = filter(topo, filterWeight(topo, 0.0003));

  const countries = fixWinding(feature(topo, topo.objects.countries));
  const { height, path } = fitProjection(geoNaturalEarth1(), countries);

  const seen = new Set();
  const regions = countries.features
    .map((f) => {
      const p = f.properties;
      let id = (p.ADM0_A3_IN && p.ADM0_A3_IN !== '-99' ? p.ADM0_A3_IN : p.ADM0_A3).toLowerCase();
      while (seen.has(id)) id += '_';
      seen.add(id);
      const rec = regionRecord(path, f, {
        id,
        name: p.NAME_EN || p.NAME,
        group: p.CONTINENT,
      });
      return rec;
    })
    .filter((r) => r.d);

  for (const r of regions) r.playable = r.area >= 25 && r.group !== 'Seven seas (open ocean)';

  write('world', {
    id: 'world',
    width: WIDTH,
    height,
    border: null,
    regions: regions.sort((a, b) => a.name.localeCompare(b.name)),
  });
}
