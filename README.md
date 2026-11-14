# Open Map Lab

**Making Education Interactive, Accessible, and Free for Everyone.**

An open-source, completely free, interactive geography platform built with React Native + Expo + React Native Web. One codebase runs on Android, iOS, desktop browsers and classroom smartboards. No accounts, no ads, no paid features.

## What's here today

Six games, picked from the home screen:

| Game | Maps | How it works |
|------|------|--------------|
| **India Jigsaw** | India | A classic knobbed jigsaw cut from a colourful India map with every state's name printed in its middle (plus sea names, a title box and a compass). Pieces come out of a box onto a wooden table a few at a time; drag them onto the board (or tap a piece, then its spot) and they snap in when close. 12 / 20 / 30 pieces, optional faint picture guide, Peek, Hint, timer and misses. |
| **Name the State** | India | One state blinks on the map; pick its name from four big buttons. Wrong options are neighbouring states. Retry until right: 1st try = 3 stars, 2nd = 2, 3rd = 1, with hints (where it is, which state it borders) after a miss. |
| **Drag the State** | India (36 states/UTs) | A state's name and shape appear; drag it onto the map. Scored by how much of the shape overlaps its real position, plus the distance in km. Outline / Inline modes. After a miss (or a skip) the real spot glows and the student must drag the state there before moving on: no extra points, just practice. |
| **India Rivers** | India (20 major rivers) | "Draw the Ganga": start at the green dot and draw the river freehand over faint state borders. Scored on how much of the real river the drawing follows and how far it strays, with generous, finger-sized tolerances (roughly right earns points, close to the river earns full marks). The real river is then revealed with the states it flows through. 10 rivers or all 20. |
| **Name the Country** | World (~186 countries, continent zoom) | One country blinks on the world map (tiny countries get a ring); pick its name from four options, mostly its neighbours. Same retry scoring and hints (continent, neighbours) as Name the State. |
| **World Explorer** | World (~186 countries, continent zoom) | Drag countries onto the world map, scored like Drag the State. |

**Landing page:** a realistic morning sky. A compact "Your Map Adventure Starts Now!" headline reveals word by word, then all six game cards hang from two ropes like polaroids (they drop in with a swing, sway gently and kick when tapped). Photo-real clouds drift across the sky at different depths; on wide screens a real **spinning Earth** (NASA Blue Marble with moving clouds, sunlight and a glowing atmosphere) floats in the left margin and real **hot-air balloons** rise and sway on the right. At the bottom, **real sea footage** (a seamless loop, loaded only after the page itself) meets the sky in a hazy horizon, with a scrolling feature ticker. Tapping a card opens a setup sheet with that game's options. A **pause-motion** button stops all ambient animation and the sea video (it is also off when the device asks for reduced motion).

**Drag feel (iOS-style):** pieces lift the instant you touch them, glide from the tray to under your finger while resizing to the map, follow the finger 1:1 (no re-rendering while moving, each piece on its own GPU layer), lean slightly into fast moves, and land with short, critically damped springs: close drops glide into their exact spot, misses settle where they fell, and pieces dropped off the map fly back to the tray. Light haptics on phones. See `src/lib/feel.ts`.

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

While OneDrive is still syncing a newly created file, Node reports it as a symbolic link, and the bundler (Metro) skips symbolic links, so you get "Unable to resolve …" for brand-new files or freshly installed packages. It fixes itself once OneDrive finishes (restart with `npx expo start --clear`); moving the project to a non-synced folder avoids it entirely.

## Performance notes

- **Fonts** are subset to the Latin characters the app uses (`assets/fonts`, OFL-licensed): ~65 KB of WOFF2 on the web instead of ~1.2 MB.
- **The world map** (~400 KB) is a separate chunk that only downloads when a world game is opened (`loadMap` / `useMap` in `src/data/maps.ts`); the landing card uses a 37 KB simplified copy.
- **Ambient animation** (sea, waves, clouds, swaying cards, blinking, confetti) runs as CSS keyframes on the web via `src/components/Looping.tsx` and `src/lib/cssAnim.ts`, so it costs no JavaScript per frame and never competes with dragging. Native apps use the native animation driver.
- **Maps** draw the 3D slab once per round; answering only redraws the small "answered" layer.
- **Caching:** hashed JS and asset files are served with a one-year immutable cache (`vercel.json`).

## Project layout

```
src/app/              Expo Router screens (index = landing page, play/ = Drag the State + World Explorer,
                      quiz/ = Name the State + Name the Country, puzzle/ = India Jigsaw, rivers/ = India Rivers)
src/components/       MapCanvas (base map), RegionShape (piece), GameUI (shared header/results), Celebration, ui
src/lib/sound.ts      Sound effects and music (expo-audio)
src/lib/motion.ts     Pause-motion / reduced-motion setting
src/lib/feel.ts       Shared drag physics (springs, lean, haptics, GPU layers)
src/components/home/  Landing page pieces: HangingCards, Sky (clouds, balloons), Globe, RealSea
assets/scene/         Landing imagery: Earth, clouds, balloon (public domain / CC0, see CREDITS.md)
public/scene/         Sea video loop (WebM + MP4) served as static files on the web
src/components/Looping.tsx  GPU-friendly looping animation (CSS on web, native driver on apps)
assets/fonts/         Subset Baloo 2 and Nunito fonts (OFL)
src/lib/jigsaw.ts     Jigsaw cutter (knobbed piece outlines)
assets/sounds/        CC0 audio (see CREDITS.md)
src/data/maps.ts      Map registry — add new maps here
src/data/generated/   Pre-projected SVG path data (built by the script below)
src/lib/game.ts       Question generation and drop checking
src/lib/rivers.ts     River data and freehand-drawing score
scripts/build-maps.mjs  Converts raw GIS data → compact SVG paths
data-sources/         Raw map data
```

Maps are projected and simplified **at build time**, so the app ships plain SVG path strings (India ≈ 100 KB, World ≈ 230 KB) and needs no GIS library at runtime.

### Rebuilding map data

```bash
curl -L -o data-sources/ne_10m_admin_0_countries_ind.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson
curl -L -o data-sources/ne_10m_rivers_lake_centerlines.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson
npm run build:maps
```

### Adding a new map

1. Put the source TopoJSON/GeoJSON in `data-sources/`.
2. Add a block to `scripts/build-maps.mjs` that writes `src/data/generated/<id>.json` (regions need `id, name, d, cx, cy, bbox, core, area, playable`; `inner` enables Inline mode).
3. Register it in `src/data/maps.ts`.

## Data sources & licences

- **Landing-page scene:** NASA Blue Marble Earth (public domain), Natural Earth III clouds (public domain), and CC0 sea footage, clouds and balloon from Wikimedia Commons and OpenGameArt. Details: [assets/scene/CREDITS.md](assets/scene/CREDITS.md).

- **World:** [Natural Earth](https://www.naturalearthdata.com/) 1:10m Admin 0 countries, *India point-of-view* edition, so India's borders on the world map match the India map. Public domain.
- **Rivers:** Natural Earth 1:10m rivers and lake centrelines, clipped to India (`src/data/generated/india-rivers.json`). Public domain. The 7 MB raw file is not committed; download it with the command above.
- **India states & districts:** [udit-001/india-maps-data](https://github.com/udit-001/india-maps-data) (2011 census district codes, current 36 states/UTs). That repository does not state a licence. Confirm the terms, or switch to a source with an explicit licence such as [datameet/maps](https://github.com/datameet/maps) (CC BY 4.0), before a public release.

Code: MIT (see `LICENSE`).
