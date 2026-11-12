import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Clouds, WaveBand } from '../components/Backdrops';
import { GameArt, type ArtKind } from '../components/GameArt';
import { SoundButtons } from '../components/GameUI';
import { HangingCards, type HangingItem } from '../components/home/HangingCards';
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
const REPO = 'https://github.com/GurunandaVitaInspire/open-map-lab';

type QuestKey = 'india' | 'quiz' | 'jigsaw' | 'world';
type Quest = {
  key: QuestKey;
  game: 'place' | 'quiz' | 'puzzle';
  map: 'india' | 'world';
  art: ArtKind;
  title: string;
  subtitle: string;
  tint: string;
  clip: string;
  clipDark: string;
  bestKey: string;
};

const QUESTS: Quest[] = [
  { key: 'india', game: 'place', map: 'india', art: 'place', title: 'India Map Quest', subtitle: 'Drag every state to its home', tint: '#EEE9FF', clip: colors.primary, clipDark: colors.primaryDark, bestKey: 'india' },
  { key: 'quiz', game: 'quiz', map: 'india', art: 'quiz', title: 'Name the State', subtitle: 'Spot the blinking state, pick its name', tint: '#E3F7EE', clip: colors.mint, clipDark: '#119E76', bestKey: 'quiz-india' },
  { key: 'jigsaw', game: 'puzzle', map: 'india', art: 'puzzle', title: 'India Jigsaw', subtitle: 'Build the labelled map piece by piece', tint: '#FFF3D6', clip: colors.sun, clipDark: colors.sunDark, bestKey: 'puzzle-india' },
  { key: 'world', game: 'place', map: 'world', art: 'world', title: 'World Explorer', subtitle: 'Countries on every continent', tint: '#DFF1FB', clip: colors.sky, clipDark: '#2B7FD1', bestKey: 'world' },
];

const FEATURES = ['100% free', 'Open source', 'No sign-up', 'No ads', 'Works on smartboards', 'India & World maps', 'Made for classrooms', 'by VitaInspire'];

const starsFor = (best: number | null) => (best === null ? 0 : best >= 90 ? 3 : best >= 70 ? 2 : best >= 45 ? 1 : 0);

