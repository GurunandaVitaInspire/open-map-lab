import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Animated, Easing, PanResponder, Platform, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { OceanBackdrop } from '../../components/Backdrops';
import { Celebration, type CelebrationKind } from '../../components/Celebration';
import { BackIcon, CompassRose, ExpandIcon, FlameIcon, StarIcon } from '../../components/icons';
import { MapCanvas, type Attempt } from '../../components/MapCanvas';
import { RegionShape, fitScale } from '../../components/RegionShape';
import { Button, Card, IconButton, Label, Pill } from '../../components/ui';
import { getMap, getView, type MapDefinition, type Region } from '../../data/maps';
import { buildQuestions, cheer, measurePlacement, placementTip, pointsFor, type DiagramMode, type Placement } from '../../lib/game';
import { saveBest } from '../../lib/progress';
import { colors, fonts, rate, RATING_LEGEND, useLayoutMode } from '../../theme';

type Answer = {
  region: Region;
  placement: Placement | null; // null = skipped
  points: number;
  bonus: number;
  message: string;
  tip: string;
};

/** Screen pixels of jitter forgiven when scoring a drop. */
const SLACK_PX = 6;
const NATIVE = Platform.OS !== 'web';

function buzz(kind: 'perfect' | 'great') {
  if (Platform.OS === 'web') return;
  if (kind === 'perfect') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

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
  const [streak, setStreak] = useState(0);
  const [party, setParty] = useState<{ kind: CelebrationKind; origin: { x: number; y: number }; caption: string; n: number } | null>(null);
  const [newBest, setNewBest] = useState(false);

  const current: Region | undefined = questions[index];
  const finished = index >= questions.length;
  const answer = answers.length > index ? answers[index] : undefined;
  const reviewing = !!answer;

  const scores = useMemo(() => {
    const out: Record<string, number> = {};
    for (const a of answers) out[a.region.id] = a.placement?.accuracy ?? 0;
    return out;
  }, [answers]);
  const average = answers.length ? Math.round(answers.reduce((n, a) => n + (a.placement?.accuracy ?? 0), 0) / answers.length) : null;
  const stars = answers.reduce((n, a) => n + rate(a.placement?.accuracy ?? 0).stars, 0);
  const points = answers.reduce((n, a) => n + a.points, 0);

  const restart = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setAnswers([]);
    setAttempt(null);
    setStreak(0);
    setParty(null);
    setNewBest(false);
  };

  const next = () => {
    setAttempt(null);
    setParty(null);
    setIndex((i) => i + 1);
  };

  // Save the best score once a round finishes, and celebrate a strong round.
  useEffect(() => {
    if (!finished || !answers.length || average === null) return;
    saveBest(map.id, mode, group, average).then(setNewBest);
    if (average >= 70) {
      setParty({ kind: average >= 90 ? 'perfect' : 'great', origin: { x: rootSize.current.w / 2, y: rootSize.current.h / 2 }, caption: 'Round complete!', n: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // Celebrations clear themselves so the result on the map stays readable.
  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(null), party.kind === 'perfect' ? 3000 : party.kind === 'great' ? 1900 : 1400);
    return () => clearTimeout(t);
  }, [party]);

  // ---- geometry: where the map sits on screen -----------------------------
  const [mapBox, setMapBox] = useState({ w: 0, h: 0 });
  const rootSize = useRef({ w: 0, h: 0 });
  const [overlay, setOverlay] = useState({ w: 0, h: 0 });
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

  /** Root-relative screen position of a point given in map units. */
  const toRoot = (mx: number, my: number) => {
    const { svg, root } = origin.current;
    return { x: svg.x - root.x + (mx - view.x) * scale, y: svg.y - root.y + (my - view.y) * scale };
  };

  // ---- the tray piece gently bobs to invite a drag ---------------------------
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (dragging || reviewing || finished) {
      bob.stopAnimation();
      bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(bob, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dragging, reviewing, finished, index, bob]);

  // ---- drag & drop ----------------------------------------------------------
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

  const record = (region: Region, placement: Placement | null, dx: number, dy: number) => {
    const acc = placement?.accuracy ?? 0;
    const tier = rate(acc).tier;
    const nextStreak = acc >= 80 ? streak + 1 : 0;
    const pts = placement ? pointsFor(acc, nextStreak) : { total: 0, bonus: 0 };
    const message = placement ? cheer(tier) : 'Skipped — study the green outline and remember it!';
    setStreak(nextStreak);
    setAttempt({ id: region.id, dx, dy });
    setAnswers((a) => [
      ...a,
      {
        region,
        placement,
        points: pts.total,
        bonus: pts.bonus,
        message,
        tip: placement && acc < 80 ? placementTip(map, region, dx, dy) : '',
      },
    ]);
    if (placement && (tier === 'perfect' || tier === 'great' || tier === 'good')) {
      const at = toRoot(region.cx, region.cy);
      setParty({ kind: tier, origin: at, caption: tier === 'perfect' ? message : '', n: Date.now() });
      if (tier !== 'good') buzz(tier);
    }
  };

  const handleDrop = useRef<(x: number, y: number) => void>(() => {});
  handleDrop.current = (pageX, pageY) => {
    if (!current || reviewing) return;
    const { svg } = origin.current;
    const mx = view.x + (pageX - svg.x) / scale;
    const my = view.y + (pageY - lift - svg.y) / scale;
    const insideMap = mx >= view.x && my >= view.y && mx <= view.x + view.w && my <= view.y + view.h;
    if (!insideMap) {
      returnPiece(); // dropped off the map: no attempt, try again
      return;
    }
    const dx = mx - current.cx;
    const dy = my - current.cy;
    setDragging(false);
    record(current, measurePlacement(current, dx, dy, SLACK_PX / scale), dx, dy);
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
    record(current, null, 0, 0);
  };

  // ---- layout -------------------------------------------------------------
  const cardBox = board ? s(190) : 96;
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

  const progress = total ? answers.length / total : 0;

  const topBar = (
    <View style={[styles.topBar, { paddingHorizontal: s(14), paddingVertical: s(10), gap: s(12) }]}>
      <IconButton accessibilityLabel="Back to maps" size={s(42)} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <BackIcon size={s(20)} />
      </IconButton>
      <View style={{ flex: 1, gap: s(5) }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Text style={[styles.topTitle, { fontSize: s(board ? 20 : 16) }]} numberOfLines={1}>
            {map.title}
            {group ? ` · ${group}` : ''}
            <Text style={{ color: colors.inkSoft, fontFamily: fonts.bodyBold, fontSize: s(13) }}>  {mode === 'inline' ? 'Inline' : 'Outline'}</Text>
          </Text>
          <Text style={[styles.topCount, { fontSize: s(13) }]}>
            {Math.min(answers.length, total)}/{total}
          </Text>
        </View>
        <View style={[styles.progressTrack, { height: s(12) }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]}>
            <View style={styles.progressShine} />
          </View>
        </View>
      </View>
      <Pill>
        <StarIcon size={s(18)} />
        <Text style={[styles.pillText, { fontSize: s(15) }]}>{stars}</Text>
      </Pill>
      <Pill style={streak >= 2 ? { borderColor: '#FFD2B8', borderBottomColor: '#FFB48A', backgroundColor: '#FFF4EC' } : undefined}>
        <FlameIcon size={s(18)} active={streak > 0} />
        <Text style={[styles.pillText, { fontSize: s(15) }]}>{streak}</Text>
      </Pill>
      {board && (
        <Pill>
          <Text style={[styles.pillText, { fontSize: s(15) }]}>{average === null ? '—' : `${average}%`}</Text>
        </Pill>
      )}
      {Platform.OS === 'web' && board && (
        <IconButton accessibilityLabel="Toggle full screen" size={s(42)} onPress={fullscreen}>
          <ExpandIcon size={s(18)} />
        </IconButton>
      )}
    </View>
  );

  const panel = finished ? (
    <Results
      s={s}
      board={board}
      answers={answers}
      average={average ?? 0}
      points={points}
      stars={stars}
      newBest={newBest}
      onAgain={restart}
      onHome={() => router.replace('/')}
    />
  ) : current ? (
    <Card lip={board ? 8 : 6} style={[board ? { width: s(360), padding: s(22), gap: s(14) } : [styles.sheet, { gap: 12 }], styles.panel]}>
      {/* content scrolls if it is taller than the screen; the action button below always stays visible */}
      <ScrollView style={styles.panelScroll} contentContainerStyle={{ gap: board ? s(16) : 12 }} showsVerticalScrollIndicator={false}>
      <View style={board ? { gap: s(16) } : { flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={board ? { gap: s(2) } : { flex: 1, gap: 2 }}>
          <Label size={s(11)}>{reviewing ? 'Result' : `Find & place this ${map.unit}`}</Label>
          <Text style={[styles.name, { fontSize: s(board ? 38 : 26), lineHeight: s(board ? 44 : 30) }]} numberOfLines={2}>
            {current.name}
          </Text>
          {!reviewing && (
            <Text style={[styles.sub, { fontSize: s(14) }]}>
              {dragging ? 'Drop it where you think it is!' : 'Drag the shape onto the map'}
            </Text>
          )}
        </View>

        <View
          ref={cardRef}
          onLayout={() => requestAnimationFrame(measure)}
          {...responder.panHandlers}
          style={[
            styles.tray,
            { width: cardBox + s(28), height: cardBox + s(28), borderRadius: s(20) },
            reviewing && { borderColor: colors.line, backgroundColor: colors.bg },
            Platform.OS === 'web' &&
              ({ cursor: reviewing ? 'default' : dragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' } as object),
          ]}
          accessibilityLabel={`Shape of ${current.name}. Drag it onto the map.`}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              opacity: dragging || reviewing ? 0.2 : 1,
              transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
            }}
          >
            <RegionShape region={current} scale={pieceScale} inline={mode === 'inline'} strokePx={board ? 2.5 : 2} depthPx={board ? 7 : 5} />
          </Animated.View>
        </View>
      </View>

      {answer && <ResultBlock answer={answer} s={s} board={board} streak={streak} map={map} mode={mode} />}
      </ScrollView>

      {reviewing ? (
        <Button
          label={index + 1 >= total ? 'See results' : 'Next'}
          variant={answer?.placement && answer.placement.accuracy >= 100 ? 'sun' : 'primary'}
          size={s(18)}
          onPress={next}
        />
      ) : (
        <View style={{ flexDirection: 'row', justifyContent: board ? 'flex-start' : 'flex-end' }}>
          <Button label="Skip" variant="soft" size={s(14)} onPress={skip} />
        </View>
      )}
    </Card>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View
        ref={rootRef}
        style={styles.root}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          rootSize.current = { w: width, h: height };
          setOverlay({ w: width, h: height });
          requestAnimationFrame(measure);
        }}
      >
        {topBar}
        <View style={[styles.body, board ? { flexDirection: 'row', padding: s(16), paddingTop: s(4), gap: s(16) } : { flexDirection: 'column' }]}>
          <View style={[styles.mapWrap, board ? { borderRadius: s(28) } : { marginHorizontal: 10, marginBottom: 10, borderRadius: 22 }]}>
            <OceanBackdrop />
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
            <View style={[styles.compass, { top: s(10), right: s(10) }]} pointerEvents="none">
              <CompassRose size={s(board ? 58 : 42)} />
            </View>
            {reviewing && answer?.placement && (
              <View style={[styles.mapLegend, { padding: s(8), gap: s(12) }]} pointerEvents="none">
                <LegendLine color={colors.primary} label="Your drop" size={s(12)} dashed />
                <LegendLine color={colors.mint} label="Real place" size={s(12)} />
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
                fill="rgba(108,71,255,0.45)"
                side="rgba(75,46,209,0.55)"
                stroke={colors.primary}
                strokePx={1.6}
                depthPx={4}
                shadow
              />
            </View>
            {/* ring marks the drop point — essential for tiny regions */}
            <View style={[styles.ring, { top: -lift - 15, left: -15 }]} />
          </Animated.View>
        )}

        {party && overlay.w > 0 && (
          <Celebration key={party.n} kind={party.kind} origin={party.origin} width={overlay.w} height={overlay.h} caption={party.caption} trigger={party.n} />
        )}
      </View>
    </SafeAreaView>
  );
}

function StarsRow({ count, size }: { count: number; size: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <StarIcon key={i} size={i === 1 ? size * 1.2 : size} filled={i < count} />
      ))}
    </View>
  );
}

function FocusIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill="#FFE2D6" />
      <Circle cx={12} cy={12} r={6.5} fill="none" stroke={colors.coral} strokeWidth={2.2} />
      <Circle cx={12} cy={12} r={2.6} fill={colors.coral} />
    </Svg>
  );
}

function ResultBlock({ answer, s, board, streak, map, mode }: { answer: Answer; s: (n: number) => number; board: boolean; streak: number; map: MapDefinition; mode: DiagramMode }) {
  const p = answer.placement;
  const r = rate(p?.accuracy ?? 0);
  const low = !p || p.accuracy < 50;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!low) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [low, pulse]);

  const districts = mode === 'inline' && answer.region.districts?.length ? ` · ${answer.region.districts.length} districts` : '';
  const distance = p ? (p.km < 10 ? 'Right on the spot' : `Off by ~${p.km.toLocaleString()} km`) : '';

  if (low) {
    // Motivating, calm feedback for a miss: no red alarm, a clear next step.
    return (
      <View style={[styles.motivate, { padding: s(14), gap: s(8), borderRadius: s(18) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
          <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
            <FocusIcon size={s(34)} />
          </Animated.View>
          <View style={{ flex: 1 }}>
            {p && (
              <Text style={[styles.pct, { fontSize: s(board ? 30 : 24), color: r.color }]}>
                {p.accuracy}% <Text style={{ fontSize: s(14), fontFamily: fonts.bodyBold }}>{distance}</Text>
              </Text>
            )}
            <Text style={[styles.motivateText, { fontSize: s(15) }]}>{answer.message}</Text>
          </View>
        </View>
        {answer.tip ? <Text style={[styles.tip, { fontSize: s(13) }]}>Tip: {answer.tip}</Text> : null}
      </View>
    );
  }

  return (
    <View style={{ gap: s(6) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
        <Text style={[styles.pct, { fontSize: s(board ? 52 : 38), color: r.color }]}>{p!.accuracy}%</Text>
        <View style={{ gap: 2 }}>
          <StarsRow count={r.stars} size={s(board ? 26 : 20)} />
          <Text style={[styles.rating, { fontSize: s(board ? 18 : 15), color: r.color }]}>{answer.message}</Text>
        </View>
      </View>
      <Text style={[styles.sub, { fontSize: s(14) }]}>
        {distance}
        {districts}
      </Text>
      <View style={{ flexDirection: 'row', gap: s(8), flexWrap: 'wrap' }}>
        <Pill style={{ backgroundColor: colors.primarySoft, borderColor: colors.primarySoft, borderBottomColor: '#D5CBFF' }}>
          <Text style={[styles.pillText, { fontSize: s(13), color: colors.primaryDark }]}>+{answer.points - answer.bonus} pts</Text>
        </Pill>
        {answer.bonus > 0 && (
          <Pill style={{ backgroundColor: '#FFF4EC', borderColor: '#FFD2B8', borderBottomColor: '#FFB48A' }}>
            <FlameIcon size={s(15)} />
            <Text style={[styles.pillText, { fontSize: s(13), color: '#C4561A' }]}>
              {streak} streak +{answer.bonus}
            </Text>
          </Pill>
        )}
      </View>
      {answer.tip ? <Text style={[styles.tip, { fontSize: s(13) }]}>Tip: {answer.tip}</Text> : null}
    </View>
  );
}

function LegendLine({ color, label, size, dashed }: { color: string; label: string; size: number; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: size * 1.8, height: 0, borderTopWidth: 3, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />
      <Text style={{ fontSize: size, color: colors.ink, fontFamily: fonts.bodyBold }}>{label}</Text>
    </View>
  );
}

function Results(props: {
  s: (n: number) => number;
  board: boolean;
  answers: Answer[];
  average: number;
  points: number;
  stars: number;
  newBest: boolean;
  onAgain: () => void;
  onHome: () => void;
}) {
  const { s, board, answers, average, points, stars, newBest } = props;
  const roundStars = average >= 90 ? 3 : average >= 70 ? 2 : average >= 45 ? 1 : 0;
  const message =
    average >= 90 ? 'Legendary explorer!' : average >= 70 ? 'Great expedition!' : average >= 45 ? 'Good effort!' : "Practice makes perfect — let's go again!";
  const counts = RATING_LEGEND.map((l) => ({ ...l, n: answers.filter((a) => rate(a.placement?.accuracy ?? 0).tier === l.tier).length }));
  const weak = answers.filter((a) => (a.placement?.accuracy ?? 0) < 50).map((a) => a.region.name).slice(0, 6);

  return (
    <Card lip={8} style={[board ? { width: s(360), padding: s(22) } : styles.sheet, { gap: s(14) }, styles.panel]}>
      <ScrollView style={styles.panelScroll} contentContainerStyle={{ gap: s(14) }} showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: 'center', gap: s(4) }}>
        <Label size={s(11)}>Round complete</Label>
        <StarsRow count={roundStars} size={s(board ? 44 : 34)} />
        <Text style={[styles.name, { fontSize: s(board ? 28 : 22), textAlign: 'center' }]}>{message}</Text>
        {newBest && (
          <Pill style={{ backgroundColor: colors.sun, borderColor: colors.sun, borderBottomColor: colors.sunDark }}>
            <Text style={[styles.pillText, { fontSize: s(13) }]}>NEW BEST!</Text>
          </Pill>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: s(10) }}>
        <Stat label="Accuracy" value={`${average}%`} color={rate(average).color} s={s} />
        <Stat label="Points" value={String(points)} color={colors.primary} s={s} />
        <Stat label="Stars" value={String(stars)} color={colors.sunDark} s={s} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(10), justifyContent: 'center' }}>
        {counts.map((c) => (
          <View key={c.tier} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: s(12), height: s(12), borderRadius: 4, backgroundColor: c.fill, borderBottomWidth: 2, borderBottomColor: c.side }} />
            <Text style={{ fontSize: s(13), color: colors.ink, fontFamily: fonts.body }}>
              {c.label} <Text style={{ fontFamily: fonts.black }}>{c.n}</Text>
            </Text>
          </View>
        ))}
      </View>
      {weak.length > 0 && (
        <Text style={[styles.tip, { fontSize: s(13), textAlign: 'center' }]}>Practise next: {weak.join(', ')}</Text>
      )}
      </ScrollView>
      <View style={{ gap: s(10) }}>
        <Button label="Play again" size={s(17)} onPress={props.onAgain} />
        <Button label="Choose map" variant="soft" size={s(16)} onPress={props.onHome} />
      </View>
    </Card>
  );
}

