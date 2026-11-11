import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Button, Chip } from '../components/ui';
import { MAP_LIST, MAPS, type MapDefinition } from '../data/maps';
import type { DiagramMode } from '../lib/game';
import { colors, useLayoutMode } from '../theme';

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

  const map = MAPS[mapId];
  const effectiveMode: DiagramMode = map.supportsInline ? mode : 'outline';

  const start = () =>
    router.push({
      pathname: '/play/[map]',
      params: { map: mapId, mode: effectiveMode, group, count: String(count) },
    });

  const label = { fontSize: s(13), marginBottom: s(10) };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.scroll, { padding: s(20) }]}>
        <View style={[styles.container, { maxWidth: board ? 1040 * Math.min(1.4, s(100) / 100) : 560 }]}>
          <View style={{ marginBottom: s(28), marginTop: s(board ? 24 : 8) }}>
            <Text style={[styles.title, { fontSize: s(board ? 40 : 30) }]}>Open Map Lab</Text>
            <Text style={[styles.motto, { fontSize: s(board ? 18 : 15) }]}>
              Learn geography by placing it — free and open for every classroom.
            </Text>
          </View>

          <View style={[board && styles.row, { gap: s(24) }]}>
            <View style={[board && { flex: 1.3 }]}>
              <Text style={[styles.label, label]}>CHOOSE A MAP</Text>
              <View style={[styles.tiles, { gap: s(14) }]}>
                {MAP_LIST.map((m) => (
                  <MapTile
                    key={m.id}
                    map={m}
                    selected={m.id === mapId}
                    onPress={() => {
                      setMapId(m.id);
                      setGroup('');
                    }}
                    s={s}
                  />
                ))}
              </View>
            </View>

            <View style={[board ? { flex: 1 } : { marginTop: s(28) }, { gap: s(24) }]}>
              <View>
                <Text style={[styles.label, label]}>DIAGRAM</Text>
                <View style={[styles.chips, { gap: s(8) }]}>
                  <Chip size={s(15)} label="Outline" selected={effectiveMode === 'outline'} onPress={() => setMode('outline')} />
                  <Chip
                    size={s(15)}
                    label="Inline"
                    selected={effectiveMode === 'inline'}
                    disabled={!map.supportsInline}
                    onPress={() => setMode('inline')}
                  />
                </View>
                <Text style={[styles.help, { fontSize: s(13), marginTop: s(8) }]}>
                  {effectiveMode === 'outline'
                    ? 'Only the outer boundary of each shape is shown.'
                    : 'Shapes include internal district boundaries.'}
                  {!map.supportsInline ? ' Inline mode is available for India.' : ''}
                </Text>
              </View>

              {map.groups && (
                <View>
                  <Text style={[styles.label, label]}>REGION</Text>
                  <View style={[styles.chips, { gap: s(8) }]}>
                    <Chip size={s(15)} label="Whole world" selected={!group} onPress={() => setGroup('')} />
                    {map.groups.map((g) => (
                      <Chip key={g} size={s(15)} label={g} selected={group === g} onPress={() => setGroup(g)} />
                    ))}
                  </View>
                </View>
              )}

              <View>
                <Text style={[styles.label, label]}>QUESTIONS</Text>
                <View style={[styles.chips, { gap: s(8) }]}>
                  {COUNTS.map((c) => (
                    <Chip key={c.label} size={s(15)} label={c.label} selected={count === c.value} onPress={() => setCount(c.value)} />
                  ))}
                </View>
              </View>

              <Button label={`Start ${map.title}`} onPress={start} size={s(18)} style={{ marginTop: s(4) }} />
            </View>
          </View>

          <Text style={[styles.footer, { fontSize: s(12), marginTop: s(40) }]}>
            Free & open source · no accounts, no ads.{'\n'}
            Map data: Natural Earth (public domain) · India states & districts: udit-001/india-maps-data.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MapTile({ map, selected, onPress, s }: { map: MapDefinition; selected: boolean; onPress: () => void; s: (n: number) => number }) {
  const { data } = map;
  const playable = data.regions.filter((r) => r.playable).length;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${map.title} map`}
      onPress={onPress}
      style={[styles.tile, { padding: s(16), borderRadius: s(18) }, selected && styles.tileSelected]}
    >
      <View style={[styles.thumb, { height: s(map.id === 'world' ? 120 : 150) }]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${data.width} ${data.height}`}>
          {data.regions.map((r) => (
            <Path key={r.id} d={r.d} fill={selected ? '#C9D6FB' : colors.land} stroke="#fff" strokeWidth={data.width / 400} />
          ))}
        </Svg>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={[styles.tileTitle, { fontSize: s(20) }]}>{map.title}</Text>
        <Text style={[styles.help, { fontSize: s(13), marginTop: 2 }]}>{map.description}</Text>
        <Text style={[styles.help, { fontSize: s(12), marginTop: s(6) }]}>{playable} to place</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, alignItems: 'center' },
  container: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { fontWeight: '800', color: colors.ink, letterSpacing: -0.8 },
  motto: { color: colors.inkSoft, marginTop: 6, lineHeight: 22 },
  label: { fontWeight: '700', color: colors.inkSoft, letterSpacing: 1.2 },
  help: { color: colors.inkSoft, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  tiles: {},
  tile: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: { borderColor: colors.accent },
  thumb: { aspectRatio: 1.25, maxWidth: '50%' },
  tileTitle: { fontWeight: '800', color: colors.ink },
  footer: { color: colors.inkSoft, textAlign: 'center', lineHeight: 18 },
});
