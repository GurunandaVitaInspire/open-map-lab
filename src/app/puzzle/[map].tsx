import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OceanBackdrop } from '../../components/Backdrops';
import { Celebration, type CelebrationKind } from '../../components/Celebration';
import { GameTopBar, NATIVE, RoundResults, StatPill, gameStyles } from '../../components/GameUI';
import { CompassRose } from '../../components/icons';
import { MapCanvas } from '../../components/MapCanvas';
import { RegionHighlight } from '../../components/RegionHighlight';
import { RegionShape, fitScale } from '../../components/RegionShape';
import { useMapFrame } from '../../components/useMapFrame';
import { Button, Card, Label } from '../../components/ui';
import { MAPS, getView, type Region } from '../../data/maps';
import { PUZZLE_MIN_AREA, puzzleScore, shuffle, type DiagramMode } from '../../lib/game';
import { saveBest } from '../../lib/progress';
import { playSfx } from '../../lib/sound';
import { colors, fonts, rate, useLayoutMode } from '../../theme';

/** Bright, toy-like colours for placed pieces (top face, extruded side). */
const PIECE_COLORS = [
  { fill: '#FF8A80', side: '#E0605A' },
  { fill: '#FFD54A', side: '#E0A400' },
  { fill: '#7DDB9E', side: '#3BAA68' },
  { fill: '#7FC4FF', side: '#3E8FD6' },
  { fill: '#B79CFF', side: '#8566E8' },
  { fill: '#FFB070', side: '#E07F35' },
  { fill: '#6EDAD4', side: '#2EA9A2' },
  { fill: '#FF9BD2', side: '#E063A8' },
];
const FIXED = { fill: '#E3DCFA', side: '#BDB2E6' }; // tiny regions placed for you

function pieceColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PIECE_COLORS[h % PIECE_COLORS.length];
}

const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

