# Open Map Lab

**Making Education Interactive, Accessible, and Free for Everyone.**

An open-source, completely free, interactive geography platform built with React Native + Expo + React Native Web. One codebase runs on Android, iOS, desktop browsers and classroom smartboards. No accounts, no ads, no paid features.

## What's here today

| Map   | Regions | Diagram modes | Filters |
|-------|---------|---------------|---------|
| India | 28 states + 8 union territories (726 districts) | Outline, Inline (district boundaries) | — |
| World | ~186 countries | Outline (coastlines), Inline (country borders) | Continent (the map zooms to the chosen continent) |

**How a round works:** each question shows a region's name and shape. The student drags it onto the map and gets an accuracy score: the share of the shape that overlaps its real position, plus the distance in km.

**Game feel:** a 3D map slab on a wave-patterned ocean, chunky pressable buttons, the Baloo 2 and Nunito fonts, stars, streaks and points, and a best score saved on the device (no account).
- 100%: a firework blast from the placed region, a flash, confetti rain and a PERFECT badge (plus a haptic buzz on phones)
- 80–99%: a confetti burst and a GREAT badge
- 50–79%: sparkling stars and a NICE badge
- below 50%: a calm, motivating card with a location tip (e.g. "Kerala is in the south-west of India. You were too far north.")

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
