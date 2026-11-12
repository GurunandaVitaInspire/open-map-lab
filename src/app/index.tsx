import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { G, Path } from 'react-native-svg';
import { OceanBackdrop, PageBackdrop } from '../components/Backdrops';
import { NATIVE, SoundButtons } from '../components/GameUI';
import { StarIcon } from '../components/icons';
import { Button, Card, Chip, Label, Pill } from '../components/ui';
import { MAP_LIST, MAPS, type MapDefinition } from '../data/maps';
import type { DiagramMode } from '../lib/game';
import { getBestAny } from '../lib/progress';
import { playSfx } from '../lib/sound';
import { colors, fonts, useLayoutMode } from '../theme';

type GameId = 'place' | 'quiz' | 'puzzle';

const GAMES: { id: GameId; title: string; tagline: string; maps: string; tint: string; tintDark: string }[] = [
  { id: 'place', title: 'Place it', tagline: 'Drag each shape to where it belongs', maps: 'India · World', tint: '#EEE9FF', tintDark: '#C9BBFF' },
  { id: 'quiz', title: 'Name it', tagline: 'Spot the blinking state and pick its name', maps: 'India', tint: '#E3F7EE', tintDark: '#9FDDBF' },
  { id: 'puzzle', title: 'Puzzle', tagline: 'Build India piece by piece', maps: 'India', tint: '#FFF3D6', tintDark: '#F2D07A' },
];

const COUNTS = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: 'All', value: 0 },
];

const starsFor = (best: number | null) => (best === null ? 0 : best >= 90 ? 3 : best >= 70 ? 2 : best >= 45 ? 1 : 0);
const tap = (fn: () => void) => () => {
  playSfx('tap');
  fn();
};

