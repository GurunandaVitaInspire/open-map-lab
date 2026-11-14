import * as Haptics from 'expo-haptics';
import { Animated, Platform } from 'react-native';

/**
 * Shared "feel" for everything you pick up and drag (map pieces, jigsaw pieces).
 * Modelled on iOS: a quick lift on touch, the piece follows the finger 1:1, leans slightly in the
 * direction it is moving, and lands with a short, critically-damped spring (no wobble, no lag).
 */

const IS_WEB = Platform.OS === 'web';

/**
 * iOS-style springs written as stiffness/damping (response ≈ seconds to settle, ratio < 1 = a hint
 * of overshoot). Position springs stop as soon as they are within half a pixel, so completion
 * callbacks fire when the motion *looks* finished.
 */
const spring = (response: number, ratio: number, rest = 0.002) => ({
  stiffness: (2 * Math.PI / response) ** 2,
  damping: (4 * Math.PI * ratio) / response,
  mass: 1,
  useNativeDriver: false,
  restDisplacementThreshold: rest,
  restSpeedThreshold: rest,
});

export const SPRING = {
  /** lift on touch: fast, with the faintest pop (it may also be shrinking from the tray's size) */
  pop: spring(0.3, 0.78),
  /** easing the piece from where it sat to under the finger */
  follow: spring(0.22, 1, 0.5),
  /** gliding into its exact spot */
  snap: spring(0.32, 0.86, 0.5),
  /** flying back to the tray */
  home: spring(0.42, 0.9, 0.5),
  /** scale / tilt settling */
  settle: spring(0.3, 0.8),
};

/** Promote a moving element to its own GPU layer on the web so dragging never repaints it. */
export const GPU_LAYER = IS_WEB ? ({ willChange: 'transform' } as object) : null;

/** A soft, real shadow under a lifted piece (web). Native pieces draw their own shadow. */
export const LIFT_SHADOW = IS_WEB ? ({ filter: 'drop-shadow(0px 14px 14px rgba(34, 20, 90, 0.30))' } as object) : null;

export const haptic = {
  pick: () => {
    if (!IS_WEB) Haptics.selectionAsync().catch(() => {});
  },
  snap: () => {
    if (!IS_WEB) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
};

/**
 * Lean a dragged piece into its motion (degrees), the way a card tilts in your hand, and let it
 * straighten up again as soon as the finger slows or stops.
 */
export function makeLean(tilt: Animated.Value, maxDeg = 8) {
  let now = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const settle = () => Animated.spring(tilt, { toValue: 0, ...SPRING.settle }).start();
  return {
    /** call on every move with the gesture's horizontal velocity (px/ms) */
    move(vx: number) {
      tilt.stopAnimation((v) => (now = v));
      const target = Math.max(-maxDeg, Math.min(maxDeg, vx * 6));
      now += (target - now) * 0.3;
      tilt.setValue(now);
      if (timer) clearTimeout(timer);
      timer = setTimeout(settle, 70);
    },
    reset() {
      if (timer) clearTimeout(timer);
      timer = null;
      now = 0;
    },
  };
}

export const tiltDeg = (tilt: Animated.Value) => tilt.interpolate({ inputRange: [-45, 45], outputRange: ['-45deg', '45deg'] });
