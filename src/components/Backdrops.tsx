import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { useMotion } from '../lib/motion';
import { colors } from '../theme';

const NATIVE = Platform.OS !== 'web';

/** A 0→1 value that loops forever while `on` (linear by default). */
export function useLoop(duration: number, on: boolean, opts: { easing?: (t: number) => number; delay?: number; pingPong?: boolean } = {}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on) {
      v.stopAnimation();
      return;
    }
    const easing = opts.easing ?? Easing.linear;
    const anim = opts.pingPong
      ? Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: duration / 2, easing, useNativeDriver: NATIVE }),
          Animated.timing(v, { toValue: 0, duration: duration / 2, easing, useNativeDriver: NATIVE }),
        ])
      : Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: NATIVE });
    const loop = Animated.loop(anim, { iterations: -1, resetBeforeIteration: !opts.pingPong });
    const t = setTimeout(() => loop.start(), opts.delay ?? 0);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, duration]);
  return v;
}

/** SVG ids are page-global; several copies of a backdrop can be mounted, so each gets its own. */
function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * Bright ocean behind the maps. Two layers of little waves drift at different speeds and
 * directions, which reads as gently moving water without being distracting.
 */
export function OceanBackdrop({ still = false }: { still?: boolean }) {
  const motion = useMotion() && !still;
  const sea = useSvgId('sea');
  const w1 = useSvgId('w1');
  const w2 = useSvgId('w2');
  const a = useLoop(7000, motion);
  const b = useLoop(11000, motion);
  const bob = useLoop(5000, motion, { easing: Easing.inOut(Easing.sin), pingPong: true });
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ocean, overflow: 'hidden' }]} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={sea} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.ocean} />
            <Stop offset="1" stopColor={colors.oceanDeep} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${sea})`} />
      </Svg>
      {/* layer 1: small waves drifting right */}
      <Animated.View
        style={[
          styles.layer,
          { left: -56, right: 0 },
          {
            transform: [
              { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, 56] }) },
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, 3] }) },
            ],
          },
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id={w1} width="56" height="28" patternUnits="userSpaceOnUse">
              <Path d="M4 14c4-4 8-4 12 0s8 4 12 0" fill="none" stroke={colors.wave} strokeWidth={2} strokeLinecap="round" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${w1})`} opacity={0.95} />
        </Svg>
      </Animated.View>
      {/* layer 2: wider, fainter waves drifting left */}
      <Animated.View
        style={[
          styles.layer,
          { left: -84, right: 0 },
          {
            transform: [
              { translateX: b.interpolate({ inputRange: [0, 1], outputRange: [0, -84] }) },
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [2, -1] }) },
            ],
          },
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id={w2} width="84" height="40" patternUnits="userSpaceOnUse">
              <Path d="M40 34c5-5 10-5 15 0" fill="none" stroke="#E6F7FD" strokeWidth={2} strokeLinecap="round" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${w2})`} opacity={0.6} />
        </Svg>
      </Animated.View>
    </View>
  );
}

type WaveLayer = { color: string; height: number; amp: number; wavelength: number; duration: number; reverse?: boolean; opacity?: number };

const DEFAULT_WAVES: WaveLayer[] = [
  { color: '#CDEBFA', height: 120, amp: 14, wavelength: 420, duration: 20000, opacity: 0.9 },
  { color: '#9FD7F2', height: 100, amp: 12, wavelength: 340, duration: 13000, reverse: true, opacity: 0.9 },
  { color: '#6FBFE8', height: 78, amp: 10, wavelength: 300, duration: 10000 },
  { color: '#4FA8DB', height: 56, amp: 8, wavelength: 260, duration: 7000 },
];

/**
 * Layered, gently drifting sine waves (the classic "animated waves" band). Each layer slides by
 * exactly one wavelength per loop, so it never jumps. Optional paper boat bobbing on top.
 */
export function WaveBand({ layers = DEFAULT_WAVES, boat = false, height = 130 }: { layers?: WaveLayer[]; boat?: boolean; height?: number }) {
  const motion = useMotion();
  return (
    <View style={{ height, overflow: 'hidden' }} pointerEvents="none">
      {layers.map((l, i) => (
        <Wave key={i} layer={l} on={motion} />
      ))}
      {boat && <PaperBoat on={motion} bottom={layers[1]?.height ?? 90} />}
    </View>
  );
}

function Wave({ layer, on }: { layer: WaveLayer; on: boolean }) {
  const id = useSvgId('wave');
  const t = useLoop(layer.duration, on);
  const { wavelength: W, height: H, amp: A } = layer;
  const d = `M0 ${A} Q ${W / 4} ${-A} ${W / 2} ${A} T ${W} ${A} L ${W} ${H} L 0 ${H} Z`;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 0,
        left: -W,
        right: 0,
        height: H,
        opacity: layer.opacity ?? 1,
        transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: layer.reverse ? [0, W] : [W, 0] }) }],
      }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={W} height={H} patternUnits="userSpaceOnUse">
            <Path d={d} fill={layer.color} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height={H} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

function PaperBoat({ on, bottom }: { on: boolean; bottom: number }) {
  const bob = useLoop(3600, on, { easing: Easing.inOut(Easing.sin), pingPong: true });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        right: '18%',
        bottom: bottom - 30,
        transform: [
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) },
          { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
        ],
      }}
    >
      <Svg width={64} height={48} viewBox="0 0 64 48">
        <Path d="M30 4 L30 30 L50 30 Z" fill="#fff" stroke="#C9D7F0" strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M30 8 L30 30 L14 30 Z" fill="#FFE07A" stroke="#E8C24A" strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M6 30 L58 30 L48 42 L16 42 Z" fill={colors.coral} stroke="#E0504F" strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

/** Two or three soft clouds drifting slowly across the top of a page. */
export function Clouds({ count = 3 }: { count?: number }) {
  const motion = useMotion();
  const [w, setW] = useState(0);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 &&
        Array.from({ length: count }, (_, i) => (
          <Cloud key={i} width={w} top={30 + i * 70} scale={1 - i * 0.18} duration={90000 + i * 25000} start={(i * 0.37) % 1} on={motion} />
        ))}
    </View>
  );
}

function Cloud({ width, top, scale, duration, start, on }: { width: number; top: number; scale: number; duration: number; start: number; on: boolean }) {
  const t = useLoop(duration, on);
  const span = width + 320;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top,
        left: -160,
        opacity: 0.85,
        transform: [
          // start part-way across, drift to the right edge, jump (off-screen) to the left, carry on
          {
            translateX: t.interpolate({
              inputRange: [0, 1 - start, Math.min(1, 1 - start + 0.0001), 1],
              outputRange: [start * span, span, 0, start * span],
            }),
          },
          { scale },
        ],
      }}
    >
      <Svg width={160} height={64} viewBox="0 0 160 64">
        <G fill="#FFFFFF">
          <Ellipse cx={48} cy={42} rx={40} ry={20} />
          <Ellipse cx={86} cy={30} rx={34} ry={26} />
          <Ellipse cx={118} cy={44} rx={30} ry={17} />
        </G>
      </Svg>
    </Animated.View>
  );
}

/** Soft blobs and confetti dots for page backgrounds. Decorative only. */
export function PageBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Circle cx="-40" cy="80" r="180" fill={colors.bgDeep} />
        <Circle cx="105%" cy="92%" r="220" fill={colors.bgDeep} />
        <Circle cx="88%" cy="12%" r="10" fill={colors.sun} opacity={0.8} />
        <Circle cx="8%" cy="70%" r="7" fill={colors.mint} opacity={0.7} />
        <Circle cx="60%" cy="6%" r="5" fill={colors.coral} opacity={0.7} />
        <Rect x="76%" y="55%" width="12" height="12" rx="3" fill={colors.sky} opacity={0.5} transform="rotate(20)" />
        <Path d="M30 0 l6 0 M33 -3 l0 6" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" transform="translate(240 40)" opacity={0.5} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, bottom: 0 },
});