export default function Home() {
  const { mode: layout, s, width } = useLayoutMode();
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
    if (key === 'world') prefetchMap('world'); // download while the setup sheet is open
    setGroup('');
    setOpen(key as QuestKey);
  };

  const play = () => {
    playSfx('tap');
    setOpen(null);
    if (quest.game === 'quiz') router.push({ pathname: '/quiz/[map]', params: { map: 'india', mode, count } });
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
        ? mode === 'outline'
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
            <Clouds count={board ? 3 : 2} />
            <NavBar s={s} board={board} />
            <View style={[styles.hero, { paddingHorizontal: s(20), paddingTop: s(board ? 26 : 14), gap: s(14) }]}>
              <FadeIn delay={0}>
                <View style={[styles.badge, { paddingHorizontal: s(14), paddingVertical: s(6) }]}>
                  <StarIcon size={s(16)} />
                  <Text style={[styles.badgeText, { fontSize: s(13) }]}>100% free for every classroom</Text>
                </View>
              </FadeIn>
              <Headline s={s} board={board} width={width} />
              <FadeIn delay={650}>
                <Text style={[styles.sub, { fontSize: s(board ? 18 : 15), maxWidth: s(620) }]}>
                  Drag states into place, name the blinking ones and build India like a jigsaw — no sign-up, no ads, just play.
                </Text>
              </FadeIn>
              <FadeIn delay={780}>
                <View style={{ flexDirection: 'row', gap: s(10), flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button label="Start playing" variant="primary" size={s(18)} onPress={() => openQuest('india')} />
                  <Button label="Open source ↗" variant="soft" size={s(16)} onPress={() => Linking.openURL(REPO)} />
                </View>
              </FadeIn>
            </View>
            <View style={{ marginTop: s(board ? 18 : 10) }}>
              <HangingCards items={items} onPick={openQuest} board={board} s={s} />
            </View>
          </View>

          {/* ---- the sea ---- */}
          <View style={{ backgroundColor: colors.bg }}>
            <WaveBand boat height={board ? 140 : 110} />
          </View>
          <View style={[styles.sea, { paddingVertical: s(22), gap: s(18), flexGrow: 1 }]}>
            <Ticker s={s} />
            <Text style={[styles.footer, { fontSize: s(12), paddingHorizontal: s(20) }]}>
              Map data: Natural Earth (public domain) · India states & districts: udit-001/india-maps-data{'\n'}
              Sounds & music: Kenney and TinyWorlds (CC0) · Made with care by VitaInspire
            </Text>
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
          note={quest.game === 'puzzle' ? 'Pieces come out of the box a few at a time. Drag them onto the board, or tap a piece and then tap its spot.' : undefined}
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

function HeroBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="hero-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF6EA" />
            <Stop offset="0.55" stopColor="#F8F1FF" />
            <Stop offset="1" stopColor={colors.bg} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero-bg)" />
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

const LINES = [
  ['LEARN', 'THE', 'MAP'],
  ['BY', 'PLAYING', 'IT'],
];
const ACCENT = 'PLAYING';

/** Two-line headline: words rise in one after another, then the accent word gets a hand-drawn underline. */
function Headline({ s, board, width }: { s: (n: number) => number; board: boolean; width: number }) {
  const motion = useMotion();
  const words = LINES.flat();
  const vals = useRef(words.map(() => new Animated.Value(motion ? 0 : 1))).current;
  const underline = useRef(new Animated.Value(motion ? 0 : 1)).current;
  useEffect(() => {
    if (!motion) {
      vals.forEach((v) => v.setValue(1));
      underline.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.delay(120),
      Animated.stagger(
        70,
        vals.map((v) => Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: NATIVE })),
      ),
      Animated.timing(underline, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const size = board ? Math.min(s(84), width / 11) : Math.min(46, width / 8.2);
  let i = 0;
  return (
    <View accessibilityRole="header" accessibilityLabel="Learn the map by playing it" style={{ alignItems: 'center' }}>
      {LINES.map((line, li) => (
        <View key={li} style={{ flexDirection: 'row', gap: size * 0.28 }}>
          {line.map((w) => {
            const v = vals[i++];
            const accent = w === ACCENT;
            return (
              <Animated.View
                key={w}
                style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}
              >
                <Text style={[styles.headline, { fontSize: size, lineHeight: size * 1.02, color: accent ? colors.primary : colors.ink }]}>{w}</Text>
                {accent && (
                  <Animated.View
                    style={{
                      position: 'absolute',
                      left: 0,
                      bottom: -size * 0.14,
                      height: size * 0.26,
                      overflow: 'hidden',
                      width: underline.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    }}
                  >
                    <Svg width={size * 3.6} height={size * 0.26} viewBox="0 0 200 16" preserveAspectRatio="none">
                      <Path d="M3 11 C 40 3, 80 3, 110 8 S 170 14, 197 5" stroke={colors.sun} strokeWidth={6} strokeLinecap="round" fill="none" />
                    </Svg>
                  </Animated.View>
                )}
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
  safe: { flex: 1, backgroundColor: '#FFF6EA' },
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
  byline: { fontFamily: fonts.bodyBold, color: '#1F5C8F' },
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
  headline: { fontFamily: fonts.display, letterSpacing: -1, textAlign: 'center' },
  sub: { fontFamily: fonts.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 24 },
  sea: { backgroundColor: '#4FA8DB' },
  tick: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  tickText: { fontFamily: fonts.bodyBold, color: '#FFFFFF' },
  footer: { fontFamily: fonts.body, color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 18 },
});