export default function Home() {
  const { mode: layout, s } = useLayoutMode();
  const board = layout === 'board';
  const [game, setGame] = useState<GameId>('place');
  const [mapId, setMapId] = useState<MapDefinition['id']>('india');
  const [mode, setMode] = useState<DiagramMode>('outline');
  const [group, setGroup] = useState<string>('');
  const [count, setCount] = useState(10);
  const [bests, setBests] = useState<Record<string, number | null>>({});

  // Refresh best scores whenever we come back from a game.
  useFocusEffect(
    useCallback(() => {
      const keys = ['india', 'world', 'quiz-india', 'puzzle-india'];
      Promise.all(keys.map(async (k) => [k, await getBestAny(k)] as const)).then((rows) => setBests(Object.fromEntries(rows)));
    }, []),
  );

  const map = game === 'place' ? MAPS[mapId] : MAPS.india;
  const effectiveMode: DiagramMode = map.supportsInline ? mode : 'outline';

  const start = () => {
    playSfx('tap');
    if (game === 'quiz') router.push({ pathname: '/quiz/[map]', params: { map: 'india', mode: effectiveMode, count: String(count) } });
    else if (game === 'puzzle') router.push({ pathname: '/puzzle/[map]', params: { map: 'india', mode: effectiveMode } });
    else router.push({ pathname: '/play/[map]', params: { map: mapId, mode: effectiveMode, group, count: String(count) } });
  };

  const gameBest = (g: GameId) =>
    g === 'place' ? Math.max(bests.india ?? -1, bests.world ?? -1) : g === 'quiz' ? (bests['quiz-india'] ?? -1) : (bests['puzzle-india'] ?? -1);

  const styleHelp =
    game === 'quiz'
      ? effectiveMode === 'outline'
        ? 'Only India’s outer border and the blinking state are shown.'
        : 'All state borders are shown — easier for beginners.'
      : game === 'puzzle'
        ? effectiveMode === 'outline'
          ? 'An empty India outline: work out where every piece goes.'
          : 'Faint state borders guide each piece — great for younger kids.'
        : map.modeHelp[effectiveMode];

  const current = GAMES.find((g) => g.id === game)!;

  return (
    <SafeAreaView style={styles.safe}>
      <PageBackdrop />
      <ScrollView contentContainerStyle={[styles.scroll, { padding: s(18) }]}>
        <View style={[styles.container, { maxWidth: board ? s(1120) : 560 }]}>
          {/* header */}
          <View style={[styles.header, { marginTop: s(board ? 14 : 6), marginBottom: s(22), gap: s(14) }]}>
            <View style={[styles.logoTile, { width: s(board ? 76 : 62), height: s(board ? 76 : 62), borderRadius: s(20) }]}>
              <Image source={require('../../assets/brand/vitainspire-mark.png')} style={{ width: '82%', height: '82%' }} resizeMode="contain" accessibilityLabel="VitaInspire logo" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize: s(board ? 46 : 32), lineHeight: s(board ? 52 : 38) }]}>Open Map Lab</Text>
              <Text style={[styles.motto, { fontSize: s(board ? 17 : 14) }]}>Drag, drop & discover — geography you can touch.</Text>
              <Text style={[styles.byline, { fontSize: s(12) }]}>by VitaInspire · Empowering Through AI</Text>
            </View>
            <View style={{ flexDirection: board ? 'row' : 'column', gap: s(8) }}>
              <SoundButtons s={s} />
            </View>
          </View>

          {/* game picker */}
          <Label size={s(12)}>Pick a game</Label>
          <View style={[styles.games, { gap: s(14), marginTop: s(10), marginBottom: s(22) }, board ? { flexDirection: 'row' } : null]}>
            {GAMES.map((g) => {
              const best = gameBest(g.id);
              return (
                <GameCard
                  key={g.id}
                  game={g}
                  selected={g.id === game}
                  best={best >= 0 ? best : null}
                  board={board}
                  s={s}
                  onPress={tap(() => {
                    setGame(g.id);
                    setGroup('');
                  })}
                />
              );
            })}
          </View>

          <View style={[board && styles.row, { gap: s(22) }]}>
            {/* map picker (only "Place it" offers the world) */}
            <View style={[board && { flex: 1.2 }, { gap: s(12) }]}>
              <Label size={s(12)}>{game === 'place' ? 'Pick a map' : 'Map'}</Label>
              {(game === 'place' ? MAP_LIST : [MAPS.india]).map((m) => (
                <MapTile
                  key={m.id}
                  map={m}
                  best={game === 'place' ? (bests[m.id] ?? null) : null}
                  selected={m.id === map.id}
                  onPress={tap(() => {
                    if (game !== 'place') return;
                    setMapId(m.id);
                    setGroup('');
                  })}
                  s={s}
                />
              ))}
              {game !== 'place' && <Text style={[styles.help, { fontSize: s(13) }]}>{current.title} uses the India map.</Text>}
            </View>

            {/* setup */}
            <Card lip={8} style={[board ? { flex: 1 } : { marginTop: s(10) }, { padding: s(20), gap: s(20) }]}>
              <View style={{ gap: s(10) }}>
                <Label size={s(12)}>{game === 'puzzle' ? 'Guides' : 'Map style'}</Label>
                <View style={[styles.chips, { gap: s(8) }]}>
                  <Chip size={s(15)} label={game === 'puzzle' ? 'No guides' : 'Outline'} selected={effectiveMode === 'outline'} onPress={tap(() => setMode('outline'))} />
                  <Chip
                    size={s(15)}
                    label={game === 'puzzle' ? 'With guides' : 'Inline'}
                    selected={effectiveMode === 'inline'}
                    disabled={!map.supportsInline}
                    onPress={tap(() => setMode('inline'))}
                  />
                </View>
                <Text style={[styles.help, { fontSize: s(13) }]}>{styleHelp}</Text>
              </View>

              {game === 'place' && map.groups && (
                <View style={{ gap: s(10) }}>
                  <Label size={s(12)}>Region</Label>
                  <View style={[styles.chips, { gap: s(8) }]}>
                    <Chip size={s(14)} label="Whole world" selected={!group} onPress={tap(() => setGroup(''))} />
                    {map.groups.map((g) => (
                      <Chip key={g} size={s(14)} label={g} selected={group === g} onPress={tap(() => setGroup(g))} />
                    ))}
                  </View>
                </View>
              )}

              {game !== 'puzzle' ? (
                <View style={{ gap: s(10) }}>
                  <Label size={s(12)}>Questions</Label>
                  <View style={[styles.chips, { gap: s(8) }]}>
                    {COUNTS.map((c) => (
                      <Chip key={c.label} size={s(15)} label={c.label} selected={count === c.value} onPress={tap(() => setCount(c.value))} />
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={[styles.help, { fontSize: s(13) }]}>31 state pieces. Tiny union territories are already placed for you.</Text>
              )}

              <Button label={`Play ${current.title}`} variant="sun" onPress={start} size={s(20)} icon={<PlayGlyph size={s(18)} />} />
            </Card>
          </View>

          <View style={[styles.badges, { marginTop: s(30), gap: s(8) }]}>
            {['100% free', 'Open source', 'No sign-up', 'No ads'].map((t) => (
              <Pill key={t}>
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: s(12), color: colors.inkSoft }}>{t}</Text>
              </Pill>
            ))}
          </View>
          <Text style={[styles.footer, { fontSize: s(11), marginTop: s(12) }]}>
            Map data: Natural Earth (public domain) · India states & districts: udit-001/india-maps-data{'\n'}
            Sounds & music: Kenney and TinyWorlds (CC0)
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlayGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.5v15l12.5-7.5z" fill={colors.ink} strokeLinejoin="round" stroke={colors.ink} strokeWidth={2} />
    </Svg>
  );
}

