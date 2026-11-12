import { router } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { playSfx, toggleMusic, toggleSfx, useSoundSettings } from '../lib/sound';
import { colors, fonts, rate, RATING_LEGEND } from '../theme';
import { Looping } from './Looping';
import { BackIcon, ExpandIcon, FlameIcon, MusicIcon, SpeakerIcon, StarIcon } from './icons';
import { Button, Card, IconButton, Label, Pill } from './ui';

type S = (n: number) => number;
export const NATIVE = Platform.OS !== 'web';

function toggleFullscreen() {
  if (Platform.OS !== 'web') return;
  const d = globalThis.document as Document | undefined;
  if (!d) return;
  if (d.fullscreenElement) d.exitFullscreen?.();
  else d.documentElement.requestFullscreen?.();
}

/** Music and sound-effect toggles. */
export function SoundButtons({ s }: { s: S }) {
  const { sfx, music } = useSoundSettings();
  return (
    <>
      <IconButton accessibilityLabel={music ? 'Turn music off' : 'Turn music on'} size={s(42)} onPress={toggleMusic}>
        <MusicIcon size={s(19)} on={music} />
      </IconButton>
      <IconButton accessibilityLabel={sfx ? 'Mute sound effects' : 'Unmute sound effects'} size={s(42)} onPress={toggleSfx}>
        <SpeakerIcon size={s(19)} on={sfx} />
      </IconButton>
    </>
  );
}

type TopBarProps = {
  s: S;
  board: boolean;
  title: string;
  subtitle?: string;
  done: number;
  total: number;
  stars: number;
  streak?: number;
  /** extra pill shown on large screens, e.g. accuracy or a timer */
  extra?: ReactNode;
};

/** Shared game header: back, title + progress, stars, streak, sound and full-screen controls. */
export function GameTopBar({ s, board, title, subtitle, done, total, stars, streak, extra }: TopBarProps) {
  const progress = total ? Math.min(1, done / total) : 0;
  return (
    <View style={[styles.topBar, { paddingHorizontal: s(14), paddingVertical: s(10), gap: s(10) }]}>
      <IconButton
        accessibilityLabel="Back"
        size={s(42)}
        onPress={() => {
          playSfx('tap');
          if (router.canGoBack()) router.back();
          else router.replace('/');
        }}
      >
        <BackIcon size={s(20)} />
      </IconButton>
      <View style={{ flex: 1, gap: s(5) }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Text style={[styles.topTitle, { fontSize: s(board ? 20 : 16) }]} numberOfLines={1}>
            {title}
            {subtitle ? <Text style={{ color: colors.inkSoft, fontFamily: fonts.bodyBold, fontSize: s(13) }}>  {subtitle}</Text> : null}
          </Text>
          <Text style={[styles.topCount, { fontSize: s(13) }]}>
            {Math.min(done, total)}/{total}
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
      {streak !== undefined && (
        <Pill style={streak >= 2 ? { borderColor: '#FFD2B8', borderBottomColor: '#FFB48A', backgroundColor: '#FFF4EC' } : undefined}>
          <FlameIcon size={s(18)} active={streak > 0} />
          <Text style={[styles.pillText, { fontSize: s(15) }]}>{streak}</Text>
        </Pill>
      )}
      {board && extra}
      {board && <SoundButtons s={s} />}
      {Platform.OS === 'web' && board && (
        <IconButton accessibilityLabel="Toggle full screen" size={s(42)} onPress={toggleFullscreen}>
          <ExpandIcon size={s(18)} />
        </IconButton>
      )}
    </View>
  );
}

export function StatPill({ s, children }: { s: S; children: ReactNode }) {
  return (
    <Pill>
      <Text style={[styles.pillText, { fontSize: s(15) }]}>{children}</Text>
    </Pill>
  );
}

export function StarsRow({ count, size }: { count: number; size: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <StarIcon key={i} size={i === 1 ? size * 1.2 : size} filled={i < count} />
      ))}
    </View>
  );
}

export function FocusIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill="#FFE2D6" />
      <Circle cx={12} cy={12} r={6.5} fill="none" stroke={colors.coral} strokeWidth={2.2} />
      <Circle cx={12} cy={12} r={2.6} fill={colors.coral} />
    </Svg>
  );
}

/** Gentle breathing pulse for motivating (not alarming) feedback. */
export function Pulse({ children, active = true }: { children: ReactNode; active?: boolean }) {
  return (
    <Looping on={active} from={{ transform: [{ scale: 1 }] }} to={{ transform: [{ scale: 1.12 }] }} duration={1100} smooth alternate>
      {children}
    </Looping>
  );
}

