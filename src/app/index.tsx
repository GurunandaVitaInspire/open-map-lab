import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { G, Path } from 'react-native-svg';
import { OceanBackdrop, PageBackdrop } from '../components/Backdrops';
import { LogoMark, StarIcon } from '../components/icons';
import { Button, Card, Chip, Label, Pill } from '../components/ui';
import { MAP_LIST, MAPS, type MapDefinition } from '../data/maps';
import type { DiagramMode } from '../lib/game';
import { getBestAny } from '../lib/progress';
import { colors, fonts, useLayoutMode } from '../theme';

const COUNTS = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: 'All', value: 0 },
];

export default function Home() {
  const { mode: layout, s } = useLayoutMode();
  const board = layout === 'board';
  const [mapId, setMapId] = useState<MapDefinition['id']>('india');
  const [mode, setMode] = useState<DiagramMode>('outline');
  const [group, setGroup] = useState<string>('');
  const [count, setCount] = useState(10);
  const [bests, setBests] = useState<Record<string, number | null>>({});

  // Refresh best scores whenever we come back from a game.
  useFocusEffect(
    useCallback(() => {
      Promise.all(MAP_LIST.map(async (m) => [m.id, await getBestAny(m.id)] as const)).then((rows) => setBests(Object.fromEntries(rows)));
    }, []),
  );

  const map = MAPS[mapId];
  const effectiveMode: DiagramMode = map.supportsInline ? mode : 'outline';

  const start = () =>
    router.push({
      pathname: '/play/[map]',
      params: { map: mapId, mode: effectiveMode, group, count: String(count) },
    });

  return (
    <SafeAreaView style={styles.safe}>
      <PageBackdrop />
      <ScrollView contentContainerStyle={[styles.scroll, { padding: s(18) }]}>
        <View style={[styles.container, { maxWidth: board ? s(1080) : 560 }]}>
          {/* header */}
          <View style={[styles.header, { marginTop: s(board ? 18 : 6), marginBottom: s(24), gap: s(14) }]}>
            <LogoMark size={s(board ? 64 : 52)} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontSize: s(board ? 46 : 34), lineHeight: s(board ? 52 : 40) }]}>Open Map Lab</Text>
              <Text style={[styles.motto, { fontSize: s(board ? 17 : 14) }]}>Drag, drop & discover — geography you can touch.</Text>
            </View>
          </View>

          <View style={[board && styles.row, { gap: s(22) }]}>
            {/* map picker */}
            <View style={[board && { flex: 1.25 }, { gap: s(12) }]}>
              <Label size={s(12)}>Pick your quest</Label>
              {MAP_LIST.map((m) => (
                <MapTile
                  key={m.id}
                  map={m}
                  best={bests[m.id] ?? null}
                  selected={m.id === mapId}
                  onPress={() => {
                    setMapId(m.id);
                    setGroup('');
                  }}
                  s={s}
                />
              ))}
            </View>

            {/* setup */}
            <Card lip={8} style={[board ? { flex: 1 } : { marginTop: s(10) }, { padding: s(20), gap: s(20) }]}>
              <View style={{ gap: s(10) }}>
                <Label size={s(12)}>Map style</Label>
                <View style={[styles.chips, { gap: s(8) }]}>
                  <Chip size={s(15)} label="Outline" selected={effectiveMode === 'outline'} onPress={() => setMode('outline')} />
                  <Chip size={s(15)} label="Inline" selected={effectiveMode === 'inline'} disabled={!map.supportsInline} onPress={() => setMode('inline')} />
                </View>
                <Text style={[styles.help, { fontSize: s(13) }]}>{map.modeHelp[effectiveMode]}</Text>
              </View>

              {map.groups && (
                <View style={{ gap: s(10) }}>
                  <Label size={s(12)}>Region</Label>
                  <View style={[styles.chips, { gap: s(8) }]}>
                    <Chip size={s(14)} label="Whole world" selected={!group} onPress={() => setGroup('')} />
                    {map.groups.map((g) => (
                      <Chip key={g} size={s(14)} label={g} selected={group === g} onPress={() => setGroup(g)} />
                    ))}
                  </View>
                </View>
              )}

              <View style={{ gap: s(10) }}>
                <Label size={s(12)}>Questions</Label>
                <View style={[styles.chips, { gap: s(8) }]}>
                  {COUNTS.map((c) => (
                    <Chip key={c.label} size={s(15)} label={c.label} selected={count === c.value} onPress={() => setCount(c.value)} />
                  ))}
                </View>
              </View>

              <Button label={`Start ${map.title} quest`} variant="sun" onPress={start} size={s(20)} icon={<PlayGlyph size={s(18)} />} />
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
            Map data: Natural Earth (public domain) · India states & districts: udit-001/india-maps-data
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
  const stars = best === null ? 0 : best >= 90 ? 3 : best >= 70 ? 2 : best >= 45 ? 1 : 0;
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
            {best === null ? `${playable} to place` : `Best ${best}%`}
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
  help: { fontFamily: fonts.body, color: colors.inkSoft, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
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