const PUZZLE_TINTS = ['#FF8A80', '#FFD54A', '#7DDB9E', '#7FC4FF', '#B79CFF', '#FFB070', '#6EDAD4', '#FF9BD2'];

/** Little India illustration for each game card. */
const GameArt = memo(function GameArt({ game }: { game: GameId }) {
  const { data } = MAPS.india;
  const depth = 14;
  const hero = data.regions.find((r) => r.id === (game === 'quiz' ? 'andhra-pradesh' : game === 'puzzle' ? 'rajasthan' : 'maharashtra'))!;
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (game !== 'quiz') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.25, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(blink, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [game, blink]);

  const vb = `-40 -60 ${data.width + 80} ${data.height + 110}`;
  const fill = (id: string, i: number) => (game === 'puzzle' ? PUZZLE_TINTS[i % PUZZLE_TINTS.length] : colors.landTop);
  return (
    <View style={{ flex: 1 }}>
      <Svg width="100%" height="100%" viewBox={vb}>
        <G transform={`translate(0 ${depth})`}>
          {data.regions.map((r) => (
            <Path key={r.id} d={r.d} fill={colors.landSide} stroke={colors.landSide} strokeWidth={4} />
          ))}
        </G>
        {data.regions.map((r, i) =>
          game === 'puzzle' && r.id === hero.id ? null : (
            <Path key={r.id} d={r.d} fill={game === 'place' && r.id === hero.id ? colors.landSide : fill(r.id, i)} stroke={game === 'puzzle' ? '#fff' : colors.landStroke} strokeWidth={game === 'puzzle' ? 5 : 2} />
          ),
        )}
        {game === 'place' && (
          <G transform="translate(-70 -90)">
            <Path d={hero.d} transform="translate(8 26)" fill={colors.shadow} opacity={0.18} />
            <Path d={hero.d} transform="translate(0 12)" fill={colors.primaryDark} />
            <Path d={hero.d} fill={colors.primary} stroke="#fff" strokeWidth={5} />
          </G>
        )}
        {game === 'puzzle' && (
          <G transform="translate(-90 -70)">
            <Path d={hero.d} transform="translate(8 26)" fill={colors.shadow} opacity={0.18} />
            <Path d={hero.d} transform="translate(0 12)" fill="#E0A400" />
            <Path d={hero.d} fill="#FFD54A" stroke="#fff" strokeWidth={5} />
          </G>
        )}
      </Svg>
      {game === 'quiz' && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: blink }]} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox={vb}>
            <Path d={hero.d} fill={colors.mint} stroke="#fff" strokeWidth={6} />
          </Svg>
        </Animated.View>
      )}
      {game === 'quiz' && (
        <View style={styles.bubble} pointerEvents="none">
          <Text style={styles.bubbleText}>?</Text>
        </View>
      )}
    </View>
  );
});

