import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { GameArt, type ArtKind } from '../components/GameArt';
import { SoundButtons } from '../components/GameUI';
import { HangingCards, type HangingItem } from '../components/home/HangingCards';
import { RealSea } from '../components/home/RealSea';
import { SideScenes, SkyClouds } from '../components/home/Sky';
import { TitleWord } from '../components/home/TitleWord';
import { Looping } from '../components/Looping';
import { SetupSheet, type ChoiceGroup } from '../components/home/SetupSheet';
import { MotionIcon, StarIcon } from '../components/icons';
import { Button, IconButton } from '../components/ui';
import { MAP_META, prefetchMap } from '../data/maps';
import type { DiagramMode } from '../lib/game';
import { toggleMotion, useMotion, useMotionPreference } from '../lib/motion';
import { getBestAny } from '../lib/progress';
import { playSfx } from '../lib/sound';
import { colors, fonts, useLayoutMode } from '../theme';

const NATIVE = Platform.OS !== 'web';

type QuestKey = 'jigsaw' | 'quiz' | 'drag' | 'rivers' | 'quizWorld' | 'world';
type Quest = {
  key: QuestKey;
  game: 'place' | 'quiz' | 'puzzle' | 'rivers';
  map: 'india' | 'world';
  art: ArtKind;
  title: string;
  subtitle: string;
  tint: string;
  clip: string;
  clipDark: string;
  bestKey: string;
};

// Row 1: India games. Row 2: rivers + the world games.
const QUESTS: Quest[] = [
  { key: 'jigsaw', game: 'puzzle', map: 'india', art: 'puzzle', title: 'India Jigsaw', subtitle: 'Build the labelled map piece by piece', tint: '#FFF3D6', clip: colors.sun, clipDark: colors.sunDark, bestKey: 'puzzle-india' },
  { key: 'quiz', game: 'quiz', map: 'india', art: 'quiz', title: 'Name the State', subtitle: 'Spot the blinking state, pick its name', tint: '#E3F7EE', clip: colors.mint, clipDark: '#119E76', bestKey: 'quiz-india' },
  { key: 'drag', game: 'place', map: 'india', art: 'place', title: 'Drag the State', subtitle: 'Drag every state to its home', tint: '#EEE9FF', clip: colors.primary, clipDark: colors.primaryDark, bestKey: 'india' },
  { key: 'rivers', game: 'rivers', map: 'india', art: 'rivers', title: 'India Rivers', subtitle: 'Draw where each river flows', tint: '#E1F1FD', clip: '#1E88E5', clipDark: '#1565C0', bestKey: 'rivers-india' },
  { key: 'quizWorld', game: 'quiz', map: 'world', art: 'quiz-world', title: 'Name the Country', subtitle: 'Spot the blinking country, pick its name', tint: '#FFE9E6', clip: colors.coral, clipDark: '#E0504F', bestKey: 'quiz-world' },
  { key: 'world', game: 'place', map: 'world', art: 'world', title: 'World Explorer', subtitle: 'Drag countries onto the world map', tint: '#DFF1FB', clip: colors.sky, clipDark: '#2B7FD1', bestKey: 'world' },
];

const FEATURES = ['100% free', 'Open source', 'No sign-up', 'No ads', 'Works on smartboards', 'India & World maps', 'Made for classrooms', 'by VitaInspire'];

const starsFor = (best: number | null) => (best === null ? 0 : best >= 90 ? 3 : best >= 70 ? 2 : best >= 45 ? 1 : 0);

