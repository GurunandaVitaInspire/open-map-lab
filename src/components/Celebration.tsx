import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { StarIcon } from './icons';

export type CelebrationKind = 'perfect' | 'great' | 'good' | 'sparkle';

type Props = {
  kind: CelebrationKind;
  /** where the burst starts (the placed region), relative to this overlay */
  origin: { x: number; y: number };
  width: number;
  height: number;
  /** caption under the big badge, e.g. "Bullseye!" */
  caption: string;
  /** change to replay */
  trigger: number;
};

const NATIVE = Platform.OS !== 'web';
const CONFETTI = [colors.sun, colors.coral, colors.mint, colors.sky, colors.primary, '#FF8AD8', '#FFFFFF'];

type Particle = {
  shape: 'square' | 'circle' | 'ribbon' | 'star';
  color: string;
  size: number;
  xs: number[];
  ys: number[];
  spin: number;
  delay: number;
};

const STEPS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

function burst(n: number, speed: [number, number], gravity: number, sizeRange: [number, number], shapes: Particle['shape'][]): Particle[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 + Math.random() * 0.5;
    const v = speed[0] + Math.random() * (speed[1] - speed[0]);
    const vx = Math.cos(angle) * v;
    const vy = Math.sin(angle) * v - v * 0.35; // bias upwards: fireworks shoot up first
    return {
      shape: shapes[i % shapes.length],
      color: CONFETTI[i % CONFETTI.length],
      size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
      xs: STEPS.map((t) => vx * t),
      ys: STEPS.map((t) => vy * t + 0.5 * gravity * t * t),
      spin: (Math.random() - 0.5) * 900,
      delay: 0,
    };
  });
}

function rain(n: number, width: number, height: number): Particle[] {
  return Array.from({ length: n }, (_, i) => {
    const sway = (Math.random() - 0.5) * 120;
    return {
      shape: (['ribbon', 'square', 'circle', 'star'] as const)[i % 4],
      color: CONFETTI[(i * 3) % CONFETTI.length],
      size: 8 + Math.random() * 8,
      xs: STEPS.map((t) => ((i + 0.5) / n) * width + sway * t + Math.sin(t * Math.PI * 3) * 18),
      ys: STEPS.map((t) => -30 + t * (height + 60)),
      spin: (Math.random() - 0.5) * 720,
      delay: Math.random() * 500,
    };
  });
}

function ParticleView({ p, progress, origin }: { p: Particle; progress: Animated.Value; origin: { x: number; y: number } }) {
  const style = {
    position: 'absolute' as const,
    left: origin.x - p.size / 2,
    top: origin.y - p.size / 2,
    opacity: progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
    transform: [
      { translateX: progress.interpolate({ inputRange: STEPS, outputRange: p.xs }) },
      { translateY: progress.interpolate({ inputRange: STEPS, outputRange: p.ys }) },
      { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
      { scale: progress.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0.2, 1, 0.8] }) },
    ],
  };
  if (p.shape === 'star') {
    return (
      <Animated.View style={style}>
        <StarIcon size={p.size * 1.6} />
      </Animated.View>
    );
  }
  const shape =
    p.shape === 'circle'
      ? { width: p.size, height: p.size, borderRadius: p.size / 2 }
      : p.shape === 'ribbon'
        ? { width: p.size * 0.45, height: p.size * 1.4, borderRadius: 2 }
        : { width: p.size, height: p.size, borderRadius: 2 };
  return <Animated.View style={[style, shape, { backgroundColor: p.color }]} />;
}

function Rays({ size }: { size: number }) {
  const n = 14;
  const r = size / 2;
  const d = Array.from({ length: n }, (_, i) => {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + Math.PI / n;
    return `M${r},${r} L${r + Math.cos(a0) * r},${r + Math.sin(a0) * r} L${r + Math.cos(a1) * r},${r + Math.sin(a1) * r} Z`;
  }).join(' ');
  return (
    <Svg width={size} height={size}>
      <G opacity={0.55}>
        <Path d={d} fill="#FFE68A" />
      </G>
    </Svg>
  );
}

/**
 * Reward animations, scaled to how well the student did:
 * - perfect: a firework blast from the placed region, shockwaves, a flash, confetti rain and a big PERFECT badge
 * - great:   a confetti burst from the region and a GREAT badge that floats up
 * - good:    a few sparkling stars and a NICE badge
 */
