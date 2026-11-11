import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
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
import { MapCanvas, type RegionStatus } from '../../components/MapCanvas';
import { RegionShape, fitScale } from '../../components/RegionShape';
import { Button, Chip } from '../../components/ui';
import { getMap, getView, type Region } from '../../data/maps';
import { buildQuestions, isCorrectDrop, type DiagramMode } from '../../lib/game';
import { colors, useLayoutMode } from '../../theme';

type Feedback = { kind: 'correct' | 'wrong' | 'reveal'; text: string } | null;

const MAX_TRIES = 3;

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
  const [status, setStatus] = useState<Record<string, RegionStatus>>({});
  const [tries, setTries] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hintId, setHintId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [showName, setShowName] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const current: Region | undefined = questions[index];
  const finished = index >= questions.length;

  const restart = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setStatus({});
    setTries(0);
    setFirstTry(0);
    setMistakes(0);
    setHintId(null);
    setFeedback(null);
    setBusy(false);
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
  const live = useRef({ current, scale, busy, finished });
  live.current = { current, scale, busy, finished };

  const pan = useRef(new Animated.ValueXY()).current;
  // On touch devices lift the piece above the finger so it stays visible.
  const lift = Platform.OS === 'web' ? 0 : 56;

  const handleDrop = useRef<(x: number, y: number) => void>(() => {});
  handleDrop.current = (pageX, pageY) => {
    if (!current) return;
    const { svg } = origin.current;
    const mx = view.x + (pageX - svg.x) / scale;
    const my = view.y + (pageY - lift - svg.y) / scale;
    const insideMap = mx >= view.x && my >= view.y && mx <= view.x + view.w && my <= view.y + view.h;
    if (!insideMap) {
      returnPiece();
      return;
    }
    if (isCorrectDrop(current, mx, my, scale)) {
      setDragging(false);
      onCorrect(current);
    } else {
      onWrong(current);
      returnPiece();
    }
  };

  const returnPiece = () => {
    const { card, root } = origin.current;
    Animated.spring(pan, {
      toValue: { x: card.x - root.x, y: card.y - root.y + lift },
      useNativeDriver: false,
      speed: 18,
      bounciness: 6,
    }).start(() => setDragging(false));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !live.current.busy && !live.current.finished,
        onMoveShouldSetPanResponder: () => !live.current.busy && !live.current.finished,
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
          // a simple tap (no movement) just bounces back
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

  // ---- outcomes -------------------------------------------------------------
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const next = () => {
    setIndex((i) => i + 1);
    setTries(0);
    setHintId(null);
    setFlashId(null);
    setFeedback(null);
    setBusy(false);
  };

  const describe = (r: Region) =>
    mode === 'inline' && r.districts?.length ? `${r.name} · ${r.districts.length} districts` : r.name;

  const onCorrect = (r: Region) => {
    setBusy(true);
    setStatus((st) => ({ ...st, [r.id]: 'placed' }));
    if (tries === 0) setFirstTry((n) => n + 1);
    setHintId(null);
    setFlashId(r.id);
    setFeedback({ kind: 'correct', text: describe(r) });
    later(next, 1300);
  };

  const onWrong = (r: Region) => {
    const t = tries + 1;
    setTries(t);
    setMistakes((n) => n + 1);
    if (t >= MAX_TRIES) {
      setBusy(true);
      setStatus((st) => ({ ...st, [r.id]: 'revealed' }));
      setHintId(r.id);
      setFeedback({ kind: 'reveal', text: `It was ${describe(r)}` });
      later(next, 2200);
    } else {
      if (t >= 2) setHintId(r.id);
      setFeedback({ kind: 'wrong', text: t >= 2 ? 'Not quite — look for the highlighted area' : 'Not quite — try again' });
    }
  };

  const skip = () => {
    if (!current || busy) return;
    setBusy(true);
    setStatus((st) => ({ ...st, [current.id]: 'revealed' }));
    setHintId(current.id);
    setFeedback({ kind: 'reveal', text: `That was ${describe(current)}` });
    later(next, 1800);
  };

  const hint = () => current && !busy && setHintId(current.id);

  // ---- layout -------------------------------------------------------------
  const cardBox = board ? s(220) : 116;
  const pieceScale = current ? fitScale(current, cardBox) : 1;
  const unit = map.unit;
  const done = index;
  const total = questions.length;

  const prompt = !current
    ? ''
    : showName
      ? `Place ${current.name}`
      : `Which ${unit} is this?`;

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
          <View style={[styles.progressFill, { width: `${total ? (Math.min(done, total) / total) * 100 : 0}%` }]} />
        </View>
      </View>
      <Text style={[styles.score, { fontSize: s(15) }]}>
        {firstTry}/{total}
      </Text>
      {Platform.OS === 'web' && board && <Button label="⛶" accessibilityLabel="Toggle full screen" variant="soft" size={s(15)} onPress={fullscreen} />}
    </View>
  );

  const feedbackColor =
    feedback?.kind === 'correct' ? colors.correct : feedback?.kind === 'wrong' ? colors.wrong : colors.inkSoft;

  const panel = finished ? (
    <Results
      s={s}
      board={board}
      total={total}
      firstTry={firstTry}
      mistakes={mistakes}
      onAgain={restart}
      onHome={() => router.replace('/')}
    />
  ) : current ? (
    <View style={[styles.panel, board ? [styles.panelBoard, { width: s(340), padding: s(24), gap: s(18) }] : [styles.panelPhone, { gap: 10 }]]}>
      <View style={board ? { gap: s(18) } : { flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={board ? { gap: s(6) } : { flex: 1, gap: 4 }}>
        <Text style={[styles.counter, { fontSize: s(13) }]}>
          {Math.min(done + 1, total)} OF {total}
        </Text>
        <Text style={[styles.prompt, { fontSize: s(board ? 26 : 19) }]}>{prompt}</Text>
        <Text style={[styles.sub, { fontSize: s(14) }]}>
          {dragging ? 'Drop it where it belongs' : 'Drag the shape onto the map'}
        </Text>
        <Text style={[styles.feedback, { fontSize: s(board ? 18 : 15), color: feedbackColor, minHeight: s(board ? 26 : 20) }]}>
          {feedback ? (feedback.kind === 'correct' ? `✓ ${feedback.text}` : feedback.text) : ' '}
        </Text>
      </View>

      <View
        ref={cardRef}
        onLayout={() => requestAnimationFrame(measure)}
        {...responder.panHandlers}
        style={[
          styles.card,
          { width: cardBox + s(28), height: cardBox + s(28), borderRadius: s(18) },
          feedback?.kind === 'wrong' && { borderColor: colors.wrong },
          Platform.OS === 'web' && ({ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' } as object),
        ]}
        accessibilityLabel={`Shape of a ${unit}. Drag it onto the map.`}
      >
        <View style={{ opacity: dragging || busy ? 0.18 : 1 }} pointerEvents="none">
          <RegionShape region={current} scale={pieceScale} inline={mode === 'inline'} strokePx={board ? 2.5 : 1.8} />
        </View>
      </View>
      </View>

      <View style={[styles.actions, { gap: s(8) }]}>
        <Chip size={s(13)} label={showName ? 'Name shown' : 'Show name'} selected={showName} onPress={() => setShowName((v) => !v)} />
        <Chip size={s(13)} label="Hint" selected={false} onPress={hint} disabled={busy} />
        <Chip size={s(13)} label="Skip" selected={false} onPress={skip} disabled={busy} />
      </View>
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
                  status={status}
                  showInner={mode === 'inline'}
                  hintId={hintId}
                  flashId={flashId}
                />
              )}
            </View>
          </View>
          {panel}
        </View>

        {dragging && current && scale > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.floating, { transform: pan.getTranslateTransform() }]}
          >
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
            {/* target ring marks the drop point — essential for tiny regions */}
            <View style={[styles.ring, { top: -lift - 14, left: -14 }]} />
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

function Results(props: {
  s: (n: number) => number;
  board: boolean;
  total: number;
  firstTry: number;
  mistakes: number;
  onAgain: () => void;
  onHome: () => void;
}) {
  const { s, board, total, firstTry, mistakes } = props;
  const pct = total ? Math.round((firstTry / total) * 100) : 0;
  const message = pct >= 90 ? 'Outstanding!' : pct >= 70 ? 'Great work!' : pct >= 40 ? 'Good effort!' : 'Keep practising!';
  return (
    <View style={[styles.panel, board ? [styles.panelBoard, { width: s(340), padding: s(24) }] : styles.panelPhone, { gap: s(14), alignItems: board ? 'stretch' : 'center' }]}>
      <View style={[{ gap: s(4) }, !board && { alignItems: 'center' }]}>
        <Text style={[styles.counter, { fontSize: s(13) }]}>ROUND COMPLETE</Text>
        <Text style={[styles.prompt, { fontSize: s(board ? 30 : 22) }]}>{message}</Text>
        <Text style={[styles.sub, { fontSize: s(15) }]}>
          {firstTry} of {total} first try · {pct}% · {mistakes} {mistakes === 1 ? 'mistake' : 'mistakes'}
        </Text>
      </View>
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
  body: { flex: 1 },
  mapWrap: { flex: 1, backgroundColor: colors.sea, overflow: 'hidden' },
  mapInner: { flex: 1, margin: 8, alignItems: 'center', justifyContent: 'center' },
  panel: { backgroundColor: colors.surface },
  panelBoard: { borderRadius: 22, justifyContent: 'flex-start' },
  panelPhone: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  counter: { fontWeight: '700', color: colors.inkSoft, letterSpacing: 1.2 },
  prompt: { fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
  sub: { color: colors.inkSoft },
  feedback: { fontWeight: '700' },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 2,
    borderColor: colors.line,
    borderStyle: 'dashed',
    alignSelf: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  floating: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' },
  ring: { position: 'absolute', width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.accent },
});
