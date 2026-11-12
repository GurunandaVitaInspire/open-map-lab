import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OceanBackdrop } from '../../components/Backdrops';
import { Celebration, type CelebrationKind } from '../../components/Celebration';
import { FocusIcon, GameTopBar, NATIVE, Pulse, RoundResults, StarsRow, StatPill, gameStyles } from '../../components/GameUI';
import { CompassRose } from '../../components/icons';
import { MapCanvas } from '../../components/MapCanvas';
import { RegionHighlight } from '../../components/RegionHighlight';
import { useMapFrame } from '../../components/useMapFrame';
import { Button, Card, Label } from '../../components/ui';
import { MAPS, getView, type Region } from '../../data/maps';
import { buildQuestions, quizOptions, quizScore, regionWhere, shuffle, type DiagramMode } from '../../lib/game';
import { saveBest } from '../../lib/progress';
import { playSfx } from '../../lib/sound';
import { colors, fonts, rate, useLayoutMode } from '../../theme';

/** One question: the blinking state, its four options, and what the student has tried so far. */
type Question = { region: Region; options: Region[] };
type Result = { region: Region; tries: number; score: number; points: number };

const EUREKA = ['Eureka!', 'Spot on!', 'Brilliant!', 'You got it!', 'Map master!'];

export default function Quiz() {
  // This game is India only.
  const map = MAPS.india;
  const params = useLocalSearchParams<{ mode?: string; count?: string }>();
  const mode: DiagramMode = params.mode === 'inline' ? 'inline' : 'outline';
  const count = Number(params.count ?? 10) || 0;
  const { mode: layout, s } = useLayoutMode();
  const board = layout === 'board';
  const view = useMemo(() => getView(map), [map]);
  const frame = useMapFrame(view);

  const [round, setRound] = useState(0);
  const questions: Question[] = useMemo(
    () => buildQuestions(map, { mapId: 'india', mode, count }).map((region) => ({ region, options: quizOptions(map, region) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, count, round],
  );
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]); // option ids tried and wrong for the current question
  const [results, setResults] = useState<Result[]>([]);
  const [streak, setStreak] = useState(0);
  const [party, setParty] = useState<{ kind: CelebrationKind; origin: { x: number; y: number }; caption: string; n: number } | null>(null);
  const [newBest, setNewBest] = useState(false);

  const q = questions[index];
  const finished = index >= questions.length;
  const result = results.length > index ? results[index] : undefined;
  const solved = !!result;

  const scores = useMemo(() => Object.fromEntries(results.map((r) => [r.region.id, r.score])), [results]);
  const stars = results.reduce((n, r) => n + rate(r.score).stars, 0);
  const points = results.reduce((n, r) => n + r.points, 0);
  const average = results.length ? Math.round(results.reduce((n, r) => n + r.score, 0) / results.length) : null;

  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(null), party.kind === 'perfect' ? 3000 : 1800);
    return () => clearTimeout(t);
  }, [party]);

  useEffect(() => {
    if (!finished || !results.length || average === null) return;
    playSfx('complete');
    saveBest('quiz-india', mode, undefined, average).then(setNewBest);
    if (average >= 70)
      setParty({ kind: average >= 90 ? 'perfect' : 'great', origin: { x: frame.rootSize.w / 2, y: frame.rootSize.h / 2 }, caption: 'Round complete!', n: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const pick = (opt: Region) => {
    if (!q || solved || wrong.includes(opt.id)) return;
    if (opt.id !== q.region.id) {
      playSfx('wrong');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setWrong((w) => [...w, opt.id]);
      setStreak(0);
      return;
    }
    const tries = wrong.length + 1;
    const score = quizScore(tries);
    const nextStreak = tries === 1 ? streak + 1 : 0;
    const bonus = tries === 1 && nextStreak >= 2 ? Math.min(nextStreak, 5) * 10 : 0;
    setStreak(nextStreak);
    setResults((r) => [...r, { region: q.region, tries, score, points: score + bonus }]);
    const at = frame.toRoot(q.region.cx, q.region.cy);
    if (tries === 1) {
      playSfx('perfect');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setParty({ kind: 'perfect', origin: at, caption: shuffle(EUREKA)[0], n: Date.now() });
    } else if (tries === 2) {
      playSfx('great');
      setParty({ kind: 'great', origin: at, caption: '', n: Date.now() });
    } else {
      playSfx('correct');
      setParty({ kind: 'good', origin: at, caption: '', n: Date.now() });
    }
  };

  const next = () => {
    playSfx('tap');
    setParty(null);
    setWrong([]);
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setRound((r) => r + 1);
    setIndex(0);
    setWrong([]);
    setResults([]);
    setStreak(0);
    setParty(null);
    setNewBest(false);
  };

  const total = questions.length;
  const hint =
    q && !solved && wrong.length >= 1
      ? wrong.length === 1
        ? `Hint: it is ${regionWhere(map, q.region)}.`
        : (() => {
            const n = q.region.neighbors?.map((id) => map.data.regions.find((r) => r.id === id)?.name).filter(Boolean) ?? [];
            const notOption = n.filter((name) => !q.options.some((o) => o.name === name));
            const shown = (notOption.length ? notOption : n)[0];
            return shown ? `Hint: it shares a border with ${shown}.` : `Hint: it is ${regionWhere(map, q.region)}.`;
          })()
      : '';

  const panel = finished ? (
    <RoundResults
      s={s}
      board={board}
      scores={results.map((r) => r.score)}
      names={results.map((r) => r.region.name)}
      points={points}
      stars={stars}
      newBest={newBest}
      onAgain={restart}
      onHome={() => router.replace('/')}
    />
  ) : q ? (
    <Card lip={board ? 8 : 6} style={[board ? { width: s(380), padding: s(22), gap: s(14) } : [gameStyles.sheet, { gap: 10 }], gameStyles.panel]}>
      <ScrollView style={gameStyles.panelScroll} contentContainerStyle={{ gap: board ? s(14) : 10 }} showsVerticalScrollIndicator={false}>
        <View style={{ gap: s(2) }}>
          <Label size={s(11)}>{solved ? 'Correct!' : 'Name the blinking state'}</Label>
          <Text style={[gameStyles.name, { fontSize: s(board ? 30 : 22), lineHeight: s(board ? 36 : 27) }]}>
            {solved ? q.region.name : 'Which state is this?'}
          </Text>
        </View>

        <View style={[styles.grid, { gap: s(10) }]}>
          {q.options.map((o) => (
            <OptionButton
              key={o.id}
              label={o.name}
              s={s}
              board={board}
              state={o.id === q.region.id && solved ? 'right' : wrong.includes(o.id) ? 'wrong' : solved ? 'idle-done' : 'idle'}
              onPress={() => pick(o)}
            />
          ))}
        </View>

        {!solved && hint ? (
          <View style={[gameStyles.motivate, { padding: s(12), borderRadius: s(16), flexDirection: 'row', alignItems: 'center', gap: s(10) }]}>
            <Pulse>
              <FocusIcon size={s(28)} />
            </Pulse>
            <Text style={[gameStyles.motivateText, { fontSize: s(14), flex: 1 }]}>
              Not that one — you can do it! {hint}
            </Text>
          </View>
        ) : null}

        {result && <QuizResult result={result} s={s} board={board} streak={streak} />}
      </ScrollView>

      {solved && <Button label={index + 1 >= total ? 'See results' : 'Next'} variant={result?.tries === 1 ? 'sun' : 'primary'} size={s(18)} onPress={next} />}
    </Card>
  ) : null;

  return (
    <SafeAreaView style={gameStyles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <View ref={frame.rootRef} style={gameStyles.root} onLayout={frame.onRootLayout}>
        <GameTopBar
          s={s}
          board={board}
          title="Name it · India"
          subtitle={mode === 'inline' ? 'Inline' : 'Outline'}
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
                  <MapCanvas data={map.data} view={view} scale={frame.scale} scores={scores} showBorders={mode === 'inline'} showInner={mode === 'inline'} />
                  {q && !solved && (
                    <RegionHighlight region={q.region} view={view} scale={frame.scale} inset={frame.inset} color={colors.primary} blink />
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
        {party && frame.rootSize.w > 0 && (
          <Celebration key={party.n} kind={party.kind} origin={party.origin} width={frame.rootSize.w} height={frame.rootSize.h} caption={party.caption} trigger={party.n} />
        )}
      </View>
    </SafeAreaView>
  );
}

type OptionState = 'idle' | 'idle-done' | 'wrong' | 'right';

/** Big chunky answer button; shakes when wrong, glows green when right. */
function OptionButton({ label, state, onPress, s, board }: { label: string; state: OptionState; onPress: () => void; s: (n: number) => number; board: boolean }) {
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state === 'wrong') {
      shake.setValue(0);
      Animated.sequence(
        [10, -10, 7, -7, 3, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 55, useNativeDriver: NATIVE })),
      ).start();
    }
    if (state === 'right') {
      pop.setValue(0.9);
      Animated.spring(pop, { toValue: 1, friction: 3, tension: 160, useNativeDriver: NATIVE }).start();
    }
  }, [state, shake, pop]);

  const palette =
    state === 'right'
      ? { bg: colors.mint, lip: '#119E76', text: '#fff', border: colors.mint }
      : state === 'wrong'
        ? { bg: '#FFE4E1', lip: '#F4B4AC', text: '#B7413A', border: '#F4B4AC' }
        : { bg: colors.surface, lip: colors.surfaceLip, text: colors.ink, border: colors.line };
  const disabled = state !== 'idle';
  return (
    <Animated.View style={{ width: '48%', flexGrow: 1, transform: [{ translateX: shake }, { scale: pop }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, selected: state === 'right' }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.option,
          {
            minHeight: s(board ? 66 : 58),
            borderRadius: s(18),
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderBottomColor: palette.lip,
            borderBottomWidth: pressed ? 2 : 6,
            marginTop: pressed ? 4 : 0,
            paddingHorizontal: s(10),
            opacity: state === 'idle-done' ? 0.5 : 1,
          },
        ]}
      >
        <Text style={{ fontFamily: fonts.black, fontSize: s(board ? 17 : 15), color: palette.text, textAlign: 'center' }} numberOfLines={2}>
          {state === 'right' ? `✓ ${label}` : label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function QuizResult({ result, s, board, streak }: { result: Result; s: (n: number) => number; board: boolean; streak: number }) {
  const r = rate(result.score);
  const map = MAPS.india;
  const neighbours = (result.region.neighbors ?? []).map((id) => map.data.regions.find((x) => x.id === id)?.name).filter(Boolean);
  const line =
    result.tries === 1 ? 'First try — perfect!' : result.tries === 2 ? 'Second try — well done!' : 'You found it — keep practising!';
  return (
    <View style={{ gap: s(6) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
        <StarsRow count={r.stars} size={s(board ? 28 : 22)} />
        <Text style={{ fontFamily: fonts.display, fontSize: s(board ? 18 : 15), color: r.color, flex: 1 }}>{line}</Text>
      </View>
      <Text style={[gameStyles.sub, { fontSize: s(13) }]}>
        +{result.points} pts{result.points > result.score ? ` (includes ${streak}-in-a-row streak bonus)` : ''}
      </Text>
      {neighbours.length > 0 && (
        <Text style={[gameStyles.tip, { fontSize: s(13) }]}>
          Neighbours: {neighbours.join(', ')}
        </Text>
      )}
      <Text style={[gameStyles.tip, { fontSize: s(13) }]}>
        {result.region.group === 'Union Territory' ? 'Union territory' : 'State'}
        {result.region.districts?.length ? ` · ${result.region.districts.length} districts` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  option: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, paddingVertical: 8 },
});
