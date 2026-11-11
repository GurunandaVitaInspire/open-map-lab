# Open Map Lab

**Making Education Interactive, Accessible, and Free for Everyone.**

An open-source, completely free, interactive geography platform built with React Native + Expo + React Native Web. One codebase runs on Android, iOS, desktop browsers and classroom smartboards. No accounts, no ads, no paid features.

## What's here today

| Map   | Regions | Diagram modes | Filters |
|-------|---------|---------------|---------|
| India | 28 states + 8 union territories (726 districts) | Outline, Inline (district boundaries) | — |
| World | ~186 countries | Outline | Continent (the map zooms to the chosen continent) |

**How a round works:** a random shape appears. The student identifies it and drags it to its correct position on the map. Wrong drops bounce back; after two misses the correct area is highlighted, after three it is revealed. "Show name" turns the challenge into a learning mode.

**Two layouts, same game**
- *Phone* (narrow screens): map on top, shape tray at the bottom.
- *Board* (≥1000 px wide, or landscape tablets): large map with a side panel, larger type that scales with screen width, and a full-screen button on the web.

## Run it

Requires **Node.js 22.13+** (Expo SDK 58).

```bash
npm install
npm run web        # browser / smartboard
npm run android    # Android (Expo Go or emulator)
npm run ios        # iOS (macOS required, or Expo Go)
```

## Project layout

```
src/app/              Expo Router screens (index = map picker, play/[map] = game)
src/components/       MapCanvas (base map), RegionShape (draggable piece), ui
src/data/maps.ts      Map registry — add new maps here
src/data/generated/   Pre-projected SVG path data (built by the script below)
src/lib/game.ts       Question generation and drop checking
scripts/build-maps.mjs  Converts raw GIS data → compact SVG paths
data-sources/         Raw map data
```

Maps are projected and simplified **at build time**, so the app ships plain SVG path strings (India ≈ 100 KB, World ≈ 230 KB) and needs no GIS library at runtime.

### Rebuilding map data

```bash
curl -L -o data-sources/ne_10m_admin_0_countries_ind.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson
npm run build:maps
```

### Adding a new map

1. Put the source TopoJSON/GeoJSON in `data-sources/`.
2. Add a block to `scripts/build-maps.mjs` that writes `src/data/generated/<id>.json` (regions need `id, name, d, cx, cy, bbox, core, area, playable`; `inner` enables Inline mode).
3. Register it in `src/data/maps.ts`.

## Data sources & licences

- **World:** [Natural Earth](https://www.naturalearthdata.com/) 1:10m Admin 0 countries, *India point-of-view* edition, so India's borders on the world map match the India map. Public domain.
- **India states & districts:** [udit-001/india-maps-data](https://github.com/udit-001/india-maps-data) (2011 census district codes, current 36 states/UTs). That repository does not state a licence. Confirm the terms, or switch to a source with an explicit licence such as [datameet/maps](https://github.com/datameet/maps) (CC BY 4.0), before a public release.

Code: MIT (see `LICENSE`).