export default function Home() {
  const { mode: layout, s, width, height } = useLayoutMode();
  const board = layout === 'board';
  const [bests, setBests] = useState<Record<string, number | null>>({});
  const [open, setOpen] = useState<QuestKey | null>(null);
  const [mode, setMode] = useState<DiagramMode>('outline');
  const [group, setGroup] = useState('');
  const [count, setCount] = useState('10');
  const [pieces, setPieces] = useState('12');
  const [guide, setGuide] = useState<'on' | 'off'>('on');

  useFocusEffect(
    useCallback(() => {
      Promise.all(QUESTS.map(async (q) => [q.bestKey, await getBestAny(q.bestKey)] as const)).then((rows) => setBests(Object.fromEntries(rows)));
    }, []),
  );

  const quest = QUESTS.find((q) => q.key === open) ?? QUESTS[0];
  // On big screens size the cards so both ropes (all six games) fit in the first screen.
  // how far each rope dips under its three cards: a real line sags more the longer it is (~3.4% of
  // the span on big screens), within limits so both rows still fit on one screen
  const ropeSag = board ? Math.max(s(44), Math.min(s(84), (width + 60) * 0.034)) : 36;
  const cardW = Math.max(s(150), Math.min(s(250), ((height - s(215)) / 2 - s(42) - ropeSag) / 0.98));
  // the empty margin on each side of a rope of three cards (same maths as HangingCards)
  const rowCardW = Math.min(cardW, (width - s(30) * 2 - s(26) * 2) / 3);
  const sideW = (width - (rowCardW * 3 + s(26) * 2)) / 2;
  const [ropesH, setRopesH] = useState(0);
  const items: HangingItem[] = QUESTS.map((q) => ({
    key: q.key,
    title: q.title,
    subtitle: q.subtitle,
    art: <GameArt kind={q.art} />,
    tint: q.tint,
    clip: q.clip,
    clipDark: q.clipDark,
    stars: starsFor(bests[q.bestKey] ?? null),
    note: bests[q.bestKey] != null ? `Best ${bests[q.bestKey]}%` : undefined,
  }));

  const openQuest = (key: string) => {
    playSfx('tap');
    const q = QUESTS.find((x) => x.key === key);
    if (q?.map === 'world') prefetchMap('world'); // download while the setup sheet is open
    setGroup('');
    setOpen(key as QuestKey);
  };

  const play = () => {
    playSfx('tap');
    setOpen(null);
    if (quest.game === 'quiz') router.push({ pathname: '/quiz/[map]', params: { map: quest.map, mode, count, group } });
    else if (quest.game === 'rivers') router.push({ pathname: '/rivers/[map]', params: { map: 'india', count } });
    else if (quest.game === 'puzzle') router.push({ pathname: '/puzzle/[map]', params: { map: 'india', mode: guide === 'on' ? 'inline' : 'outline', count: pieces } });
    else router.push({ pathname: '/play/[map]', params: { map: quest.map, mode, group, count } });
  };

  const tapSet = (fn: (v: string) => void) => (v: string) => {
    playSfx('tap');
    fn(v);
  };
  const styleGroup: ChoiceGroup = {
    label: 'Map style',
    options: [
      { label: 'Outline', value: 'outline' },
      { label: 'Inline', value: 'inline' },
    ],
    value: mode,
    onChange: tapSet((v) => setMode(v as DiagramMode)),
    help:
      quest.game === 'quiz'
        ? quest.map === 'world'
          ? mode === 'outline'
            ? 'Only coastlines and the blinking country are shown.'
            : 'All country borders are shown — easier for beginners.'
          : mode === 'outline'
            ? 'Only India’s border and the blinking state are shown.'
            : 'All state borders are shown — easier for beginners.'
        : MAP_META[quest.map].modeHelp[mode],
  };
  const countGroup: ChoiceGroup = {
    label: 'Questions',
    options: [
      { label: '10', value: '10' },
      { label: '20', value: '20' },
      { label: 'All', value: '0' },
    ],
    value: count,
    onChange: tapSet(setCount),
  };
  const groups: ChoiceGroup[] =
    quest.game === 'puzzle'
      ? [
          {
            label: 'Pieces',
            options: [
              { label: '12 · Easy', value: '12' },
              { label: '20 · Medium', value: '20' },
              { label: '30 · Hard', value: '30' },
            ],
            value: pieces,
            onChange: tapSet(setPieces),
          },
          {
            label: 'Picture guide',
            options: [
              { label: 'On', value: 'on' },
              { label: 'Off', value: 'off' },
            ],
            value: guide,
            onChange: tapSet((v) => setGuide(v as 'on' | 'off')),
            help: guide === 'on' ? 'A faint copy of the map on the board shows where pieces go.' : 'An empty board — use the state names on each piece.',
          },
        ]
      : quest.game === 'rivers'
        ? [
            {
              label: 'Rivers',
              options: [
                { label: '10', value: '10' },
                { label: 'All 20', value: '0' },
              ],
              value: count === '0' ? '0' : '10',
              onChange: tapSet(setCount),
            },
          ]
      : quest.map === 'world'
        ? [
            styleGroup,
            {
              label: 'Region',
              options: [{ label: 'Whole world', value: '' }, ...(MAP_META.world.groups ?? []).map((g) => ({ label: g, value: g }))],
              value: group,
              onChange: tapSet(setGroup),
            },
            countGroup,
          ]
        : [styleGroup, countGroup];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          {/* ---- hero ---- */}
          <View>
            <HeroBackground />
            <SkyClouds board={board} />
            <NavBar s={s} board={board} />
            <View style={[styles.hero, { paddingHorizontal: s(20), paddingTop: s(board ? 4 : 8), gap: s(10) }]}>
              <Headline s={s} board={board} width={width} />
              <FadeIn delay={520}>
                <View style={[board ? styles.subRow : styles.subCol, { gap: s(board ? 18 : 10) }]}>
                  <Text style={[styles.sub, { fontSize: s(board ? 17 : 15) }]}>
                    6 free games: drag, spot, build and draw your way across India and the world.
                  </Text>
                  <Button label="Start playing" variant="primary" size={s(board ? 16 : 17)} onPress={() => openQuest(QUESTS[0].key)} />
                </View>
              </FadeIn>
            </View>
            {/* two ropes of three games each, so all six are visible at once on big screens;
                the real Earth and hot-air balloons fill the empty margins beside them */}
            <View onLayout={(e) => setRopesH(e.nativeEvent.layout.height)}>
            {[items.slice(0, 3), items.slice(3, 6)].map((row, r) => (
              <View key={r} style={{ marginTop: r === 0 ? s(board ? 6 : 8) : board ? -s(6) : 4 }}>
                <HangingCards
                  items={row}
                  onPick={openQuest}
                  board={board}
                  s={s}
                  maxCardW={board ? cardW : 172}
                  ratio={board ? 0.98 : 1.32}
                  artRatio={board ? 0.55 : 0.72}
                  sag={ropeSag}
                  delayBase={r * 380}
                  showSwipe={!board && r === 1}
                />
              </View>
            ))}
            {/* in front of the ropes (like the cards), but only in the empty margins */}
            {board && <SideScenes side={sideW} height={ropesH} s={s} />}
            </View>
          </View>

          {/* ---- the sea: real ocean footage, fading out of the sky's haze ---- */}
          <View style={{ flexGrow: 1, backgroundColor: '#0E5C6E' }}>
            <RealSea height={board ? s(290) : 250}>
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
                <Defs>
                  <LinearGradient id="sea-haze" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#F2F9FF" stopOpacity={1} />
                    <Stop offset="0.16" stopColor="#E3F2FB" stopOpacity={0.55} />
                    <Stop offset="0.42" stopColor="#E3F2FB" stopOpacity={0} />
                    <Stop offset="0.7" stopColor="#06303D" stopOpacity={0} />
                    <Stop offset="1" stopColor="#06303D" stopOpacity={0.55} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#sea-haze)" />
              </Svg>
              <View style={{ flex: 1, justifyContent: 'flex-end', paddingVertical: s(22), gap: s(16) }}>
                <Ticker s={s} />
                <Text style={[styles.footer, { fontSize: s(12), paddingHorizontal: s(20) }]}>
                  Map data: Natural Earth (public domain) · India states & districts: udit-001/india-maps-data{'\n'}
                  Sounds & music: Kenney and TinyWorlds (CC0) · Earth: NASA · Sea, clouds & balloon: CC0 · Made with care by VitaInspire
                </Text>
              </View>
            </RealSea>
          </View>
        </ScrollView>

        <SetupSheet
          open={open !== null}
          onClose={() => setOpen(null)}
          title={quest.title}
          subtitle={quest.subtitle}
          art={<GameArt kind={quest.art} />}
          tint={quest.tint}
          groups={groups}
          note={
            quest.game === 'puzzle'
              ? 'Pieces come out of the box a few at a time. Drag them onto the board, or tap a piece and then tap its spot.'
              : quest.game === 'rivers'
                ? 'Start at the green dot and draw the river with your finger or mouse. Faint state borders help you find your way.'
                : undefined
          }
          playLabel={`Play ${quest.title}`}
          onPlay={play}
          board={board}
          s={s}
        />
      </View>
    </SafeAreaView>
  );
}