export function Celebration({ kind, origin, width, height, caption, trigger }: Props) {
  const main = useRef(new Animated.Value(0)).current;
  const rainP = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  const particles = useMemo(() => {
    if (kind === 'perfect') return burst(48, [260, 520], 900, [8, 15], ['square', 'ribbon', 'circle', 'star']);
    if (kind === 'great') return burst(26, [160, 320], 700, [7, 12], ['square', 'ribbon', 'circle']);
    if (kind === 'sparkle') return burst(12, [60, 140], 220, [8, 13], ['star', 'circle']);
    return burst(9, [70, 130], 260, [9, 12], ['star']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, trigger]);
  const rainParticles = useMemo(() => (kind === 'perfect' ? rain(34, width, height) : []), [kind, width, height, trigger]);

  useEffect(() => {
    [main, rainP, badge, flash, wave, spin].forEach((v) => v.setValue(0));
    const anims = [
      Animated.timing(main, { toValue: 1, duration: kind === 'perfect' ? 1700 : kind === 'great' ? 1300 : 1000, easing: Easing.linear, useNativeDriver: NATIVE }),
      Animated.sequence([
        Animated.timing(badge, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(2.2)), useNativeDriver: NATIVE }),
        Animated.delay(kind === 'perfect' ? 1100 : 700),
        Animated.timing(badge, { toValue: 2, duration: 450, useNativeDriver: NATIVE }),
      ]),
    ];
    if (kind === 'perfect') {
      anims.push(
        Animated.timing(rainP, { toValue: 1, duration: 2600, delay: 250, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }),
        Animated.sequence([
          Animated.timing(flash, { toValue: 1, duration: 90, useNativeDriver: NATIVE }),
          Animated.timing(flash, { toValue: 0, duration: 380, useNativeDriver: NATIVE }),
        ]),
        Animated.timing(wave, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE }),
        Animated.timing(spin, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: NATIVE }),
      );
    }
    const a = Animated.parallel(anims);
    a.start();
    return () => a.stop();
  }, [trigger, kind, main, rainP, badge, flash, wave, spin]);

  const big = kind === 'perfect';
  const title = kind === 'perfect' ? 'PERFECT!' : kind === 'great' ? 'GREAT!' : 'NICE!';
  const badgeColor = kind === 'perfect' ? colors.sun : kind === 'great' ? colors.mint : colors.sky;
  const badgeLip = kind === 'perfect' ? colors.sunDark : kind === 'great' ? '#119E76' : '#2B7FD1';
  const badgeText = kind === 'perfect' ? colors.ink : '#fff';
  const rays = Math.min(width, height) * 0.9;
  // Small celebrations float above the region; the perfect badge takes centre stage.
  const at = big ? { x: width / 2, y: height * 0.42 } : { x: origin.x, y: Math.max(40, origin.y - 30) };
  const maxR = Math.hypot(width, height);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {big && <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }) }]} />}
      {big &&
        [0, 1].map((k) => (
          <Animated.View
            key={k}
            style={{
              position: 'absolute',
              left: origin.x - 40,
              top: origin.y - 40,
              width: 80,
              height: 80,
              borderRadius: 40,
              borderWidth: 6 - k * 2,
              borderColor: k ? colors.primary : colors.sun,
              opacity: wave.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.9, 0] }),
              transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.2, (maxR / 40) * (k ? 0.6 : 0.9)] }) }],
            }}
          />
        ))}

      {particles.map((p, i) => (
        <ParticleView key={`b${i}`} p={p} progress={main} origin={origin} />
      ))}
      {rainParticles.map((p, i) => (
        <ParticleView key={`r${i}`} p={p} progress={rainP} origin={{ x: 0, y: 0 }} />
      ))}

      {kind !== 'sparkle' && (
      <Animated.View
        style={{
          position: 'absolute',
          left: at.x - (big ? rays / 2 : 90),
          top: at.y - (big ? rays / 2 : 30),
          width: big ? rays : 180,
          height: big ? rays : 60,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: badge.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateY: badge.interpolate({ inputRange: [0, 1, 2], outputRange: [big ? 0 : 10, 0, big ? -20 : -50] }) },
            { scale: badge.interpolate({ inputRange: [0, 1, 2], outputRange: [big ? 2.4 : 0.4, 1, big ? 0.9 : 1] }) },
          ],
        }}
      >
        {big && (
          <Animated.View
            style={{
              position: 'absolute',
              transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }],
            }}
          >
            <Rays size={rays} />
          </Animated.View>
        )}
        <View
          style={{
            backgroundColor: badgeColor,
            borderBottomWidth: big ? 8 : 5,
            borderBottomColor: badgeLip,
            borderRadius: big ? 26 : 16,
            paddingHorizontal: big ? 34 : 16,
            paddingVertical: big ? 6 : 2,
            transform: [{ rotate: big ? '-5deg' : '-3deg' }],
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: fonts.display, fontSize: big ? Math.min(72, width / 7) : 26, color: badgeText, letterSpacing: 1 }}>{title}</Text>
        </View>
        {big && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            <StarIcon size={40} />
            <StarIcon size={52} />
            <StarIcon size={40} />
          </View>
        )}
        {big && caption ? (
          <Text style={{ fontFamily: fonts.display, fontSize: Math.min(30, width / 14), color: colors.ink, marginTop: 6 }}>{caption}</Text>
        ) : null}
      </Animated.View>
      )}
    </View>
  );
}
