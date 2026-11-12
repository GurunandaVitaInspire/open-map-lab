import { Platform, StyleSheet, type ViewStyle } from 'react-native';

export const IS_WEB = Platform.OS === 'web';

type Frames = Record<string, ViewStyle>;
type Options = {
  duration: number;
  easing?: string;
  delay?: number;
  direction?: 'normal' | 'alternate';
  iterations?: number | 'infinite';
  fill?: 'none' | 'forwards' | 'both';
};

const cache = new Map<string, ViewStyle>();

/**
 * A CSS @keyframes animation as a react-native-web style (web only). The browser runs these on the
 * compositor, so ambient loops (waves, clouds, swaying cards…) cost no JavaScript per frame and
 * never compete with dragging. Styles are cached, so each distinct animation creates one CSS rule.
 */
export function cssAnimation(frames: Frames, o: Options): ViewStyle {
  const key = JSON.stringify([frames, o]);
  let style = cache.get(key);
  if (!style) {
    style = StyleSheet.create({
      a: {
        animationKeyframes: [frames],
        animationDuration: `${o.duration}ms`,
        animationTimingFunction: o.easing ?? 'linear',
        animationDelay: `${o.delay ?? 0}ms`,
        animationDirection: o.direction ?? 'normal',
        animationIterationCount: o.iterations ?? 'infinite',
        animationFillMode: o.fill ?? 'none',
      } as unknown as ViewStyle,
    }).a;
    cache.set(key, style);
  }
  return style;
}

export const EASE_IN_OUT = 'cubic-bezier(0.45, 0, 0.55, 1)';
