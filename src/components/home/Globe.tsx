import { memo, useId } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { IS_WEB } from '../../lib/cssAnim';
import { Looping } from '../Looping';

type Props = {
  size: number;
  /** equirectangular (2:1) Earth picture */
  earth: ImageSourcePropType;
  /** optional equirectangular cloud map (white clouds on black), blended on top */
  clouds?: ImageSourcePropType;
  /** seconds for one full turn */
  turn?: number;
  on?: boolean;
};

/**
 * A spinning Earth made from a real satellite picture (NASA Blue Marble).
 * The flat map slides behind a round window; light and shadow painted over it turn the disc
 * into a sphere, and a soft blue rim of atmosphere glows around it. All motion is a GPU loop.
 */
export const Globe = memo(function Globe({ size, earth, clouds, turn = 70, on = true }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const glow = size * 1.36;
  const strip = (src: ImageSourcePropType, blend?: object) => (
    <View style={[styles.strip, { width: size * 4, height: size }]}>
      <Image source={src} style={[{ width: size * 2, height: size }, blend]} resizeMode="stretch" />
      <Image source={src} style={[{ width: size * 2, height: size }, blend]} resizeMode="stretch" />
    </View>
  );
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {/* atmosphere */}
      <Svg width={glow} height={glow} style={{ position: 'absolute', left: (size - glow) / 2, top: (size - glow) / 2 }}>
        <Defs>
          <RadialGradient id={`atm-${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0.66" stopColor="#7CC4FF" stopOpacity={0.55} />
            <Stop offset="0.78" stopColor="#7CC4FF" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#7CC4FF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#atm-${id})`} />
      </Svg>

      <View style={[styles.ball, { width: size, height: size, borderRadius: size / 2 }]}>
        {/* the Earth turns west → east, so the surface slides left to right */}
        <Looping on={on} style={StyleSheet.absoluteFill} from={{ transform: [{ translateX: -size * 2 }] }} to={{ transform: [{ translateX: 0 }] }} duration={turn * 1000}>
          {strip(earth)}
        </Looping>
        {clouds && (
          <Looping
            on={on}
            style={[StyleSheet.absoluteFill, { opacity: 0.85 }]}
            from={{ transform: [{ translateX: -size * 2 }] }}
            to={{ transform: [{ translateX: 0 }] }}
            duration={turn * 1000 * 0.8}
            phase={0.3}
          >
            {strip(clouds, IS_WEB ? ({ mixBlendMode: 'screen' } as object) : { opacity: 0.35 })}
          </Looping>
        )}
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
    </View>
  );
});

const styles = StyleSheet.create({
  ball: { overflow: 'hidden', backgroundColor: '#0B2E5C' },
  strip: { position: 'absolute', left: 0, top: 0, flexDirection: 'row' },
});