function GameCard({
  game,
  selected,
  best,
  onPress,
  s,
  board,
}: {
  game: (typeof GAMES)[number];
  selected: boolean;
  best: number | null;
  onPress: () => void;
  s: (n: number) => number;
  board: boolean;
}) {
  const stars = starsFor(best);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${game.title} game`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.gameCard,
        board ? { flex: 1 } : { flexDirection: 'row', alignItems: 'center' },
        { padding: s(12), borderRadius: s(24), gap: s(12), borderBottomWidth: pressed ? 3 : 8, marginTop: pressed ? 5 : 0 },
        selected && styles.tileSelected,
      ]}
    >
      <View
        style={[
          styles.art,
          { backgroundColor: game.tint, borderColor: game.tintDark, borderRadius: s(18), padding: s(6) },
          board ? { height: s(150) } : { width: s(108), height: s(108) },
        ]}
      >
        <GameArt game={game.id} />
      </View>
      <View style={{ flex: board ? 0 : 1, gap: s(3) }}>
        <Text style={[styles.tileTitle, { fontSize: s(24), lineHeight: s(28) }]}>{game.title}</Text>
        <Text style={[styles.help, { fontSize: s(13) }]}>{game.tagline}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginTop: s(4), flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', gap: 1 }}>
            {[0, 1, 2].map((i) => (
              <StarIcon key={i} size={s(16)} filled={i < stars} />
            ))}
          </View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: s(12), color: colors.inkSoft }}>{best === null ? game.maps : `Best ${best}% · ${game.maps}`}</Text>
        </View>
      </View>
      {selected && (
        <View style={[styles.check, { width: s(28), height: s(28), borderRadius: s(14), top: s(10), right: s(10) }]}>
          <Svg width={s(16)} height={s(16)} viewBox="0 0 24 24">
            <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      )}
    </Pressable>
  );
}

/** Tiny extruded map for the picker tiles. */
const MiniMap3D = memo(function MiniMap3D({ map, selected }: { map: MapDefinition; selected: boolean }) {
  const { data } = map;
  const depth = data.width / 70;
  return (
    <Svg width="100%" height="100%" viewBox={`0 ${-depth} ${data.width} ${data.height + depth * 3}`}>
      <G transform={`translate(${depth * 0.5} ${depth * 2.2})`} opacity={0.16}>
        {data.regions.map((r) => (
          <Path key={r.id} d={r.d} fill={colors.shadow} />
        ))}
      </G>
      <G transform={`translate(0 ${depth})`}>
        {data.regions.map((r) => (
          <Path key={r.id} d={r.d} fill={selected ? '#9E83FF' : colors.landSide} stroke={selected ? '#9E83FF' : colors.landSide} strokeWidth={depth / 3} />
        ))}
      </G>
      {data.regions.map((r) => (
        <Path key={r.id} d={r.d} fill={selected ? '#D8CCFF' : colors.landTop} stroke={selected ? '#F3EEFF' : colors.landStroke} strokeWidth={data.width / 500} />
      ))}
    </Svg>
  );
});

function MapTile({ map, selected, onPress, s, best }: { map: MapDefinition; selected: boolean; onPress: () => void; s: (n: number) => number; best: number | null }) {
  const playable = map.data.regions.filter((r) => r.playable).length;
  const stars = starsFor(best);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${map.title} map`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { padding: s(12), borderRadius: s(24), gap: s(14), borderBottomWidth: pressed ? 3 : 8, marginTop: pressed ? 5 : 0 },
        selected && styles.tileSelected,
      ]}
    >
      <View style={[styles.thumb, { width: s(map.id === 'world' ? 170 : 130), height: s(120), borderRadius: s(16) }]}>
        <OceanBackdrop />
        <View style={{ flex: 1, padding: s(6) }}>
          <MiniMap3D map={map} selected={selected} />
        </View>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: s(3) }}>
        <Text style={[styles.tileTitle, { fontSize: s(26), lineHeight: s(30) }]}>{map.title}</Text>
        <Text style={[styles.help, { fontSize: s(13) }]}>{map.description}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginTop: s(4), flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', gap: 1 }}>
            {[0, 1, 2].map((i) => (
              <StarIcon key={i} size={s(18)} filled={i < stars} />
            ))}
          </View>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: s(12), color: colors.inkSoft }}>
            {best === null ? `${playable} regions` : `Best ${best}%`}
          </Text>
        </View>
      </View>
      {selected && (
        <View style={[styles.check, { width: s(28), height: s(28), borderRadius: s(14), top: s(10), right: s(10) }]}>
          <Svg width={s(16)} height={s(16)} viewBox="0 0 24 24">
            <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: { width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontFamily: fonts.display, color: colors.ink, letterSpacing: -0.5 },
  motto: { fontFamily: fonts.body, color: colors.inkSoft },
  byline: { fontFamily: fonts.bodyBold, color: '#1F5C8F', marginTop: 2, letterSpacing: 0.3 },
  logoTile: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.line,
    borderBottomWidth: 6,
    borderBottomColor: colors.surfaceLip,
  },
  help: { fontFamily: fonts.body, color: colors.inkSoft, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  games: {},
  gameCard: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.line,
    borderBottomColor: colors.surfaceLip,
  },
  art: { borderWidth: 2, overflow: 'hidden' },
  bubble: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.mint,
    borderBottomWidth: 3,
    borderBottomColor: '#119E76',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: { fontFamily: fonts.display, color: '#fff', fontSize: 18, lineHeight: 22 },
  tile: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.line,
    borderBottomColor: colors.surfaceLip,
  },
  tileSelected: { borderColor: colors.primary, borderBottomColor: colors.primaryDark, backgroundColor: '#FBFAFF' },
  thumb: { overflow: 'hidden' },
  tileTitle: { fontFamily: fonts.display, color: colors.ink },
  check: { position: 'absolute', backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  footer: { fontFamily: fonts.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 16 },
});