export default function Puzzle() {
  // This game is India only.
  const map = MAPS.india;
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: DiagramMode = params.mode === 'inline' ? 'inline' : 'outline'; // inline = state borders as guides
  const { mode: layout, s, width } = useLayoutMode();
  const board = layout === 'board';
  const view = useMemo(() => getView(map), [map]);
  const frame = useMapFrame(view);

  const [round, setRound] = useState(0);
  const pieces = useMemo(
    () => shuffle(map.data.regions.filter((r) => r.area >= PUZZLE_MIN_AREA)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  );
  const fixed = useMemo(() => map.data.regions.filter((r) => r.area < PUZZLE_MIN_AREA), [map]);
  const [placed, setPlaced] = useState<Record<string, number>>({}); // id -> misses before placing
  const [misses, setMisses] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Region | null>(null);
  const [nearId, setNearId] = useState<string | null>(null);
  const [hintId, setHintId] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'miss' } | null>(null);
  const [party, setParty] = useState<{ kind: CelebrationKind; origin: { x: number; y: number }; caption: string; n: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [newBest, setNewBest] = useState(false);

  const total = pieces.length;
  const doneCount = Object.keys(placed).length;
  const finished = total > 0 && doneCount >= total;
  const trayCount = board ? 6 : 4;
  const tray = pieces.filter((p) => placed[p.id] === undefined).slice(0, trayCount);
  const mistakes = Object.values(misses).reduce((a, b) => a + b, 0);

  // timer
  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [finished, round]);

  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(null), party.kind === 'perfect' ? 3200 : 1100);
    return () => clearTimeout(t);
  }, [party]);

  useEffect(() => {
    if (!hintId) return;
    const t = setTimeout(() => setHintId(null), 2600);
    return () => clearTimeout(t);
  }, [hintId]);

  const scoresList = pieces.filter((p) => placed[p.id] !== undefined).map((p) => puzzleScore(placed[p.id]));
  const average = scoresList.length ? Math.round(scoresList.reduce((a, b) => a + b, 0) / scoresList.length) : 0;
  const stars = scoresList.reduce((n, v) => n + rate(v).stars, 0);
  const points = scoresList.reduce((a, b) => a + b, 0) + Math.max(0, 300 - seconds) - hints * 20;

  useEffect(() => {
    if (!finished) return;
    playSfx('complete');
    setTimeout(() => playSfx('perfect'), 600);
    saveBest('puzzle-india', mode, undefined, average).then(setNewBest);
    setParty({ kind: 'perfect', origin: { x: frame.rootSize.w / 2, y: frame.rootSize.h / 2 }, caption: 'India complete!', n: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // ---- map board data -------------------------------------------------------
  const boardScores = useMemo(() => {
    const out: Record<string, number> = {};
    fixed.forEach((r) => (out[r.id] = 100));
    Object.keys(placed).forEach((id) => (out[id] = 100));
    return out;
  }, [placed, fixed]);
  const fills = useMemo(() => {
    const out: Record<string, { fill: string; side: string }> = {};
    fixed.forEach((r) => (out[r.id] = FIXED));
    Object.keys(placed).forEach((id) => (out[id] = pieceColor(id)));
    return out;
  }, [placed, fixed]);

  // ---- placing pieces ---------------------------------------------------------
  const tolerancePx = (r: Region) => Math.max(26, Math.min(70, Math.sqrt(r.area) * frame.scale * 0.45));

  /** Try to place `r` with its centre at map point (mx, my). Returns true when it snapped in. */
  const tryPlace = (r: Region, mx: number, my: number): boolean => {
    const dist = Math.hypot(mx - r.cx, my - r.cy) * frame.scale;
    if (dist <= tolerancePx(r)) {
      setPlaced((p) => ({ ...p, [r.id]: misses[r.id] ?? 0 }));
      setSelected(null);
      setHintId(null);
      playSfx('snap');
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setParty({ kind: 'sparkle', origin: frame.toRoot(r.cx, r.cy), caption: '', n: Date.now() });
      setMessage({ text: `${r.name} fits!`, tone: 'ok' });
      return true;
    }
    setMisses((m) => ({ ...m, [r.id]: (m[r.id] ?? 0) + 1 }));
    playSfx('wrong');
    setMessage({ text: `Not quite — ${r.name} goes somewhere else. Try again!`, tone: 'miss' });
    return false;
  };

  // drag state shared with the tray tiles
  const pan = useRef(new Animated.ValueXY()).current;
  const lift = Platform.OS === 'web' ? 0 : 56; // keep the piece visible above a finger
  const home = useRef({ x: 0, y: 0 });

  const startDrag = (r: Region, pageX: number, pageY: number, tileCenter: { x: number; y: number }) => {
    frame.measure();
    const { root } = frame.origin.current;
    home.current = { x: tileCenter.x - root.x, y: tileCenter.y - root.y + lift };
    pan.setValue({ x: pageX - root.x, y: pageY - root.y });
    setDragging(r);
    setSelected(null);
    playSfx('pickup');
  };
  const moveDrag = (r: Region, pageX: number, pageY: number) => {
    const { root } = frame.origin.current;
    pan.setValue({ x: pageX - root.x, y: pageY - root.y });
    const m = frame.pageToMap(pageX, pageY - lift);
    const near = Math.hypot(m.x - r.cx, m.y - r.cy) * frame.scale <= tolerancePx(r) * 1.25;
    setNearId((cur) => (near ? r.id : cur === r.id ? null : cur));
  };
  const endDrag = (r: Region, pageX: number, pageY: number) => {
    setNearId(null);
    const m = frame.pageToMap(pageX, pageY - lift);
    if (frame.inMap(m.x, m.y) && tryPlace(r, m.x, m.y)) {
      setDragging(null);
      return;
    }
    if (!frame.inMap(m.x, m.y)) playSfx('drop');
    Animated.spring(pan, { toValue: home.current, useNativeDriver: false, speed: 18, bounciness: 7 }).start(() => setDragging(null));
  };

  // tap-to-place: tap a piece, then tap the map
  const onBoardPress = (e: GestureResponderEvent) => {
    const r = pieces.find((p) => p.id === selected);
    if (!r) return;
    frame.measure();
    const m = frame.pageToMap(e.nativeEvent.pageX, e.nativeEvent.pageY);
    if (frame.inMap(m.x, m.y)) tryPlace(r, m.x, m.y);
  };

  const hint = () => {
    const r = pieces.find((p) => p.id === selected) ?? tray[0];
    if (!r) return;
    playSfx('tap');
    setHints((h) => h + 1);
    setHintId(r.id);
    setMessage({ text: `${r.name} goes in the glowing spot.`, tone: 'ok' });
  };

  const restart = () => {
    setRound((x) => x + 1);
    setPlaced({});
    setMisses({});
    setSelected(null);
    setHints(0);
    setMessage(null);
    setSeconds(0);
    setParty(null);
    setNewBest(false);
  };

  // ---- layout ---------------------------------------------------------------
  const tile = board ? s(112) : Math.max(64, Math.min(90, (width - 20 - 28 - 3 * 8) / 4));
  const hintRegion = hintId ? pieces.find((p) => p.id === hintId) : undefined;
  const nearRegion = nearId ? pieces.find((p) => p.id === nearId) : undefined;
  const anchor = dragging
    ? { left: -(dragging.cx - dragging.bbox[0]) * frame.scale, top: -(dragging.cy - dragging.bbox[1]) * frame.scale - lift }
    : { left: 0, top: 0 };

  const panel = finished ? (
    <RoundResults
      s={s}
      board={board}
      scores={scoresList}
      names={pieces.map((p) => p.name)}
      points={Math.max(0, points)}
      stars={stars}
      newBest={newBest}
      headline={{ label: 'Time', value: fmtTime(seconds), color: colors.ink }}
      hideBreakdown
      onAgain={restart}
      onHome={() => router.replace('/')}
    />
  ) : (
    <Card lip={board ? 8 : 6} style={[board ? { width: s(300), padding: s(18), gap: s(12) } : [gameStyles.sheet, { gap: 10, padding: 12 }], gameStyles.panel]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Label size={s(11)}>{selected ? 'Now tap its spot on the map' : 'Drag a piece onto India'}</Label>
        <Text style={{ fontFamily: fonts.black, color: colors.inkSoft, fontSize: s(12) }}>
          {total - doneCount} left
        </Text>
      </View>
      <View style={[styles.tray, { gap: board ? s(10) : 8 }]}>
        {tray.map((r) => (
          <TrayPiece
            key={r.id}
            region={r}
            size={tile}
            inline={false}
            selected={selected === r.id}
            hidden={dragging?.id === r.id}
            onStart={startDrag}
            onMove={moveDrag}
            onEnd={endDrag}
            onTap={(x) => {
              playSfx('tap');
              setSelected((cur) => (cur === x.id ? null : x.id));
            }}
          />
        ))}
      </View>
      <Text
        style={[
          styles.message,
          { fontSize: s(13), minHeight: s(36), color: message?.tone === 'miss' ? '#B7413A' : colors.inkSoft },
        ]}
        numberOfLines={2}
      >
        {message?.text ?? (selected ? 'Tip: you can also drag pieces.' : 'Tip: tap a piece, then tap where it goes.')}
      </Text>
      <Button label="Hint" variant="soft" size={s(14)} onPress={hint} />
    </Card>
  );

  return (
    <SafeAreaView style={gameStyles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View ref={frame.rootRef} style={gameStyles.root} onLayout={frame.onRootLayout}>
        <GameTopBar
          s={s}
          board={board}
          title="Puzzle · India"
          subtitle={mode === 'inline' ? 'With guides' : 'No guides'}
          done={doneCount}
          total={total}
          stars={stars}
          extra={
            <>
              <StatPill s={s}>{fmtTime(seconds)}</StatPill>
              <StatPill s={s}>{mistakes} {mistakes === 1 ? "miss" : "misses"}</StatPill>
            </>
          }
        />
        <View style={[gameStyles.body, board ? { flexDirection: 'row', padding: s(16), paddingTop: s(4), gap: s(16) } : { flexDirection: 'column' }]}>
          <View style={[gameStyles.mapWrap, board ? { borderRadius: s(28) } : { marginHorizontal: 10, marginBottom: 10, borderRadius: 22 }]}>
            <OceanBackdrop />
            <View ref={frame.mapRef} style={gameStyles.mapInner} onLayout={frame.onMapLayout}>
              {frame.scale > 0 && (
                <>
                  <MapCanvas
                    data={map.data}
                    view={view}
                    scale={frame.scale}
                    scores={boardScores}
                    fills={fills}
                    showBorders={mode === 'inline'}
                    showInner={false}
                  />
                  {hintRegion && <RegionHighlight region={hintRegion} view={view} scale={frame.scale} inset={frame.inset} color={colors.sun} blink />}
                  {nearRegion && !hintRegion && (
                    <RegionHighlight region={nearRegion} view={view} scale={frame.scale} inset={frame.inset} color={colors.mint} blink={false} />
                  )}
                  {selected && (
                    <Pressable
                      accessibilityLabel="Place the selected piece here"
                      onPress={onBoardPress}
                      style={[StyleSheet.absoluteFill, Platform.OS === 'web' && ({ cursor: 'crosshair' } as object)]}
                    />
                  )}
                </>
              )}
            </View>
            <View style={[gameStyles.compass, { top: s(10), right: s(10) }]} pointerEvents="none">
              <CompassRose size={s(board ? 58 : 42)} />
            </View>
          </View>
          {panel}
        </View>

        {dragging && frame.scale > 0 && (
          <Animated.View pointerEvents="none" style={[styles.floating, { transform: pan.getTranslateTransform() }]}>
            <View style={{ position: 'absolute', left: anchor.left, top: anchor.top }}>
              <RegionShape
                region={dragging}
                scale={frame.scale}
                inline={false}
                fill={pieceColor(dragging.id).fill}
                side={pieceColor(dragging.id).side}
                stroke="#fff"
                strokePx={1.6}
                depthPx={5}
                shadow
              />
            </View>
          </Animated.View>
        )}

        {party && frame.rootSize.w > 0 && (
          <Celebration key={party.n} kind={party.kind} origin={party.origin} width={frame.rootSize.w} height={frame.rootSize.h} caption={party.caption} trigger={party.n} />
        )}
      </View>
    </SafeAreaView>
  );
}

type TrayProps = {
  region: Region;
  size: number;
  inline: boolean;
  selected: boolean;
  hidden: boolean;
  onStart: (r: Region, pageX: number, pageY: number, tileCenter: { x: number; y: number }) => void;
  onMove: (r: Region, pageX: number, pageY: number) => void;
  onEnd: (r: Region, pageX: number, pageY: number) => void;
  onTap: (r: Region) => void;
};

/** A chunky 3D puzzle piece in the tray. Drag it, or tap to select. */
function TrayPiece({ region, size, inline, selected, hidden, onStart, onMove, onEnd, onTap }: TrayProps) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const cb = useRef({ onStart, onMove, onEnd, onTap, region });
  cb.current = { onStart, onMove, onEnd, onTap, region };
  const center = useRef({ x: 0, y: 0 });
  const moved = useRef(false);

  // little "pop in" when a new piece arrives in the tray
  const pop = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 140, useNativeDriver: NATIVE }).start();
  }, [pop]);
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(lift, { toValue: selected ? 1 : 0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [selected, lift]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          moved.current = false;
          ref.current?.measureInWindow((x, y, w, h) => (center.current = { x: x + w / 2, y: y + h / 2 }));
        },
        onPanResponderMove: (_e, g) => {
          if (!moved.current && Math.hypot(g.dx, g.dy) > 6) {
            moved.current = true;
            cb.current.onStart(cb.current.region, g.moveX, g.moveY, center.current);
          }
          if (moved.current) cb.current.onMove(cb.current.region, g.moveX, g.moveY);
        },
        onPanResponderRelease: (_e, g) => {
          if (moved.current) cb.current.onEnd(cb.current.region, g.moveX, g.moveY);
          else cb.current.onTap(cb.current.region);
        },
        onPanResponderTerminate: (_e, g) => {
          if (moved.current) cb.current.onEnd(cb.current.region, g.moveX, g.moveY);
        },
      }),
    [],
  );

  const c = pieceColor(region.id);
  const inner = size - 22;
  return (
    <Animated.View
      ref={ref}
      {...responder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={`${region.name} puzzle piece`}
      accessibilityState={{ selected }}
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size * 0.2,
          opacity: hidden ? 0.15 : 1,
          borderColor: selected ? colors.primary : colors.line,
          borderBottomColor: selected ? colors.primaryDark : colors.surfaceLip,
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          transform: [{ scale: pop }, { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
        },
        Platform.OS === 'web' && ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object),
      ]}
    >
      <View pointerEvents="none" style={{ alignItems: 'center' }}>
        <RegionShape region={region} scale={fitScale(region, inner)} inline={inline} fill={c.fill} side={c.side} stroke="#fff" strokePx={1.6} depthPx={4} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tray: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tile: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderBottomWidth: 6 },
  message: { fontFamily: fonts.bodyBold, textAlign: 'center', lineHeight: 18 },
  floating: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' },
});
