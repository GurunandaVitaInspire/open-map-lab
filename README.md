# Open Map Lab

**Making Education Interactive, Accessible, and Free for Everyone.**

An open-source, completely free, interactive geography platform built with React Native + Expo + React Native Web. One codebase runs on Android, iOS, desktop browsers and classroom smartboards. No accounts, no ads, no paid features.

## What's here today

Three games, picked from the home screen:

| Game | Maps | How it works |
|------|------|--------------|
| **Place it** | India (36 states/UTs), World (~186 countries, continent zoom) | A state/country name and shape appear; drag it onto the map. Scored by how much of the shape overlaps its real position, plus the distance in km. Outline / Inline modes. |
| **Name it** | India | One state blinks on the map; pick its name from four big buttons. Wrong options are neighbouring states. Retry until right: 1st try = 3 stars, 2nd = 2, 3rd = 1, with hints (where it is, which state it borders) after a miss. |
| **India Jigsaw** | India | A classic knobbed jigsaw cut from a colourful India map with every state's name printed in its middle (plus sea names, a title box and a compass). Pieces come out of a box onto a wooden table a few at a time; drag them onto the board (or tap a piece, then its spot) and they snap in when close. 12 / 20 / 30 pieces, optional faint picture guide, Peek, Hint, timer and misses. |

**Landing page:** a big two-line headline that reveals word by word, game cards hanging from a rope like polaroids (they drop in with a swing, sway gently and kick when tapped), drifting clouds, and a moving sea with layered waves, a bobbing paper boat and a scrolling feature ticker. Tapping a card opens a setup sheet with that game's options. A **pause-motion** button stops all ambient animation (it is also off when the device asks for reduced motion).

**Game feel:** a 3D map slab on a gently moving, wave-patterned ocean, chunky pressable buttons, the Baloo 2 and Nunito fonts, stars, streaks and points, and best scores saved on the device (no account).
- 100% / first try: a firework blast from the region, a flash, confetti rain and a PERFECT badge (plus a haptic buzz on phones)
- 80–99% / second try: a confetti burst and a GREAT badge
- 50–79%: sparkling stars and a NICE badge
- below 50%: a calm, motivating card with a location tip (e.g. "Kerala is in the south-west of India. You were too far north.")

**Sound:** CC0 sound effects for taps, pick-up, drop, snap, correct, wrong and rewards, plus an optional background music loop. Effects are on and music is off by default; both toggles live on the home screen and in the game header on big screens, and are remembered on the device. Credits: [assets/sounds/CREDITS.md](assets/sounds/CREDITS.md).

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

## Deploy the web app (Vercel)

`vercel.json` is already set up: Vercel runs `expo export -p web`, serves the `dist` folder, and sends every path to the single-page app so links like `/play/india` work. In the Vercel project settings, leave **Framework Preset** as *Other* and use Node.js 22 or newer.

### Tip: keep the project out of OneDrive

If the project folder is synced by OneDrive, the bundler can briefly fail to see newly installed packages or new files ("Unable to resolve …") while OneDrive is still processing them. Waiting a moment and restarting with `npx expo start --clear` fixes it; moving the project to a non-synced folder avoids it.

## Project layout

```
src/app/              Expo Router screens (index = landing page, play/ = Place it, quiz/ = Name it, puzzle/ = India Jigsaw)
src/components/       MapCanvas (base map), RegionShape (piece), GameUI (shared header/results), Celebration, ui
src/lib/sound.ts      Sound effects and music (expo-audio)
src/lib/motion.ts     Pause-motion / reduced-motion setting
src/lib/jigsaw.ts     Jigsaw cutter (knobbed piece outlines)
assets/sounds/        CC0 audio (see CREDITS.md)
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
