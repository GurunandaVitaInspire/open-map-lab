import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle, View } from 'react-native';
import { EASE_IN_OUT, IS_WEB, cssAnimation } from '../lib/cssAnim';

type TransformItem = Record<string, number | string>;
export type Frame = { transform?: TransformItem[]; opacity?: number };

type Props = {
  from: Frame;
  to: Frame;
  /** ms for one pass (from→to; with `alternate`, one direction) */
  duration: number;
  /** ease-in-out (good for bobbing/swaying); default linear (good for drifting) */
  smooth?: boolean;
  /** go back and forth instead of jumping back to `from` */
  alternate?: boolean;
  /** start part-way through the cycle (0..1), so copies don't move in sync */
  phase?: number;
  /** when false the view rests at `from` (e.g. motion paused) */
  on?: boolean;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
  children?: ReactNode;
};

/**
 * A view that loops between two keyframes forever.
 * Web: a CSS animation (runs on the GPU compositor, zero JavaScript per frame).
 * Native: Animated with the native driver (runs on the UI thread).
 */
export function Looping(props: Props) {
  return IS_WEB ? <WebLoop {...props} /> : <NativeLoop {...props} />;
}

function WebLoop({ from, to, duration, smooth, alternate, phase = 0, on = true, style, pointerEvents, children }: Props) {
  const anim = on
    ? cssAnimation(
        { '0%': toKeyframe(from), '100%': toKeyframe(to) },
        {
          duration,
          easing: smooth ? EASE_IN_OUT : 'linear',
          direction: alternate ? 'alternate' : 'normal',
          delay: -Math.round(phase * duration * (alternate ? 2 : 1)),
        },
      )
    : null;
  return (
    <View pointerEvents={pointerEvents} style={[style, toCss(from), anim]}>
      {children}
    </View>
  );
}

function toCss(f: Frame): ViewStyle {
  return f as ViewStyle;
}

const UNIT: Record<string, string> = { translateX: 'px', translateY: 'px', scale: '', scaleX: '', scaleY: '' };

/** Keyframes need plain CSS: react-native-web doesn't convert transform arrays inside @keyframes. */
function toKeyframe(f: Frame): ViewStyle {
  const out: Record<string, unknown> = {};
  if (f.transform) {
    out.transform = f.transform
      .map((item) => {
        const [k, v] = Object.entries(item)[0];
        return `${k}(${typeof v === 'number' ? `${v}${UNIT[k] ?? ''}` : v})`;
      })
      .join(' ');
  }
  if (f.opacity !== undefined) out.opacity = f.opacity;
  return out as ViewStyle;
}

function NativeLoop({ from, to, duration, smooth, alternate, phase = 0, on = true, style, pointerEvents, children }: Props) {
  const v = useRef(new Animated.Value(phase)).current;
  useEffect(() => {
    if (!on) {
      v.stopAnimation();
      v.setValue(0);
      return;
    }
    const easing = smooth ? Easing.inOut(Easing.sin) : Easing.linear;
    const cycle = alternate
      ? Animated.sequence([
          Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration, easing, useNativeDriver: true }),
        ])
      : Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: true });
    // finish the first (partial) cycle from `phase`, then loop
    const first = Animated.timing(v, { toValue: 1, duration: duration * (1 - phase), easing, useNativeDriver: true });
    let loop: Animated.CompositeAnimation | null = null;
    first.start(({ finished }) => {
      if (!finished) return;
      if (!alternate) v.setValue(0);
      loop = Animated.loop(cycle, { iterations: -1, resetBeforeIteration: !alternate });
      if (alternate) {
        // we're at 1: come back down first
        Animated.timing(v, { toValue: 0, duration, easing, useNativeDriver: true }).start(({ finished: f }) => f && loop?.start());
      } else loop.start();
    });
    return () => {
      first.stop();
      loop?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, duration, alternate, smooth]);

  const lerp = (a: number | string, b: number | string) =>
    typeof a === 'number' && typeof b === 'number'
      ? v.interpolate({ inputRange: [0, 1], outputRange: [a, b] })
      : v.interpolate({ inputRange: [0, 1], outputRange: [String(a), String(b)] });
  const transform = from.transform?.map((item, i) => {
    const key = Object.keys(item)[0];
    return { [key]: lerp(item[key], to.transform?.[i]?.[key] ?? item[key]) };
  });
  const animated: Record<string, unknown> = {};
  if (transform) animated.transform = transform;
  if (from.opacity !== undefined) animated.opacity = lerp(from.opacity, to.opacity ?? from.opacity);
  return (
    <Animated.View pointerEvents={pointerEvents} style={[style, animated as ViewStyle]}>
      {children}
    </Animated.View>
  );
}
