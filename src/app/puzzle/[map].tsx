import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, G, Path, Pattern, Rect } from 'react-native-svg';
import { Celebration, type CelebrationKind } from '../../components/Celebration';
import { GameTopBar, NATIVE, RoundResults, StatPill, gameStyles } from '../../components/GameUI';
import { Looping } from '../../components/Looping';
import { PictureContent, buildPicture, type Picture } from '../../components/PuzzlePicture';
import { Button } from '../../components/ui';
import { INDIA } from '../../data/maps';
import { puzzleScore, shuffle } from '../../lib/game';
import { PUZZLE_SIZES, makeJigsaw, type Jigsaw, type Piece } from '../../lib/jigsaw';
import { saveBest } from '../../lib/progress';
import { playSfx } from '../../lib/sound';
import { colors, fonts, rate, useLayoutMode } from '../../theme';

const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

type Slot = { x: number; y: number; rot: number };
type Layout = {
  ready: boolean;
  frame: { x: number; y: number; w: number; h: number };
  scale: number; // px per picture unit
  slotScale: number; // loose pieces sit a little smaller on the table
  slots: Slot[];
};
type Anim = { pos: Animated.ValueXY; rot: Animated.Value; sc: Animated.Value; scNow: number };
type Handlers = {
  grant: (id: string) => void;
  move: (id: string, dx: number, dy: number) => void;
  release: (id: string, dx: number, dy: number, tap: boolean) => void;
};