function Stat({ label, value, color, s }: { label: string; value: string; color: string; s: (n: number) => number }) {
  return (
    <View style={[styles.stat, { paddingVertical: s(8), borderRadius: s(14) }]}>
      <Text style={{ fontFamily: fonts.display, fontSize: s(24), color }}>{value}</Text>
      <Label size={s(10)}>{label}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center' },
  topTitle: { fontFamily: fonts.display, color: colors.ink, flexShrink: 1 },
  topCount: { fontFamily: fonts.black, color: colors.inkSoft },
  progressTrack: { borderRadius: 99, backgroundColor: colors.bgDeep, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: colors.primary, overflow: 'hidden' },
  progressShine: { position: 'absolute', left: 6, right: 6, top: 2, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  pillText: { fontFamily: fonts.black, color: colors.ink },
  body: { flex: 1 },
  mapWrap: {
    flex: 1,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
    borderBottomWidth: 7,
    borderBottomColor: '#8CCBE6',
  },
  mapInner: { flex: 1, margin: 8, alignItems: 'center', justifyContent: 'center' },
  compass: { position: 'absolute' },
  mapLegend: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
  },
  sheet: { marginHorizontal: 10, marginBottom: 8, padding: 14, maxHeight: '64%' },
  panel: { flexShrink: 1, overflow: 'hidden' },
  panelScroll: { flexGrow: 0, flexShrink: 1 },
  name: { fontFamily: fonts.display, color: colors.ink },
  sub: { fontFamily: fonts.body, color: colors.inkSoft, lineHeight: 20 },
  pct: { fontFamily: fonts.display, letterSpacing: -1 },
  rating: { fontFamily: fonts.display },
  tip: { fontFamily: fonts.body, color: colors.ink, lineHeight: 19 },
  motivate: { backgroundColor: '#FFF4EE', borderWidth: 2, borderColor: '#FFE0D2' },
  motivateText: { fontFamily: fonts.bodyBold, color: colors.ink, lineHeight: 20 },
  tray: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderWidth: 3,
    borderColor: '#C9BBFF',
    borderStyle: 'dashed',
    alignSelf: 'center',
  },
  stat: { flex: 1, alignItems: 'center', backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.line },
  floating: { position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' },
  ring: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 3, borderColor: colors.primary, backgroundColor: 'rgba(108,71,255,0.12)' },
});
