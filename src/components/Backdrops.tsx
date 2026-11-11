import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

/** Bright ocean with a gentle wave pattern, behind the map. */
export function OceanBackdrop() {
  // SVG ids are global to the page. Several oceans can be mounted at once (the home screen stays
  // mounted, hidden, under the game), so each one needs its own ids, or url(#…) can resolve to a
  // hidden copy and paint nothing.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const sea = `sea-${uid}`;
  const waves = `waves-${uid}`;
  return (
    // solid colour underneath, in case the SVG fill ever fails to paint
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.ocean }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={sea} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.ocean} />
            <Stop offset="1" stopColor={colors.oceanDeep} />
          </LinearGradient>
          <Pattern id={waves} width="56" height="28" patternUnits="userSpaceOnUse">
            <Path d="M4 14c4-4 8-4 12 0s8 4 12 0" fill="none" stroke={colors.wave} strokeWidth={2} strokeLinecap="round" />
            <Path d="M32 26c4-4 8-4 12 0" fill="none" stroke={colors.wave} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${sea})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${waves})`} opacity={0.9} />
      </Svg>
    </View>
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
