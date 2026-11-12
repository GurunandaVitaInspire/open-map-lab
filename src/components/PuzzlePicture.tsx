import { memo } from 'react';
import { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { MapData, Region } from '../data/maps';
import { colors, fonts } from '../theme';

/** Bright, toy-like state colours (top face, extruded side), like a printed kids' map. */
const PALETTE = [
  { fill: '#FF9C8F', side: '#E36F63' },
  { fill: '#FFD966', side: '#E0B000' },
  { fill: '#8FE0AE', side: '#46B276' },
  { fill: '#8DCBFF', side: '#4694DA' },
  { fill: '#C3AEFF', side: '#8E73EA' },
  { fill: '#FFBE85', side: '#E58A3F' },
  { fill: '#7FE0DA', side: '#35ADA6' },
];

type Label = { lines: string[]; x: number; y: number; fs: number; leader?: [number, number] };
export type Picture = {
  width: number;
  height: number;
  states: { r: Region; fill: string; side: string }[];
  labels: Label[];
};

// Small states get their name just outside, with a leader line, like a printed map.
const OUTSIDE: Record<string, [number, number]> = {
  goa: [128, 838],
  sikkim: [690, 350],
  tripura: [735, 585],
  mizoram: [868, 612],
  manipur: [945, 505],
  nagaland: [950, 440],
  kerala: [232, 1010],
  'andaman-and-nicobar-islands': [760, 1015],
};
const SKIP = new Set(['chandigarh', 'puducherry', 'lakshadweep', 'dadra-and-nagar-haveli-and-daman-and-diu', 'delhi']);

function wrap(name: string, max = 10) {
  const words = name.replace(/ and /g, ' & ').split(' ');
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + w).length <= max) lines[lines.length - 1] = last + ' ' + w;
    else lines.push(w);
  }
  return lines;
}

/** Build the labelled, coloured map once per map data. */
export function buildPicture(data: MapData): Picture {
  // greedy colouring so neighbouring states never share a colour
  const color: Record<string, number> = {};
  for (const r of [...data.regions].sort((a, b) => b.area - a.area)) {
    const used = new Set((r.neighbors ?? []).map((n) => color[n]).filter((c) => c !== undefined));
    let c = 0;
    while (used.has(c)) c++;
    color[r.id] = c % PALETTE.length;
  }
  const states = data.regions.map((r) => ({ r, ...PALETTE[color[r.id]] }));
  const labels: Label[] = [];
  for (const r of data.regions) {
    if (SKIP.has(r.id)) continue;
    const fs = Math.max(15, Math.min(28, Math.sqrt(r.area) * 0.12));
    const out = OUTSIDE[r.id];
    labels.push({
      lines: wrap(r.name),
      x: out ? out[0] : r.cx,
      y: out ? out[1] : r.cy,
      fs: out ? 15 : fs,
      leader: out ? [r.cx, r.cy] : undefined,
    });
  }
  return { width: data.width, height: data.height, states, labels };
}

type Box = { x: number; y: number; w: number; h: number };
const hits = (a: Box, b: [number, number, number, number]) => b[0] < a.x + a.w && b[2] > a.x && b[1] < a.y + a.h && b[3] > a.y;

/**
 * Draws the part of the picture inside `box` (everything else is skipped, so each jigsaw piece
 * only renders the few states it actually shows).
 */
