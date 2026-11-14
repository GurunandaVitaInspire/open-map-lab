import { memo, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { useMotion } from '../lib/motion';
import { colors } from '../theme';
import { Looping } from './Looping';

/** SVG ids are page-global; several copies of a backdrop can be mounted, so each gets its own. */
function useSvgId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/**
 * Bright ocean behind the maps. Two layers of little waves drift at different speeds and
 * directions with a gentle bob, which reads as moving water without being distracting.
 * All motion is GPU-driven (see Looping), so it never slows down dragging.
 */
export const OceanBackdrop = memo(function OceanBackdrop({ still = false }: { still?: boolean }) {
  const on = useMotion() && !still;
  const sea = useSvgId('sea');
  const w1 = useSvgId('w1');
  const w2 = useSvgId('w2');
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
      {/* layer 1: small waves drifting right, bobbing */}
      <Looping on={on} style={StyleSheet.absoluteFill} from={{ transform: [{ translateY: 0 }] }} to={{ transform: [{ translateY: 3 }] }} duration={2500} smooth alternate>
        <Looping on={on} style={[styles.layer, { left: -56, right: 0 }]} from={{ transform: [{ translateX: 0 }] }} to={{ transform: [{ translateX: 56 }] }} duration={7000}>
          <Svg width="100%" height="100%">
            <Defs>
              <Pattern id={w1} width="56" height="28" patternUnits="userSpaceOnUse">
                <Path d="M4 14c4-4 8-4 12 0s8 4 12 0" fill="none" stroke={colors.wave} strokeWidth={2} strokeLinecap="round" />
              </Pattern>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${w1})`} opacity={0.95} />
          </Svg>
        </Looping>
      </Looping>
      {/* layer 2: wider, fainter waves drifting left */}
      <Looping on={on} style={[styles.layer, { left: -84, right: 0 }]} from={{ transform: [{ translateX: 0 }] }} to={{ transform: [{ translateX: -84 }] }} duration={11000}>
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id={w2} width="84" height="40" patternUnits="userSpaceOnUse">
              <Path d="M40 34c5-5 10-5 15 0" fill="none" stroke="#E6F7FD" strokeWidth={2} strokeLinecap="round" />
            </Pattern>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${w2})`} opacity={0.6} />
        </Svg>
      </Looping>
    </View>
  );
});

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, bottom: 0 },
});
