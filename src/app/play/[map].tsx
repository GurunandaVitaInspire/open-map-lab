import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapCanvas, type Attempt } from '../../components/MapCanvas';
import { RegionShape, fitScale } from '../../components/RegionShape';
import { Button } from '../../components/ui';
import { getMap, getView, type Region } from '../../data/maps';
import { buildQuestions, measurePlacement, rate, RATING_LEGEND, type DiagramMode, type Placement } from '../../lib/game';
import { colors, useLayoutMode } from '../../theme';

type Answer = { region: Region; placement: Placement | null }; // null = skipped

/** Screen pixels of jitter forgiven when scoring a drop. */
const SLACK_PX = 6;

export default function Play() {
  const params = useLocalSearchParams<{ map: string; mode?: string; group?: string; count?: string }>();
  const map = getMap(params.map);
  const mode: DiagramMode = params.mode === 'inline' && map.supportsInline ? 'inline' : 'outline';
  const group = params.group || undefined;
  const count = Number(params.count ?? 10) || 0;
  const { mode: layout, s } = useLayoutMode();
  const board = layout === 'board';

  // ---- game state ---------------------------------------------------------
  const [round, setRound] = useState(0);
  const questions = useMemo(
    () => buildQuestions(map, { mapId: map.id, mode, group, count }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map.id, mode, group, count, round],
  );
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [dragging, setDragging] = useState(false);

  const current: Region | undefined = questions[index];
  const finished = index >= questions.length;
  const answer = answers.length > index ? answers[index] : undefined; // set once this question is answered
  const reviewing = !!answer;

  const scores = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of answers) out[a.region.id] = a.placement?.accuracy ?? 0;
    return out;
  }, [answers]);
  const average = answers.length
    ? Math.round(answers.reduce((n, a) => n + (a.placement?.accuracy ?? 0), 0) / answers.length)
    : null;

  const restart = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setAnswers([]);
    setAttempt(null);
  };

  const next = () => {
    setAttempt(null);
    setIndex((i) => i + 1);
  };

  // ---- geometry: where the map sits on screen -----------------------------
  const [mapBox, setMapBox] = useState({ w: 0, h: 0 });
  const view = useMemo(() => getView(map, group), [map, group]);
  const scale = mapBox.w > 0 ? Math.min(mapBox.w / view.w, mapBox.h / view.h) : 0;

  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const mapRef = useRef<ComponentRef<typeof View>>(null);
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const origin = useRef({ root: { x: 0, y: 0 }, svg: { x: 0, y: 0 }, card: { x: 0, y: 0 } });

  const measure = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => (origin.current.root = { x, y }));
    mapRef.current?.measureInWindow((x, y, w, h) => {
      const sc = Math.min(w / view.w, h / view.h);
      origin.current.svg = { x: x + (w - view.w * sc) / 2, y: y + (h - view.h * sc) / 2 };
    });
    cardRef.current?.measureInWindow((x, y, w, h) => (origin.current.card = { x: x + w / 2, y: y + h / 2 }));
  }, [view]);

  const onMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMapBox({ w: width, h: height });
    requestAnimationFrame(measure);
  };

  // ---- drag & drop ----------------------------------------------------------
  // Keep the latest values in a ref so the PanResponder (created once) never sees stale state.
  const live = useRef({ locked: false });
  live.current.locked = reviewing || finished || !current;

  const pan = useRef(new Animated.ValueXY()).current;
  // On touch devices lift the piece above the finger so it stays visible.
  const lift = Platform.OS === 'web' ? 0 : 56;

  const returnPiece = () => {
    const { card, root } = origin.current;
    Animated.spring(pan, {
      toValue: { x: card.x - root.x, y: card.y - root.y + lift },
      useNativeDriver: false,
      speed: 18,
      bounciness: 6,
    }).start(() => setDragging(false));
  };

  const handleDrop = useRef<(x: number, y: number) => void>(() => {});
  handleDrop.current = (pageX, pageY) => {
    if (!current || reviewing) return;
    const { svg } = origin.current;
    // centroid of the dropped piece, in map units
    const mx = view.x + (pageX - svg.x) / scale;
    const my = view.y + (pageY - lift - svg.y) / scale;
    const insideMap = mx >= view.x && my >= view.y && mx <= view.x + view.w && my <= view.y + view.h;
    if (!insideMap) {
      returnPiece(); // dropped off the map: no attempt, try again
      return;
    }
    const dx = mx - current.cx;
    const dy = my - current.cy;
    const placement = measurePlacement(current, dx, dy, SLACK_PX / scale);
    setDragging(false);
    setAttempt({ id: current.id, dx, dy });
    setAnswers((a) => [...a, { region: current, placement }]);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !live.current.locked,
        onMoveShouldSetPanResponder: () => !live.current.locked,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_e, g) => {
          measure();
          const { root } = origin.current;
          pan.setValue({ x: g.x0 - root.x, y: g.y0 - root.y });
          setDragging(true);
        },
        onPanResponderMove: (_e, g) => {
          const { root } = origin.current;
          pan.setValue({ x: g.moveX - root.x, y: g.moveY - root.y });
        },
        onPanResponderRelease: (_e, g) => {
          // a simple tap (no movement) just puts the piece back
          if (Math.abs(g.dx) < 4 && Math.abs(g.dy) < 4) {
            setDragging(false);
            return;
          }
          handleDrop.current(g.moveX, g.moveY);
        },
        onPanResponderTerminate: () => setDragging(false),
      }),
    [measure, pan],
  );

  const skip = () => {
    if (!current || reviewing) return;
    setAttempt({ id: current.id, dx: 0, dy: 0 });
    setAnswers((a) => [...a, { region: current, placement: null }]);
  };

  // ---- layout -------------------------------------------------------------
  const cardBox = board ? s(200) : 104;
  const pieceScale = current ? fitScale(current, cardBox) : 1;
  const total = questions.length;
  const anchor = current
    ? { left: -(current.cx - current.bbox[0]) * scale, top: -(current.cy - current.bbox[1]) * scale - lift }
    : { left: 0, top: 0 };

  const fullscreen = () => {
    if (Platform.OS !== 'web') return;
    const d = globalThis.document as Document | undefined;
    if (!d) return;
    if (d.fullscreenElement) d.exitFullscreen?.();
    else d.documentElement.requestFullscreen?.();
  };

  const topBar = (
    <View style={[styles.topBar, { paddingHorizontal: s(16), paddingVertical: s(10), gap: s(12) }]}>
      <Button label="‹ Maps" variant="ghost" size={s(15)} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={[styles.topTitle, { fontSize: s(15) }]} numberOfLines={1}>
          {map.title}
          {group ? ` · ${group}` : ''} · {mode === 'inline' ? 'Inline' : 'Outline'}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${total ? (answers.length / total) * 100 : 0}%` }]} />
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.score, { fontSize: s(16) }]}>{average === null ? '—' : `${average}%`}</Text>
        <Text style={[styles.scoreLabel, { fontSize: s(10) }]}>ACCURACY</Text>
      </View>
      {Platform.OS === 'web' && board && <Button label="⛶" accessibilityLabel="Toggle full screen" variant="soft" size={s(15)} onPress={fullscreen} />}
    </View>
  );

  const unitWord = map.unit.charAt(0).toUpperCase() + map.unit.slice(1);
  const extra =
    current && mode === 'inline' && current.districts?.length ? ` · ${current.districts.length} districts` : '';

  const resultBlock = answer ? (
    answer.placement ? (
      <View style={{ gap: s(2) }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(8) }}>
          <Text style={[styles.bigPct, { fontSize: s(board ? 44 : 30), color: rate(answer.placement.accuracy).color }]}>
            {answer.placement.accuracy}%
          </Text>
          <Text style={[styles.rating, { fontSize: s(board ? 20 : 16), color: rate(answer.placement.accuracy).color }]}>
            {rate(answer.placement.accuracy).label}
          </Text>
        </View>
        <Text style={[styles.sub, { fontSize: s(14) }]}>
          {answer.placement.km < 10 ? 'Right on the spot' : `Off by about ${answer.placement.km.toLocaleString()} km`}
          {extra}
        </Text>
      </View>
    ) : (
      <Text style={[styles.sub, { fontSize: s(15) }]}>Skipped — its position is outlined in green.</Text>
    )
  ) : null;

  const panel = finished ? (
    <Results s={s} board={board} answers={answers} average={average ?? 0} onAgain={restart} onHome={() => router.replace('/')} />
  ) : current ? (
    <View style={[styles.panel, board ? [styles.panelBoard, { width: s(340), padding: s(24), gap: s(18) }] : [styles.panelPhone, { gap: 12 }]]}>
      <View style={board ? { gap: s(18) } : { flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={board ? { gap: s(6) } : { flex: 1, gap: 4 }}>
          <Text style={[styles.counter, { fontSize: s(12) }]}>
            {unitWord.toUpperCase()} {Math.min(index + 1, total)} OF {total}
          </Text>
          <Text style={[styles.prompt, { fontSize: s(board ? 30 : 22) }]} numberOfLines={2}>
            {current.name}
          </Text>
          {reviewing ? (
            resultBlock
          ) : (
            <Text style={[styles.sub, { fontSize: s(14) }]}>
              {dragging ? 'Drop it where you think it is' : `Drag the shape to where this ${map.unit} is`}
            </Text>
          )}
        </View>

        <View
          ref={cardRef}
          onLayout={() => requestAnimationFrame(measure)}
          {...responder.panHandlers}
          style={[
            styles.card,
            { width: cardBox + s(24), height: cardBox + s(24), borderRadius: s(16) },
            Platform.OS === 'web' &&
              ({ cursor: reviewing ? 'default' : dragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' } as object),
          ]}
          accessibilityLabel={`Shape of ${current.name}. Drag it onto the map.`}
        >
          <View style={{ opacity: dragging || reviewing ? 0.2 : 1 }} pointerEvents="none">
            <RegionShape region={current} scale={pieceScale} inline={mode === 'inline'} strokePx={board ? 2.5 : 1.8} />
          </View>
        </View>
      </View>

      {reviewing ? (
        <Button label={index + 1 >= total ? 'See results' : 'Next →'} size={s(17)} onPress={next} />
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: board ? 'flex-start' : 'flex-end' }}>
          <Button label="Skip" variant="soft" size={s(14)} onPress={skip} />
        </View>
      )}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View ref={rootRef} style={styles.root} onLayout={() => requestAnimationFrame(measure)}>
        {topBar}
        <View style={[styles.body, board ? { flexDirection: 'row', padding: s(16), gap: s(16) } : { flexDirection: 'column' }]}>
          <View style={[styles.mapWrap, board && { borderRadius: s(22) }]}>
            <View ref={mapRef} style={styles.mapInner} onLayout={onMapLayout}>
              {scale > 0 && (
                <MapCanvas
                  data={map.data}
                  view={view}
                  focusGroup={group}
                  scale={scale}
                  scores={scores}
                  showBorders={mode === 'inline'}
                  showInner={mode === 'inline'}
                  attempt={attempt}
                />
              )}
            </View>
            {reviewing && answer?.placement && (
              <View style={[styles.mapLegend, { padding: s(8), gap: s(10) }]} pointerEvents="none">
                <LegendDot color={colors.accent} label="Your placement" size={s(12)} dashed />
                <LegendDot color={colors.correct} label="Actual position" size={s(12)} />
              </View>
            )}
          </View>
          {panel}
        </View>

        {dragging && current && scale > 0 && (
          <Animated.View pointerEvents="none" style={[styles.floating, { transform: pan.getTranslateTransform() }]}>
            <View style={{ position: 'absolute', left: anchor.left, top: anchor.top }}>
              <RegionShape
                region={current}
                scale={scale}
                inline={mode === 'inline'}
                fill="rgba(47,91,234,0.35)"
                stroke={colors.accent}
                strokePx={1.5}
              />
            </View>
            {/* ring marks the drop point — essential for tiny regions */}
            <View style={[styles.ring, { top: -lift - 14, left: -14 }]} />
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

function LegendDot({ color, label, size, dashed }: { color: string; label: string; size: number; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: size * 1.6, height: 0, borderTopWidth: 2, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />
      <Text style={{ fontSize: size, color: colors.ink, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function Results(props: {
  s: (n: number) => number;
  board: boolean;
  answers: Answer[];
  average: number;
  onAgain: () => void;
  onHome: () => void;
}) {
  const { s, board, answers, average } = props;
  const r = rate(average);
  const message = average >= 85 ? 'Outstanding!' : average >= 65 ? 'Great work!' : average >= 40 ? 'Good effort!' : 'Keep practising!';
  const counts = RATING_LEGEND.map((l) => ({
    ...l,
    n: answers.filter((a) => rate(a.placement?.accuracy ?? 0).label === l.label).length,
  }));
  const worst = answers
    .filter((a) => (a.placement?.accuracy ?? 0) < 45)
    .map((a) => a.region.name)
    .slice(0, 6);

  return (
    <View style={[styles.panel, board ? [styles.panelBoard, { width: s(340), padding: s(24) }] : styles.panelPhone, { gap: s(14) }]}>
      <View style={{ gap: s(4) }}>
        <Text style={[styles.counter, { fontSize: s(12) }]}>ROUND COMPLETE</Text>
        <Text style={[styles.prompt, { fontSize: s(board ? 28 : 22) }]}>{message}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(8) }}>
          <Text style={[styles.bigPct, { fontSize: s(board ? 44 : 32), color: r.color }]}>{average}%</Text>
          <Text style={[styles.sub, { fontSize: s(14) }]}>average accuracy</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(10) }}>
        {counts.map((c) => (
          <View key={c.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: s(12), height: s(12), borderRadius: 3, backgroundColor: c.fill }} />
            <Text style={{ fontSize: s(13), color: colors.ink }}>
              {c.label} <Text style={{ fontWeight: '800' }}>{c.n}</Text>
            </Text>
          </View>
        ))}
      </View>
      {worst.length > 0 && (
        <Text style={[styles.sub, { fontSize: s(13) }]}>Practise: {worst.join(', ')}</Text>
      )}
      <View style={{ gap: s(8) }}>
        <Button label="Play again" size={s(16)} onPress={props.onAgain} />
        <Button label="Choose map" variant="soft" size={s(16)} onPress={props.onHome} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  topTitle: { fontWeight: '700', color: colors.ink },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.accent },
  score: { fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  scoreLabel: { fontWeight: '700', color: colors.inkSoft, letterSpacing: 1 },
  body: { flex: 1 },
  mapWrap: { flex: 1, backgroundColor: colors.sea, overflow: 'hidden' },
  mapInner: { flex: 1, margin: 8, alignItems: 'center', justifyContent: 'center' },
  mapLegend: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
  },
  panel: { backgroundColor: colors.surface },
  panelBoard: { borderRadius: 22, justifyContent: 'flex-start' },
  panelPhone: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line },
  counter: { fontWeight: '700', color: colors.inkSoft, letterSpacing: 1.2 },
  prompt: { fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  sub: { color: colors.inkSoft, lineHeight: 20 },
  bigPct: { fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  rating: { fontWeight: '800' },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.line,
    borderStyle: 'dashed',
    alignSelf: 'center',
  },
  floating: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' },
  ring: { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.accent },
});