export default function PuzzleGame() {
  // India only.
  const map = INDIA;
  const params = useLocalSearchParams<{ mode?: string; count?: string }>();
  const ghost = params.mode !== 'outline'; // faint picture guide on the board (default on)
  const count = PUZZLE_SIZES[Number(params.count)] ? Number(params.count) : 12;
  const { rows, cols } = PUZZLE_SIZES[count];
  const { mode: layoutMode, s } = useLayoutMode();
  const board = layoutMode === 'board';

  const pic = useMemo(() => buildPicture(map.data), [map]);
  const [round, setRound] = useState(0);
  const jig = useMemo(() => makeJigsaw(pic.width, pic.height, rows, cols, Date.now() + round), [pic, rows, cols, round]);
  const order = useMemo(() => shuffle(jig.pieces.map((p) => p.id)), [jig]);
  const byId = useMemo(() => new Map(jig.pieces.map((p) => [p.id, p])), [jig]);

  // ---- table layout ------------------------------------------------------------
  const [table, setTable] = useState({ w: 0, h: 0 });
  const onTableLayout = (e: LayoutChangeEvent) => setTable({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const L: Layout = useMemo(() => computeLayout(table.w, table.h, jig, board), [table, jig, board]);

  // ---- game state --------------------------------------------------------------
  const [placed, setPlaced] = useState<Record<string, number>>({}); // id -> misses before placing
  const [slotPieces, setSlotPieces] = useState<(string | null)[]>([]);
  const [misses, setMisses] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [top, setTop] = useState<string | null>(null);
  const [hintId, setHintId] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [peeks, setPeeks] = useState(0);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'miss' } | null>(null);
  const [party, setParty] = useState<{ kind: CelebrationKind; origin: { x: number; y: number }; caption: string; n: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [newBest, setNewBest] = useState(false);

  const total = jig.pieces.length;
  const placedCount = Object.keys(placed).length;
  const finished = placedCount >= total;
  const onTable = slotPieces.filter(Boolean).length;
  const inBox = total - placedCount - onTable;

  // deal pieces from the box into free table slots
  useEffect(() => {
    if (!L.ready) return;
    setSlotPieces((cur) => {
      const next = L.slots.map((_, i) => cur[i] ?? null);
      const used = new Set([...next.filter(Boolean), ...Object.keys(placed)] as string[]);
      const queue = order.filter((id) => !used.has(id));
      for (let i = 0; i < next.length; i++) if (!next[i] && queue.length) next[i] = queue.shift()!;
      return next.length === cur.length && next.every((v, i) => v === cur[i]) ? cur : next;
    });
  }, [L, order, placed]);

  // timer
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [finished, round]);

  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(null), party.kind === 'perfect' ? 3400 : 1100);
    return () => clearTimeout(t);
  }, [party]);
  useEffect(() => {
    if (!hintId) return;
    const t = setTimeout(() => setHintId(null), 2600);
    return () => clearTimeout(t);
  }, [hintId]);

  const scores = jig.pieces.filter((p) => placed[p.id] !== undefined).map((p) => puzzleScore(placed[p.id]));
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const stars = scores.reduce((n, v) => n + rate(v).stars, 0);
  const points = Math.max(0, scores.reduce((a, b) => a + b, 0) + Math.max(0, 300 - seconds) - hints * 20 - peeks * 10);
  const mistakes = Object.values(misses).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (!finished || !total) return;
    playSfx('complete');
    setTimeout(() => playSfx('perfect'), 650);
    saveBest('puzzle-india', ghost ? 'inline' : 'outline', String(count), average).then(setNewBest);
    setParty({ kind: 'perfect', origin: { x: table.w / 2, y: table.h / 2 }, caption: 'You built India!', n: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // ---- per-piece animation values (position, rotation, scale) -----------------
  const anim = useRef(new Map<string, Anim>()).current;
  const getAnim = (id: string) => {
    let a = anim.get(id);
    if (!a) {
      const created: Anim = { pos: new Animated.ValueXY({ x: 0, y: 0 }), rot: new Animated.Value(0), sc: new Animated.Value(0), scNow: 0 };
      created.sc.addListener(({ value }) => (created.scNow = value));
      anim.set(id, created);
      a = created;
    }
    return a;
  };
  const slotOf = (id: string) => slotPieces.indexOf(id);
  const target = (p: Piece) => ({ x: L.frame.x + (p.x + p.w / 2) * L.scale, y: L.frame.y + (p.y + p.h / 2) * L.scale });

  // put each table piece on its slot (and pop new ones out of the box)
  useEffect(() => {
    if (!L.ready) return;
    slotPieces.forEach((id, i) => {
      if (!id) return;
      const a = getAnim(id);
      const slot = L.slots[i];
      if (a.scNow === 0) {
        a.pos.setValue({ x: slot.x, y: slot.y - 40 });
        a.rot.setValue(slot.rot * 2);
      }
      Animated.parallel([
        Animated.spring(a.pos, { toValue: { x: slot.x, y: slot.y }, useNativeDriver: false, friction: 6, tension: 60 }),
        Animated.spring(a.rot, { toValue: slot.rot, useNativeDriver: false, friction: 5 }),
        Animated.spring(a.sc, { toValue: L.slotScale, useNativeDriver: false, friction: 6 }),
      ]).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotPieces, L]);

  const backToSlot = (id: string) => {
    const i = slotOf(id);
    const a = getAnim(id);
    if (i < 0) return;
    const slot = L.slots[i];
    Animated.parallel([
      Animated.spring(a.pos, { toValue: { x: slot.x, y: slot.y }, useNativeDriver: false, friction: 7, tension: 70 }),
      Animated.spring(a.rot, { toValue: slot.rot, useNativeDriver: false }),
      Animated.spring(a.sc, { toValue: L.slotScale, useNativeDriver: false }),
    ]).start();
  };

  const place = (id: string) => {
    const p = byId.get(id)!;
    const a = getAnim(id);
    const t = target(p);
    playSfx('snap');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelected(null);
    setHintId(null);
    // a quick, decisive snap (a spring here takes ~0.6 s to settle and feels laggy)
    const snap = { duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: false };
    Animated.parallel([
      Animated.timing(a.pos, { toValue: t, ...snap }),
      Animated.timing(a.rot, { toValue: 0, ...snap }),
      Animated.timing(a.sc, { toValue: 1, ...snap }),
    ]).start(() => {
      setPlaced((pl) => ({ ...pl, [id]: misses[id] ?? 0 }));
      setSlotPieces((sp) => sp.map((x) => (x === id ? null : x)));
      setParty({ kind: 'sparkle', origin: t, caption: '', n: Date.now() });
    });
    setMessage({ text: 'Perfect fit!', tone: 'ok' });
  };

  const miss = (id: string) => {
    setMisses((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
    playSfx('wrong');
    setMessage({ text: "That piece doesn't fit there — look at the names and shapes!", tone: 'miss' });
    backToSlot(id);
  };

  // drag callbacks, kept fresh through a ref so each piece's PanResponder is created once
  const dragStart = useRef({ x: 0, y: 0 });
  const handlers = useRef<Handlers>({ grant: () => {}, move: () => {}, release: () => {} });
  handlers.current.grant = (id) => {
    const a = getAnim(id);
    a.pos.stopAnimation((v) => (dragStart.current = v));
    setTop(id);
  };
  handlers.current.move = (id, dx, dy) => {
    const a = getAnim(id);
    if (Math.hypot(dx, dy) > 6 && a.scNow < 1) {
      a.scNow = 1; // only trigger the pick-up once
      playSfx('pickup');
      Animated.parallel([
        Animated.spring(a.sc, { toValue: 1.04, useNativeDriver: false, friction: 6 }),
        Animated.spring(a.rot, { toValue: 0, useNativeDriver: false }),
      ]).start();
    }
    a.pos.setValue({ x: dragStart.current.x + dx, y: dragStart.current.y + dy });
  };
  handlers.current.release = (id, dx, dy, tap) => {
    if (tap) {
      playSfx('tap');
      setSelected((cur) => (cur === id ? null : id));
      return;
    }
    const p = byId.get(id)!;
    const c = { x: dragStart.current.x + dx, y: dragStart.current.y + dy };
    const t = target(p);
    const tol = Math.min(p.w, p.h) * L.scale * 0.32;
    const f = L.frame;
    if (Math.hypot(c.x - t.x, c.y - t.y) <= tol) place(id);
    else if (c.x > f.x && c.x < f.x + f.w && c.y > f.y && c.y < f.y + f.h) miss(id);
    else {
      playSfx('drop');
      backToSlot(id);
    }
  };

  // tap-to-place: tap a piece, then tap its spot on the board
  const onBoardPress = (e: GestureResponderEvent) => {
    if (!selected) return;
    const p = byId.get(selected)!;
    const { locationX, locationY } = e.nativeEvent;
    const col = Math.floor(locationX / (jig.cellW * L.scale));
    const row = Math.floor(locationY / (jig.cellH * L.scale));
    if (row === p.row && col === p.col) place(p.id);
    else miss(p.id);
  };

  // peek at the finished picture
  const peek = useRef(new Animated.Value(0)).current;
  const doPeek = () => {
    playSfx('tap');
    setPeeks((n) => n + 1);
    Animated.sequence([
      Animated.timing(peek, { toValue: 1, duration: 220, useNativeDriver: NATIVE }),
      Animated.delay(1800),
      Animated.timing(peek, { toValue: 0, duration: 400, useNativeDriver: NATIVE }),
    ]).start();
  };
  const hint = () => {
    const id = selected ?? slotPieces.find(Boolean);
    if (!id) return;
    playSfx('tap');
    setHints((h) => h + 1);
    setHintId(id);
    setSelected(id);
    const a = getAnim(id);
    Animated.sequence([
      Animated.timing(a.rot, { toValue: 8, duration: 90, useNativeDriver: false }),
      Animated.timing(a.rot, { toValue: -8, duration: 120, useNativeDriver: false }),
      Animated.spring(a.rot, { toValue: L.slots[slotOf(id)]?.rot ?? 0, useNativeDriver: false }),
    ]).start();
    setMessage({ text: 'The glowing spot is where the wiggling piece goes.', tone: 'ok' });
  };

  const restart = () => {
    anim.forEach((a) => a.sc.removeAllListeners());
    anim.clear();
    setRound((x) => x + 1);
    setPlaced({});
    setSlotPieces([]);
    setMisses({});
    setSelected(null);
    setHints(0);
    setPeeks(0);
    setMessage(null);
    setSeconds(0);
    setParty(null);
    setNewBest(false);
  };

  const hintPiece = hintId ? byId.get(hintId) : undefined;
  const loose = slotPieces.filter((x): x is string => !!x);
  // the piece being moved is drawn last so it floats above the others
  const drawOrder = [...loose.filter((id) => id !== top), ...loose.filter((id) => id === top)];

  return (
    <SafeAreaView style={gameStyles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View style={gameStyles.root}>
        <GameTopBar
          s={s}
          board={board}
          title="Jigsaw · India"
          subtitle={`${total} pieces`}
          done={placedCount}
          total={total}
          stars={stars}
          extra={
            <>
              <StatPill s={s}>{fmtTime(seconds)}</StatPill>
              <StatPill s={s}>
                {mistakes} {mistakes === 1 ? 'miss' : 'misses'}
              </StatPill>
            </>
          }
        />
        <View style={[styles.tableWrap, { marginHorizontal: board ? s(16) : 10, borderRadius: board ? s(28) : 22 }]} onLayout={onTableLayout}>
          <WoodTable />
          {L.ready && (
            <>
              {/* the cardboard tray the picture goes into */}
              <View style={[styles.tray, { left: L.frame.x - 8, top: L.frame.y - 8, width: L.frame.w + 16, height: L.frame.h + 16, borderRadius: 16 }]} />
              <View style={{ position: 'absolute', left: L.frame.x, top: L.frame.y, width: L.frame.w, height: L.frame.h }}>
                <BoardPicture pic={pic} jig={jig} scale={L.scale} placed={placed} ghost={ghost} finished={finished} />
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: peek }]}>
                  <Svg width={L.frame.w} height={L.frame.h} viewBox={`0 0 ${pic.width} ${pic.height}`}>
                    <PictureContent pic={pic} />
                  </Svg>
                </Animated.View>
                {hintPiece && <HintGlow piece={hintPiece} pic={pic} scale={L.scale} />}
                {selected && (
                  <Pressable
                    accessibilityLabel="Place the selected piece here"
                    onPress={onBoardPress}
                    style={[StyleSheet.absoluteFill, Platform.OS === 'web' && ({ cursor: 'crosshair' } as object)]}
                  />
                )}
              </View>

              {drawOrder.map((id) => (
                <LoosePiece key={id} piece={byId.get(id)!} jig={jig} pic={pic} scale={L.scale} a={getAnim(id)} selected={selected === id} handlers={handlers} />
              ))}
            </>
          )}
          {party && table.w > 0 && (
            <Celebration key={party.n} kind={party.kind} origin={party.origin} width={table.w} height={table.h} caption={party.caption} trigger={party.n} />
          )}
          {finished && (
            <View style={styles.resultsOverlay}>
              <RoundResults
                s={s}
                board={board}
                scores={scores}
                names={[]}
                points={points}
                stars={stars}
                newBest={newBest}
                headline={{ label: 'Time', value: fmtTime(seconds), color: colors.ink }}
                hideBreakdown
                onAgain={restart}
                onHome={() => router.replace('/')}
              />
            </View>
          )}
        </View>

        {/* controls */}
        <View style={[styles.controls, { paddingHorizontal: board ? s(16) : 10, gap: s(10) }]}>
          <View style={[styles.box, { paddingHorizontal: s(12), paddingVertical: s(6), borderRadius: s(14) }]}>
            <BoxIcon size={s(24)} />
            <Text style={{ fontFamily: fonts.black, color: colors.ink, fontSize: s(14) }}>{inBox} in box</Text>
          </View>
          <Text numberOfLines={2} style={[styles.message, { fontSize: s(13), color: message?.tone === 'miss' ? '#B7413A' : colors.inkSoft }]}>
            {message?.text ?? (selected ? 'Now tap where that piece goes on the board.' : 'Drag a piece onto the board — or tap it, then tap its spot.')}
          </Text>
          {!finished && <Button label="Peek" variant="soft" size={s(14)} onPress={doPeek} />}
          {!finished && <Button label="Hint" variant="sun" size={s(14)} onPress={hint} />}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---- layout ----------------------------------------------------------------------

function computeLayout(tw: number, th: number, jig: Jigsaw, board: boolean): Layout {
  const empty: Layout = { ready: false, frame: { x: 0, y: 0, w: 0, h: 0 }, scale: 1, slotScale: 1, slots: [] };
  if (tw < 50 || th < 50) return empty;
  const pad = board ? 24 : 14;
  const picW = jig.cellW * jig.cols;
  const picH = jig.cellH * jig.rows;
  const aspect = picW / picH;
  let fw: number;
  let fh: number;
  if (board) {
    fh = th - pad * 2;
    fw = fh * aspect;
    if (fw > tw * 0.58) {
      fw = tw * 0.58;
      fh = fw / aspect;
    }
  } else {
    fw = tw - pad * 2;
    fh = fw / aspect;
    if (fh > th * 0.6) {
      fh = th * 0.6;
      fw = fh * aspect;
    }
  }
  const frame = board ? { x: pad + 8, y: (th - fh) / 2, w: fw, h: fh } : { x: (tw - fw) / 2, y: pad, w: fw, h: fh };
  // the free table area where loose pieces wait
  const area = board
    ? { x0: frame.x + fw + pad * 1.5, y0: pad, x1: tw - pad, y1: th - pad }
    : { x0: pad, y0: frame.y + fh + pad, x1: tw - pad, y1: th - pad };
  const scale = fw / picW;
  const pw = (jig.cellW + jig.margin * 2) * scale;
  const ph = (jig.cellH + jig.margin * 2) * scale;
  // choose the grid that lets waiting pieces be as big as possible while fitting at least `want`
  const want = board ? 6 : 3;
  const aw = area.x1 - area.x0;
  const ah = area.y1 - area.y0;
  let best = { gcols: 1, grows: want, k: 0 };
  for (let gc = 1; gc <= want; gc++) {
    const gr = Math.ceil(want / gc);
    const kk = Math.min(1, aw / gc / pw, ah / gr / ph) * 0.9;
    if (kk > best.k) best = { gcols: gc, grows: gr, k: kk };
  }
  // if there is spare room, add more slots at the same size
  const gcols = Math.max(best.gcols, Math.floor(aw / (pw * best.k * 1.02)));
  const grows = Math.max(best.grows, Math.floor(ah / (ph * best.k * 1.02)));
  const k = Math.max(0.3, best.k);
  const n = Math.min(gcols * grows, 10);
  const cw = aw / gcols;
  const ch = ah / grows;
  const jitter = (seed: number) => {
    const v = Math.sin(seed * 12.9898) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  };
  const slots: Slot[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % gcols;
    const r = Math.floor(i / gcols);
    slots.push({
      x: area.x0 + cw * (c + 0.5) + jitter(i + 1) * cw * 0.08,
      y: area.y0 + ch * (r + 0.5) + jitter(i + 7) * ch * 0.08,
      rot: jitter(i + 3) * 10,
    });
  }
  return { ready: true, frame, scale, slotScale: k, slots };
}

// ---- drawing ---------------------------------------------------------------------

function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Warm wooden tabletop with a soft grain. */
const WoodTable = memo(function WoodTable() {
  const id = useSvgId('wood');
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#E6BE87' }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width="420" height="120" patternUnits="userSpaceOnUse">
            <Path d="M0 20 C 100 12, 220 30, 420 18" stroke="#D9AC70" strokeWidth={2} fill="none" opacity={0.7} />
            <Path d="M0 58 C 140 66, 260 48, 420 60" stroke="#DDB377" strokeWidth={1.5} fill="none" opacity={0.7} />
            <Path d="M0 96 C 120 90, 300 104, 420 94" stroke="#D6A86B" strokeWidth={2} fill="none" opacity={0.6} />
            <Path d="M180 70 c 12 -8 28 -8 40 0 c -12 8 -28 8 -40 0z" fill="none" stroke="#CF9F62" strokeWidth={1.5} opacity={0.6} />
            <Rect x="0" y="118" width="420" height="2" fill="#D4A468" opacity={0.5} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
});

/** Placed pieces (the picture clipped to their shapes), the faint guide and the seams. */
const BoardPicture = memo(function BoardPicture({
  pic,
  jig,
  scale,
  placed,
  ghost,
  finished,
}: {
  pic: Picture;
  jig: Jigsaw;
  scale: number;
  placed: Record<string, number>;
  ghost: boolean;
  finished: boolean;
}) {
  const clip = useSvgId('placed');
  const shown = jig.pieces.filter((p) => placed[p.id] !== undefined);
  return (
    <Svg width={pic.width * scale} height={pic.height * scale} viewBox={`0 0 ${pic.width} ${pic.height}`}>
      <Defs>
        <ClipPath id={clip}>
          {shown.map((p) => (
            <Path key={p.id} d={p.path} />
          ))}
        </ClipPath>
      </Defs>
      <Rect x={0} y={0} width={pic.width} height={pic.height} fill="#F3E4CB" />
      {ghost && (
        <G opacity={0.22}>
          <PictureContent pic={pic} labels={false} />
        </G>
      )}
      {/* empty spots: faint cut lines so students can see the shapes to fill */}
      {jig.pieces.map((p) =>
        placed[p.id] === undefined ? (
          <Path key={p.id} d={p.path} fill="none" stroke="#C9AE86" strokeWidth={1.6 / scale} strokeDasharray={`${5 / scale} ${4 / scale}`} />
        ) : null,
      )}
      {shown.length > 0 && (
        <G clipPath={`url(#${clip})`}>
          <PictureContent pic={pic} />
        </G>
      )}
      {!finished && shown.map((p) => <Path key={`s-${p.id}`} d={p.path} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={1.2 / scale} />)}
    </Svg>
  );
});

/** One loose cardboard piece: picture clipped to the knobbed outline, with thickness and shadow. */
const PieceSvg = memo(function PieceSvg({ piece, jig, pic, scale, selected }: { piece: Piece; jig: Jigsaw; pic: Picture; scale: number; selected: boolean }) {
  const clip = useSvgId('pc');
  const m = jig.margin;
  const box = { x: piece.x - m, y: piece.y - m, w: piece.w + 2 * m, h: piece.h + 2 * m };
  const px = (n: number) => n / scale;
  return (
    <Svg width={box.w * scale} height={box.h * scale} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}>
      <Defs>
        <ClipPath id={clip}>
          <Path d={piece.path} />
        </ClipPath>
      </Defs>
      {/* shadow and cardboard edge */}
      <Path d={piece.path} transform={`translate(${px(4)} ${px(8)})`} fill="rgba(70,40,10,0.28)" />
      <Path d={piece.path} transform={`translate(0 ${px(3.5)})`} fill="#C9A877" />
      <G clipPath={`url(#${clip})`}>
        <PictureContent pic={pic} box={box} />
      </G>
      <Path d={piece.path} fill="none" stroke={selected ? colors.primary : 'rgba(255,255,255,0.85)'} strokeWidth={px(selected ? 3.5 : 1.6)} strokeLinejoin="round" />
    </Svg>
  );
});

function LoosePiece({
  piece,
  jig,
  pic,
  scale,
  a,
  selected,
  handlers,
}: {
  piece: Piece;
  jig: Jigsaw;
  pic: Picture;
  scale: number;
  a: Anim;
  selected: boolean;
  handlers: React.MutableRefObject<Handlers>;
}) {
  const w = (piece.w + jig.margin * 2) * scale;
  const h = (piece.h + jig.margin * 2) * scale;
  const moved = useRef(false);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          moved.current = false;
          handlers.current.grant(piece.id);
        },
        onPanResponderMove: (_e, g) => {
          if (Math.hypot(g.dx, g.dy) > 6) moved.current = true;
          handlers.current.move(piece.id, g.dx, g.dy);
        },
        onPanResponderRelease: (_e, g) => handlers.current.release(piece.id, g.dx, g.dy, !moved.current),
        onPanResponderTerminate: (_e, g) => handlers.current.release(piece.id, g.dx, g.dy, !moved.current),
      }),
    [piece.id, handlers],
  );
  return (
    <Animated.View
      {...responder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={`Jigsaw piece row ${piece.row + 1}, column ${piece.col + 1}`}
      style={[
        { position: 'absolute', left: 0, top: 0, width: w, height: h },
        {
          transform: [
            { translateX: Animated.subtract(a.pos.x, w / 2) },
            { translateY: Animated.subtract(a.pos.y, h / 2) },
            { rotate: a.rot.interpolate({ inputRange: [-360, 360], outputRange: ['-360deg', '360deg'] }) },
            { scale: a.sc },
          ],
        },
        Platform.OS === 'web' && ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object),
      ]}
    >
      <View pointerEvents="none">
        <PieceSvg piece={piece} jig={jig} pic={pic} scale={scale} selected={selected} />
      </View>
    </Animated.View>
  );
}