// ---- pieces of the landing page ----------------------------------------------------

function NavBar({ s, board }: { s: (n: number) => number; board: boolean }) {
  const motionPref = useMotionPreference();
  return (
    <View style={[styles.nav, { paddingHorizontal: s(20), paddingTop: s(14), gap: s(10) }]}>
      <View style={[styles.logo, { width: s(46), height: s(46), borderRadius: s(14) }]}>
        <Image source={require('../../assets/brand/vitainspire-mark-160.png')} style={{ width: '84%', height: '84%' }} resizeMode="contain" accessibilityLabel="VitaInspire logo" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.brand, { fontSize: s(board ? 22 : 19) }]}>Open Map Lab</Text>
        <Text style={[styles.byline, { fontSize: s(11) }]} numberOfLines={1}>
          {board ? 'by VitaInspire · Empowering Through AI' : 'by VitaInspire'}
        </Text>
      </View>
      <IconButton accessibilityLabel={motionPref ? 'Pause motion' : 'Play motion'} size={s(42)} onPress={toggleMotion}>
        <MotionIcon size={s(20)} on={motionPref} />
      </IconButton>
      <SoundButtons s={s} />
    </View>
  );
}

/** A bright morning sky: deep blue at the top fading to a hazy horizon, with soft sunlight. */
function HeroBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="hero-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5FB2EE" />
            <Stop offset="0.38" stopColor="#A9D8F7" />
            <Stop offset="0.72" stopColor="#DDF0FC" />
            <Stop offset="1" stopColor="#F2F9FF" />
          </LinearGradient>
          <RadialGradient id="hero-sun" cx="82%" cy="4%" r="55%">
            <Stop offset="0" stopColor="#FFF7D6" stopOpacity={0.95} />
            <Stop offset="0.25" stopColor="#FFF1C4" stopOpacity={0.45} />
            <Stop offset="1" stopColor="#FFF1C4" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero-sky)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero-sun)" />
      </Svg>
    </View>
  );
}