export function LegendLine({ color, label, size, dashed }: { color: string; label: string; size: number; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: size * 1.8, height: 0, borderTopWidth: 3, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} />
      <Text style={{ fontSize: size, color: colors.ink, fontFamily: fonts.bodyBold }}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, color, s }: { label: string; value: string; color: string; s: S }) {
  return (
    <View style={[styles.stat, { paddingVertical: s(8), borderRadius: s(14) }]}>
      <Text style={{ fontFamily: fonts.display, fontSize: s(24), color }}>{value}</Text>
      <Label size={s(10)}>{label}</Label>
    </View>
  );
}

type ResultsProps = {
  s: S;
  board: boolean;
  /** 0–100 per question/piece, in order */
  scores: number[];
  /** names matching `scores`, used for the "practise next" list */
  names: string[];
  points: number;
  stars: number;
  newBest: boolean;
  /** first stat tile; defaults to average accuracy */
  headline?: { label: string; value: string; color?: string };
  /** hide the per-tier breakdown (e.g. puzzle) */
  hideBreakdown?: boolean;
  onAgain: () => void;
  onHome: () => void;
};

/** End-of-round card shared by all games. */
export function RoundResults({ s, board, scores, names, points, stars, newBest, headline, hideBreakdown, onAgain, onHome }: ResultsProps) {
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const roundStars = average >= 90 ? 3 : average >= 70 ? 2 : average >= 45 ? 1 : 0;
  const message =
    average >= 90 ? 'Legendary explorer!' : average >= 70 ? 'Great expedition!' : average >= 45 ? 'Good effort!' : "Practice makes perfect — let's go again!";
  const counts = RATING_LEGEND.map((l) => ({ ...l, n: scores.filter((v) => rate(v).tier === l.tier).length }));
  const weak = names.filter((_, i) => scores[i] < 50).slice(0, 6);
  const head = headline ?? { label: 'Accuracy', value: `${average}%`, color: rate(average).color };

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
          <Stat label={head.label} value={head.value} color={head.color ?? colors.ink} s={s} />
          <Stat label="Points" value={String(points)} color={colors.primary} s={s} />
          <Stat label="Stars" value={String(stars)} color={colors.sunDark} s={s} />
        </View>
        {!hideBreakdown && (
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
        )}
        {weak.length > 0 && <Text style={[styles.tip, { fontSize: s(13), textAlign: 'center' }]}>Practise next: {weak.join(', ')}</Text>}
      </ScrollView>
      <View style={{ gap: s(10) }}>
        <Button
          label="Play again"
          size={s(17)}
          onPress={() => {
            playSfx('tap');
            onAgain();
          }}
        />
        <Button
          label="Choose game"
          variant="soft"
          size={s(16)}
          onPress={() => {
            playSfx('tap');
            onHome();
          }}
        />
      </View>
    </Card>
  );
}

export const gameStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1 },
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
  name: { fontFamily: fonts.display, color: colors.ink },
  sub: { fontFamily: fonts.body, color: colors.inkSoft, lineHeight: 20 },
  tip: { fontFamily: fonts.body, color: colors.ink, lineHeight: 19 },
  pct: { fontFamily: fonts.display, letterSpacing: -1 },
  motivate: { backgroundColor: '#FFF4EE', borderWidth: 2, borderColor: '#FFE0D2' },
  motivateText: { fontFamily: fonts.bodyBold, color: colors.ink, lineHeight: 20 },
  sheet: { marginHorizontal: 10, marginBottom: 8, padding: 14, maxHeight: '64%' },
  panel: { flexShrink: 1, overflow: 'hidden' },
  panelScroll: { flexGrow: 0, flexShrink: 1 },
});

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center' },
  topTitle: { fontFamily: fonts.display, color: colors.ink, flexShrink: 1 },
  topCount: { fontFamily: fonts.black, color: colors.inkSoft },
  progressTrack: { borderRadius: 99, backgroundColor: colors.bgDeep, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99, backgroundColor: colors.primary, overflow: 'hidden' },
  progressShine: { position: 'absolute', left: 6, right: 6, top: 2, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  pillText: { fontFamily: fonts.black, color: colors.ink },
  sheet: { marginHorizontal: 10, marginBottom: 8, padding: 14, maxHeight: '64%' },
  panel: { flexShrink: 1, overflow: 'hidden' },
  panelScroll: { flexGrow: 0, flexShrink: 1 },
  name: { fontFamily: fonts.display, color: colors.ink },
  tip: { fontFamily: fonts.body, color: colors.ink, lineHeight: 19 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.line },
});
