import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { OceanBackdrop } from '../../components/Backdrops';
import { Celebration, type CelebrationKind } from '../../components/Celebration';
import { FocusIcon, GameTopBar, Pulse, RoundResults, StarsRow, StatPill, gameStyles } from '../../components/GameUI';
import { CompassRose } from '../../components/icons';
import { Looping } from '../../components/Looping';
import { MapCanvas } from '../../components/MapCanvas';
import { useMapFrame } from '../../components/useMapFrame';
import { Button, Card, Label } from '../../components/ui';
import { INDIA, getView } from '../../data/maps';
import { cheer, shuffle } from '../../lib/game';
import { saveBest } from '../../lib/progress';
import { RIVERS, riverTier, scoreRiver, type River, type Stroke } from '../../lib/rivers';
import { playSfx } from '../../lib/sound';
import { colors, fonts, useLayoutMode } from '../../theme';

type Result = { river: River; score: number; points: number; strokes: Stroke[] };

const RIVER_BLUE = '#1E88E5';
const NO_SCORES: Record<string, number> = {};
const starsFor = (score: number) => ({ perfect: 3, great: 2, good: 1, close: 0, missed: 0 })[riverTier(score)];

export default function RiversGame() {
  // India only.
  const map = INDIA;
  const params = useLocalSearchParams<{ count?: string }>();
  const count = Number(params.count ?? 10) || 0;
  const { mode: layout, s } = useLayoutMode();
  const board = layout === 'board';
  const view = useMemo(() => getView(map), [map]);
  const frame = useMapFrame(view);

  const [round, setRound] = useState(0);
  const questions = useMemo(() => {
    const q = shuffle(RIVERS);
    return count > 0 ? q.slice(0, count) : q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, round]);
  const [index, setIndex] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [streak, setStreak] = useState(0);
  const [party, setParty] = useState<{ kind: CelebrationKind; origin: { x: number; y: number }; caption: string; n: number } | null>(null);
  const [newBest, setNewBest] = useState(false);

  const river = questions[index];
  const finished = index >= questions.length;
  const result = results.length > index ? results[index] : undefined;
  const checked = !!result;
  const stars = results.reduce((n, r) => n + starsFor(r.score), 0);
  const points = results.reduce((n, r) => n + r.points, 0);
  const average = results.length ? Math.round(results.reduce((n, r) => n + r.score, 0) / results.length) : null;
  const drawnLength = strokes.reduce((n, st) => n + st.slice(1).reduce((m, p, i) => m + Math.hypot(p[0] - st[i][0], p[1] - st[i][1]), 0), 0);
  const canCheck = drawnLength * frame.scale > 30;

  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(null), party.kind === 'perfect' ? 3000 : 1800);
    return () => clearTimeout(t);
  }, [party]);

  useEffect(() => {
    if (!finished || !results.length || average === null) return;
    playSfx('complete');
    saveBest('rivers-india', 'inline', undefined, average).then(setNewBest);
    if (average >= 70)
      setParty({ kind: average >= 85 ? 'perfect' : 'great', origin: { x: frame.rootSize.w / 2, y: frame.rootSize.h / 2 }, caption: 'River expert!', n: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // ---- freehand drawing on the map -----------------------------------------------
  const live = useRef({ locked: false, strokes: [] as Stroke[] });
  live.current.locked = checked || finished;
  const lastPt = useRef<[number, number] | null>(null);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !live.current.locked,
        onMoveShouldSetPanResponder: () => !live.current.locked,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_e, g) => {
          frame.measure();
          const m = frame.pageToMap(g.x0, g.y0);
          lastPt.current = [m.x, m.y];
          setStrokes((cur) => [...cur, [[m.x, m.y]]]);
        },
        onPanResponderMove: (_e, g) => {
          const m = frame.pageToMap(g.moveX, g.moveY);
          const last = lastPt.current;
          // skip tiny moves so the line stays light (≈2 px apart)
          if (last && Math.hypot(m.x - last[0], m.y - last[1]) * frame.scale < 2) return;
          lastPt.current = [m.x, m.y];
          setStrokes((cur) => {
            const next = cur.slice();
            next[next.length - 1] = [...next[next.length - 1], [m.x, m.y]];
            return next;
          });
        },
        onPanResponderRelease: () => (lastPt.current = null),
        onPanResponderTerminate: () => (lastPt.current = null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frame.scale, frame.inset.left, frame.inset.top],
  );

  const clear = () => {
    playSfx('tap');
    setStrokes([]);
  };

  const check = () => {
    if (!river || checked || !canCheck) return;
    const { score } = scoreRiver(river, strokes, frame.scale);
    const tier = riverTier(score);
    const nextStreak = score >= 75 ? streak + 1 : 0;
    const bonus = score >= 75 && nextStreak >= 2 ? Math.min(nextStreak, 5) * 10 : 0;
    setStreak(nextStreak);
    setResults((r) => [...r, { river, score, points: score + bonus, strokes }]);
    const mid = river.pts[Math.floor(river.pts.length / 2)];
    const at = frame.toRoot(mid[0], mid[1]);
    playSfx(tier === 'perfect' ? 'perfect' : tier === 'great' ? 'great' : tier === 'good' ? 'correct' : 'wrong');
    if (tier === 'perfect' || tier === 'great' || tier === 'good') {
      setParty({ kind: tier, origin: at, caption: tier === 'perfect' ? cheer('perfect') : '', n: Date.now() });
      if (tier !== 'good' && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const next = () => {
    playSfx('tap');
    setParty(null);
    setStrokes([]);
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setStrokes([]);
    setResults([]);
    setStreak(0);
    setParty(null);
    setNewBest(false);
  };

  const total = questions.length;
  const px = (n: number) => n / (frame.scale || 1);
  const toD = (st: Stroke[]) => st.filter((x) => x.length).map((x) => 'M' + x.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join('L')).join('');

  const panel = finished ? (
    <RoundResults
      s={s}
      board={board}
      scores={results.map((r) => r.score)}
      names={results.map((r) => r.river.name)}
      points={points}
      stars={stars}
      newBest={newBest}
      hideBreakdown
      onAgain={restart}
      onHome={() => router.replace('/')}
    />
  ) : river ? (
    <Card lip={board ? 8 : 6} style={[board ? { width: s(360), padding: s(22), gap: s(14) } : [gameStyles.sheet, { gap: 10 }], gameStyles.panel]}>
      <ScrollView style={gameStyles.panelScroll} contentContainerStyle={{ gap: board ? s(12) : 8 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: s(2) }}>
          <Label size={s(11)}>{checked ? 'Result' : 'Draw this river'}</Label>
          <Text style={[gameStyles.name, { fontSize: s(board ? 34 : 24), lineHeight: s(board ? 40 : 28) }]}>{river.name}</Text>
          {!checked && (
            <Text style={[gameStyles.sub, { fontSize: s(14) }]}>
              Start at the green dot and draw the river’s path with your finger or mouse.
            </Text>
          )}
        </View>
        {result && <RiverResult result={result} s={s} board={board} />}
      </ScrollView>
      {checked ? (
        <Button label={index + 1 >= total ? 'See results' : 'Next river'} variant={riverTier(result!.score) === 'perfect' ? 'sun' : 'primary'} size={s(18)} onPress={next} />
      ) : (
        <View style={{ flexDirection: 'row', gap: s(10) }}>
          <Button label="Clear" variant="soft" size={s(15)} onPress={clear} disabled={!strokes.length} style={{ flex: 1 }} />
          <Button label="Check my river" variant="primary" size={s(15)} onPress={check} disabled={!canCheck} style={{ flex: 2 }} />
        </View>
      )}
    </Card>
  ) : null;

  return (
    <SafeAreaView style={gameStyles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View ref={frame.rootRef} style={gameStyles.root} onLayout={frame.onRootLayout}>
        <GameTopBar
          s={s}
          board={board}
          title="India Rivers"
          subtitle="Draw it"
          done={results.length}
          total={total}
          stars={stars}
          streak={streak}
          extra={<StatPill s={s}>{average === null ? '—' : `${average}%`}</StatPill>}
        />
        <View style={[gameStyles.body, board ? { flexDirection: 'row', padding: s(16), paddingTop: s(4), gap: s(16) } : { flexDirection: 'column' }]}>
          <View style={[gameStyles.mapWrap, board ? { borderRadius: s(28) } : { marginHorizontal: 10, marginBottom: 10, borderRadius: 22 }]}>
            <OceanBackdrop />
            <View ref={frame.mapRef} style={gameStyles.mapInner} onLayout={frame.onMapLayout}>
              {frame.scale > 0 && (
                <>
                  <MapCanvas data={map.data} view={view} scale={frame.scale} scores={NO_SCORES} showBorders showInner={false} />
                  {/* rivers, drawing and the start dot, in map units */}
                  <View
                    {...responder.panHandlers}
                    style={[
                      { position: 'absolute', left: frame.inset.left, top: frame.inset.top, width: view.w * frame.scale, height: view.h * frame.scale },
                      Platform.OS === 'web' && ({ cursor: checked ? 'default' : 'crosshair', touchAction: 'none', userSelect: 'none' } as object),
                    ]}
                    accessibilityLabel={river ? `Draw the ${river.name} here` : 'Map'}
                  >
                    <Svg width={view.w * frame.scale} height={view.h * frame.scale} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} pointerEvents="none">
                      {/* rivers already done this round stay on the map */}
                      {results.map((r) => (
                        <Path key={r.river.id} d={r.river.d} fill="none" stroke={RIVER_BLUE} strokeOpacity={0.45} strokeWidth={px(2.5)} strokeLinecap="round" strokeLinejoin="round" />
                      ))}
                      {result && river && (
                        <G>
                          <Path d={river.d} fill="none" stroke="#fff" strokeWidth={px(8)} strokeLinecap="round" strokeLinejoin="round" />
                          <Path d={river.d} fill="none" stroke={RIVER_BLUE} strokeWidth={px(4.5)} strokeLinecap="round" strokeLinejoin="round" />
                        </G>
                      )}
                      {strokes.length > 0 && (
                        <Path
                          d={toD(strokes)}
                          fill="none"
                          stroke={colors.primary}
                          strokeWidth={px(result ? 3 : 4.5)}
                          strokeDasharray={result ? `${px(7)} ${px(5)}` : undefined}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={0.95}
                        />
                      )}
                      {river && (
                        <G>
                          <Circle cx={river.start[0]} cy={river.start[1]} r={px(9)} fill="#fff" />
                          <Circle cx={river.start[0]} cy={river.start[1]} r={px(6.5)} fill={colors.mint} />
                        </G>
                      )}
                    </Svg>
                    {river && !checked && (
                      <Looping
                        pointerEvents="none"
                        style={{
                          position: 'absolute',
                          left: (river.start[0] - view.x) * frame.scale - 18,
                          top: (river.start[1] - view.y) * frame.scale - 18,
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          borderWidth: 3,
                          borderColor: colors.mint,
                        }}
                        from={{ transform: [{ scale: 0.6 }], opacity: 1 }}
                        to={{ transform: [{ scale: 1.5 }], opacity: 0 }}
                        duration={1400}
                      />
                    )}
                  </View>
                </>
              )}
            </View>
            <View style={[gameStyles.compass, { top: s(10), right: s(10) }]} pointerEvents="none">
              <CompassRose size={s(board ? 58 : 42)} />
            </View>
            {result && (
              <View style={[gameStyles.mapLegend, { padding: s(8), gap: s(12) }]} pointerEvents="none">
                <Legend color={colors.primary} label="Your river" size={s(12)} dashed />
                <Legend color={RIVER_BLUE} label={`The real ${river?.name ?? 'river'}`} size={s(12)} />
              </View>
            )}
          </View>
          {panel}
        </View>
        {party && frame.rootSize.w > 0 && (
          <Celebration key={party.n} kind={party.kind} origin={party.origin} width={frame.rootSize.w} height={frame.rootSize.h} caption={party.caption} trigger={party.n} />
        )}
      </View>
    </SafeAreaView>
  );
}

function Legend({ color, label, size, dashed }: { color: string; label: string; size: number; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: size * 1.8, height: 0, borderTopWidth: 3, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />
      <Text style={{ fontSize: size, color: colors.ink, fontFamily: fonts.bodyBold }}>{label}</Text>
    </View>
  );
}

const TIER_COLOR = { perfect: '#B07A00', great: '#13895A', good: '#2F6FC0', close: '#C15A1C', missed: '#C93A3A' };

function RiverResult({ result, s, board }: { result: Result; s: (n: number) => number; board: boolean }) {
  const tier = riverTier(result.score);
  const flows = `The ${result.river.name} flows through ${result.river.states.join(' → ')}.`;
  if (tier === 'close' || tier === 'missed') {
    return (
      <View style={[gameStyles.motivate, { padding: s(14), gap: s(8), borderRadius: s(18) }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
          <Pulse>
            <FocusIcon size={s(34)} />
          </Pulse>
          <View style={{ flex: 1 }}>
            <Text style={[gameStyles.pct, { fontSize: s(board ? 30 : 24), color: TIER_COLOR[tier] }]}>{result.score}%</Text>
            <Text style={[gameStyles.motivateText, { fontSize: s(15) }]}>{cheer(tier)}</Text>
          </View>
        </View>
        <Text style={[gameStyles.tip, { fontSize: s(13) }]}>Tip: {flows}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: s(6) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
        <Text style={[gameStyles.pct, { fontSize: s(board ? 52 : 38), color: TIER_COLOR[tier] }]}>{result.score}%</Text>
        <View style={{ gap: 2 }}>
          <StarsRow count={starsFor(result.score)} size={s(board ? 26 : 20)} />
          <Text style={{ fontFamily: fonts.display, fontSize: s(board ? 18 : 15), color: TIER_COLOR[tier] }}>{cheer(tier)}</Text>
        </View>
      </View>
      <Text style={[gameStyles.sub, { fontSize: s(13) }]}>+{result.points} pts</Text>
      <Text style={[gameStyles.tip, { fontSize: s(13) }]}>{flows}</Text>
    </View>
  );
}

