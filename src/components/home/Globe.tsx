import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Image, type ImageSourcePropType, PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { IS_WEB } from '../../lib/cssAnim';
import { haptic, SPRING } from '../../lib/feel';
import { fonts } from '../../theme';
import { Looping } from '../Looping';

type Props = {
  size: number;
  /** equirectangular (2:1) Earth picture */
  earth: ImageSourcePropType;
  /** optional equirectangular cloud map (white clouds with transparency) */
  clouds?: ImageSourcePropType;
  /** seconds for one full turn */
  turn?: number;
  on?: boolean;
  /** follow the cursor and let people grab and spin it */
  interactive?: boolean;
};

/** soft, slightly lazy follow, like something heavy turning to look at you */
const LOOK = { stiffness: 60, damping: 13, mass: 1, useNativeDriver: false };

/**
 * A spinning Earth made from a real satellite picture (NASA Blue Marble).
 * The flat map slides behind a round window; light and shadow painted over it turn the disc
 * into a sphere, and a soft blue rim of atmosphere glows around it. The steady spin is a GPU loop.
 *
 * Interactive: it leans toward the cursor and turns its face to it, and you can grab it and spin
 * it — flick it and it keeps turning, slowing down on its own like a real globe on a stand.
 */
export const Globe = memo(function Globe({ size, earth, clouds, turn = 70, on = true, interactive = false }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const glow = size * 1.36;
  const texH = size * 1.12; // a little taller than the ball, so it can tilt without showing edges
  const texW = texH * 2;

  const spin = useRef(new Animated.Value(0)).current; // px turned by hand
  const look = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current; // cursor, -1..1
  const lift = useRef(new Animated.Value(1)).current;
  const [spun, setSpun] = useState(false);

  // follow the cursor anywhere on the page (web)
  useEffect(() => {
    if (!interactive || !IS_WEB || !on) return;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (e: PointerEvent) => {
      tx = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1));
      ty = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1));
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          Animated.spring(look, { toValue: { x: tx, y: ty }, ...LOOK }).start();
        });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [interactive, on, look]);

  // grab and spin, with momentum
  const responder = useMemo(() => {
    let start = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        spin.stopAnimation((v) => (start = v));
        Animated.spring(lift, { toValue: 1.06, ...SPRING.pop }).start();
        haptic.pick();
      },
      onPanResponderMove: (_e, g) => spin.setValue(start + g.dx),
      onPanResponderRelease: (_e, g) => {
        Animated.decay(spin, { velocity: g.vx, deceleration: 0.9965, useNativeDriver: false }).start();
        Animated.spring(lift, { toValue: 1, ...SPRING.settle }).start();
        if (Math.abs(g.dx) > 8) setSpun(true);
      },
      onPanResponderTerminate: () => {
        Animated.spring(lift, { toValue: 1, ...SPRING.settle }).start();
      },
    });
  }, [spin, lift]);

  // the surface: hand spin + a turn toward the cursor, wrapped around so it never runs out
  const surfaceX = Animated.subtract(Animated.modulo(Animated.add(spin, Animated.multiply(look.x, size * 0.45)), texW), texW);
  const strip = (src: ImageSourcePropType) => (
    <View style={[styles.strip, { width: texW * 3, height: texH }]}>
      {[0, 1, 2].map((k) => (
        <Image key={k} source={src} style={{ width: texW, height: texH }} resizeMode="stretch" />
      ))}
    </View>
  );

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View
        {...(interactive ? responder.panHandlers : null)}
        style={[
          { width: size, height: size },
          interactive && IS_WEB && ({ cursor: 'grab', touchAction: 'none' } as object),
          {
            transform: [
              { translateX: Animated.multiply(look.x, size * 0.06) },
              { translateY: Animated.multiply(look.y, size * 0.05) },
              { scale: lift },
            ],
          },
        ]}
      >
        {/* atmosphere */}
        <Svg width={glow} height={glow} style={{ position: 'absolute', left: (size - glow) / 2, top: (size - glow) / 2 }} pointerEvents="none">
          <Defs>
            <RadialGradient id={`atm-${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.66" stopColor="#7CC4FF" stopOpacity={0.55} />
              <Stop offset="0.78" stopColor="#7CC4FF" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#7CC4FF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#atm-${id})`} />
        </Svg>

        <View style={[styles.ball, { width: size, height: size, borderRadius: size / 2 }]} pointerEvents="none">
          {/* the axis leans a little toward the cursor; north/south tilt follows it up and down */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                transform: [
                  { rotate: look.x.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) },
                  { translateY: Animated.multiply(look.y, -size * 0.05) },
                ],
              },
            ]}
          >
            <Animated.View style={{ position: 'absolute', left: 0, top: (size - texH) / 2, transform: [{ translateX: surfaceX }] }}>
              {/* the Earth turns west → east, so the surface slides left to right */}
              <Looping on={on} from={{ transform: [{ translateX: -texW }] }} to={{ transform: [{ translateX: 0 }] }} duration={turn * 1000}>
                {strip(earth)}
              </Looping>
              {clouds && (
                <Looping
                  on={on}
                  style={[StyleSheet.absoluteFill, { opacity: 0.85 }]}
                  from={{ transform: [{ translateX: -texW }] }}
                  to={{ transform: [{ translateX: 0 }] }}
                  duration={turn * 1000 * 0.8}
                  phase={0.3}
                >
                  {strip(clouds)}
                </Looping>
              )}
            </Animated.View>
          </Animated.View>
          {/* sunlight from the upper left, night side and dark rim on the lower right */}
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id={`lit-${id}`} cx="36%" cy="32%" r="78%" fx="30%" fy="26%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
                <Stop offset="0.32" stopColor="#FFFFFF" stopOpacity={0.04} />
                <Stop offset="0.62" stopColor="#020B1F" stopOpacity={0.12} />
                <Stop offset="0.86" stopColor="#020B1F" stopOpacity={0.55} />
                <Stop offset="1" stopColor="#020B1F" stopOpacity={0.85} />
              </RadialGradient>
              <RadialGradient id={`rim-${id}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0.82" stopColor="#9BD3FF" stopOpacity={0} />
                <Stop offset="0.97" stopColor="#9BD3FF" stopOpacity={0.45} />
                <Stop offset="1" stopColor="#CFEAFF" stopOpacity={0.7} />
              </RadialGradient>
            </Defs>
            <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#lit-${id})`} />
            <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#rim-${id})`} />
          </Svg>
        </View>
      </Animated.View>
      {interactive && (
        <View style={[styles.hint, { marginTop: size * 0.12, opacity: spun ? 0 : 1 }]} pointerEvents="none">
          <Text style={[styles.hintText, { fontSize: Math.max(12, size * 0.06) }]}>Spin the Earth!</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  ball: { overflow: 'hidden', backgroundColor: '#0B2E5C' },
  strip: { flexDirection: 'row' },
  hint: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  hintText: { fontFamily: fonts.bodyBold, color: '#1E1856' },
});