export const PictureContent = memo(function PictureContent({ pic, box, labels = true }: { pic: Picture; box?: Box; labels?: boolean }) {
  const b = box ?? { x: 0, y: 0, w: pic.width, h: pic.height };
  const depth = 7;
  const visible = pic.states.filter((s) => hits(b, s.r.bbox));
  const ink = colors.ink;
  const font = fonts.black;
  return (
    <G>
      {/* sea */}
      <Rect x={b.x - 2} y={b.y - 2} width={b.w + 4} height={b.h + 4} fill="#BFE7F8" />
      <SeaWaves box={b} />
      {/* land slab: side, then coloured states */}
      <G transform={`translate(0 ${depth})`}>
        {visible.map((s) => (
          <Path key={s.r.id} d={s.r.d} fill="#C99B5E" stroke="#C99B5E" strokeWidth={2} />
        ))}
      </G>
      {visible.map((s) => (
        <Path key={s.r.id} d={s.r.d} fill={s.fill} stroke="#FFFFFF" strokeWidth={2.2} strokeLinejoin="round" />
      ))}
      {/* New Delhi capital star */}
      {hits(b, [300, 335, 345, 365]) && (
        <G>
          <Path d="M311.9 340 l3 6.2 6.8 1 -4.9 4.7 1.2 6.7 -6.1 -3.2 -6.1 3.2 1.2 -6.7 -4.9 -4.7 6.8 -1z" fill="#E53935" stroke="#fff" strokeWidth={1.4} />
          <SvgText x={326} y={360} fontSize={13} fontFamily={font} fill={ink} stroke="#fff" strokeWidth={3} strokeLinejoin="round">
            New Delhi
          </SvgText>
          <SvgText x={326} y={360} fontSize={13} fontFamily={font} fill={ink}>
            New Delhi
          </SvgText>
        </G>
      )}
      {labels &&
        pic.labels.map((l, i) => {
          const lh = l.fs * 1.05;
          const top = l.y - ((l.lines.length - 1) * lh) / 2 + l.fs * 0.35;
          const halfW = (Math.max(...l.lines.map((x) => x.length)) * l.fs * 0.32) + 4;
          if (!hits(b, [l.x - halfW, top - l.fs, l.x + halfW, top + l.lines.length * lh])) {
            if (!l.leader || !hits(b, [Math.min(l.x, l.leader[0]), Math.min(l.y, l.leader[1]), Math.max(l.x, l.leader[0]), Math.max(l.y, l.leader[1])])) return null;
          }
          return (
            <G key={i}>
              {l.leader && <Line x1={l.x} y1={l.y} x2={l.leader[0]} y2={l.leader[1]} stroke={ink} strokeWidth={1.3} strokeDasharray="3 3" />}
              {l.leader && <Circle cx={l.leader[0]} cy={l.leader[1]} r={2.6} fill={ink} />}
              {l.lines.map((t, j) => (
                <G key={j}>
                  <SvgText x={l.x} y={top + j * lh} fontSize={l.fs} fontFamily={font} textAnchor="middle" fill="#fff" stroke="#fff" strokeWidth={l.fs * 0.28} strokeLinejoin="round">
                    {t}
                  </SvgText>
                  <SvgText x={l.x} y={top + j * lh} fontSize={l.fs} fontFamily={font} textAnchor="middle" fill={ink}>
                    {t}
                  </SvgText>
                </G>
              ))}
            </G>
          );
        })}
      {/* sea names, title box and compass so ocean pieces have something on them too */}
      {hits(b, [20, 845, 180, 930]) && <SeaName x={95} y={875} lines={['ARABIAN', 'SEA']} />}
      {hits(b, [600, 745, 790, 820]) && <SeaName x={695} y={772} lines={['BAY OF', 'BENGAL']} />}
      {hits(b, [450, 1075, 680, 1125]) && <SeaName x={565} y={1102} lines={['INDIAN OCEAN']} />}
      {hits(b, [640, 40, 970, 150]) && (
        <G>
          <Rect x={648} y={46} width={318} height={98} rx={18} fill="#FFFFFF" stroke={colors.primary} strokeWidth={4} />
          <SvgText x={807} y={102} fontSize={46} fontFamily={fonts.display} textAnchor="middle" fill={colors.primary}>
            INDIA
          </SvgText>
          <SvgText x={807} y={128} fontSize={16} fontFamily={font} textAnchor="middle" fill={colors.inkSoft}>
            States & Union Territories
          </SvgText>
        </G>
      )}
      {hits(b, [860, 190, 950, 280]) && (
        <G>
          <Circle cx={905} cy={238} r={36} fill="#FFFFFF" stroke="#E2D8FF" strokeWidth={3} />
          <Path d="M905 206 l9 32 h-18z" fill={colors.coral} />
          <Path d="M905 270 l-9 -32 h18z" fill={colors.inkSoft} />
          <SvgText x={905} y={201} fontSize={14} fontFamily={font} textAnchor="middle" fill={ink}>
            N
          </SvgText>
        </G>
      )}
    </G>
  );
});

function SeaName({ x, y, lines }: { x: number; y: number; lines: string[] }) {
  return (
    <G>
      {lines.map((t, i) => (
        <SvgText key={i} x={x} y={y + i * 28} fontSize={22} fontFamily={fonts.black} textAnchor="middle" fill="#4C8FB8" letterSpacing={4} opacity={0.85}>
          {t}
        </SvgText>
      ))}
    </G>
  );
}

/** Small printed wave marks on the sea (static: they are part of the picture). */
function SeaWaves({ box }: { box: Box }) {
  const marks: [number, number][] = [];
  const step = 90;
  for (let y = Math.floor(box.y / 60) * 60 + 30; y < box.y + box.h; y += 60) {
    for (let x = Math.floor(box.x / step) * step + ((y / 60) % 2 ? 45 : 0); x < box.x + box.w; x += step) marks.push([x, y]);
  }
  return (
    <G opacity={0.7}>
      {marks.map(([x, y], i) => (
        <Path key={i} d={`M${x} ${y} q 6 -7 12 0 t 12 0`} fill="none" stroke="#E2F5FD" strokeWidth={2.5} strokeLinecap="round" />
      ))}
    </G>
  );
}