/** Blinking outline on the board showing where a piece belongs (GPU loop). */
function HintGlow({ piece, pic, scale }: { piece: Piece; pic: Picture; scale: number }) {
  return (
    <Looping pointerEvents="none" style={StyleSheet.absoluteFill} from={{ opacity: 1 }} to={{ opacity: 0.25 }} duration={450} smooth alternate>
      <Svg width={pic.width * scale} height={pic.height * scale} viewBox={`0 0 ${pic.width} ${pic.height}`}>
        <Path d={piece.path} fill="rgba(255,200,61,0.45)" stroke={colors.sun} strokeWidth={4 / scale} strokeLinejoin="round" />
      </Svg>
    </Looping>
  );
}

function BoxIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 8l9-4 9 4v9l-9 4-9-4z" fill="#E8C48E" stroke="#B88A4E" strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M3 8l9 4 9-4M12 12v9" fill="none" stroke="#B88A4E" strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M7.5 6l9 4" stroke="#B88A4E" strokeWidth={1.2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  tableWrap: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#F1D6AE',
    borderBottomWidth: 8,
    borderBottomColor: '#B88A4E',
  },
  tray: {
    position: 'absolute',
    backgroundColor: '#F7EBD8',
    borderWidth: 3,
    borderColor: '#E7D2B0',
    borderBottomWidth: 6,
    borderBottomColor: '#CDAE80',
  },
  resultsOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(34,24,74,0.25)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  controls: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    borderBottomWidth: 4,
    borderBottomColor: colors.surfaceLip,
  },
  message: { flex: 1, fontFamily: fonts.bodyBold, lineHeight: 18 },
});