/** Fades + lifts its child in after `delay` ms (instant when motion is off). */
function FadeIn({ delay, children }: { delay: number; children: React.ReactNode }) {
  const motion = useMotion();
  const v = useRef(new Animated.Value(motion ? 0 : 1)).current;
  useEffect(() => {
    if (!motion) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, { toValue: 1, duration: 600, delay, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: NATIVE }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>{children}</Animated.View>;
}

const WORDS = ['YOUR', 'MAP', 'ADVENTURE', 'STARTS', 'NOW!'];
const GOLD = 'ADVENTURE';

/**
 * Game-title headline: white letters with a navy outline and 3D depth, "ADVENTURE" in metallic
 * gold with a glint that sweeps across it. Words pop up one after another with a little bounce.
 */
function Headline({ s, board, width }: { s: (n: number) => number; board: boolean; width: number }) {
  const motion = useMotion();
  // one line on big screens, two on phones
  const LINES = board ? [WORDS] : [WORDS.slice(0, 3), WORDS.slice(3)];
  const vals = useRef(WORDS.map(() => new Animated.Value(motion ? 0 : 1))).current;
  useEffect(() => {
    if (!motion) {
      vals.forEach((v) => v.setValue(1));
      return;
    }
    Animated.sequence([
      Animated.delay(120),
      Animated.stagger(
        80,
        vals.map((v) => Animated.spring(v, { toValue: 1, stiffness: 260, damping: 15, mass: 1, useNativeDriver: NATIVE })),
      ),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const size = board ? Math.min(s(64), (width - 80) / 20.5) : Math.min(36, width / 12.5);
  let i = 0;
  return (
    <View accessibilityRole="header" accessibilityLabel="Your map adventure starts now!" style={{ alignItems: 'center' }}>
      {LINES.map((line, li) => (
        <View key={li} style={{ flexDirection: 'row', gap: size * 0.2, marginTop: li ? -size * 0.12 : 0 }}>
          {line.map((w) => {
            const v = vals[i++];
            return (
              <Animated.View
                key={w}
                style={{
                  opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
                  transform: [
                    { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) },
                    { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                  ],
                }}
              >
                <TitleWord text={w} size={size} gold={w === GOLD} shine={motion} />
              </Animated.View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Endless ticker of features, sliding left (static when motion is paused). GPU-driven on web. */
function Ticker({ s }: { s: (n: number) => number }) {
  const motion = useMotion();
  const [w, setW] = useState(0);
  const row = (key: string) => (
    <View key={key} style={{ flexDirection: 'row', gap: s(12), paddingRight: s(12) }} onLayout={key === 'a' ? (e) => setW(Math.round(e.nativeEvent.layout.width)) : undefined}>
      {FEATURES.map((f) => (
        <View key={f} style={[styles.tick, { paddingHorizontal: s(14), paddingVertical: s(7) }]}>
          <StarIcon size={s(14)} color="#FFFFFF" edge="#CDE9F8" />
          <Text style={[styles.tickText, { fontSize: s(13) }]}>{f}</Text>
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ overflow: 'hidden' }} accessibilityLabel={FEATURES.join(', ')}>
      <Looping
        on={motion && w > 0}
        style={{ flexDirection: 'row' }}
        from={{ transform: [{ translateX: 0 }] }}
        to={{ transform: [{ translateX: -w }] }}
        duration={30000}
      >
        {row('a')}
        {row('b')}
      </Looping>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#5FB2EE' },
  nav: { flexDirection: 'row', alignItems: 'center' },
  logo: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.line,
    borderBottomWidth: 4,
    borderBottomColor: colors.surfaceLip,
  },
  brand: { fontFamily: fonts.display, color: colors.ink, lineHeight: 26 },
  byline: { fontFamily: fonts.bodyBold, color: '#173A63' },
  hero: { alignItems: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#EDE6FF',
  },
  badgeText: { fontFamily: fonts.bodyBold, color: colors.ink },
  sub: { fontFamily: fonts.bodyBold, color: '#33405F', textAlign: 'center', lineHeight: 24 },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  subCol: { alignItems: 'center' },
  tick: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  tickText: { fontFamily: fonts.bodyBold, color: '#FFFFFF' },
  footer: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.92)', textAlign: 'center', lineHeight: 18, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4 },
});
