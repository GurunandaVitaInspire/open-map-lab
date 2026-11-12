import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import type { Region, View } from '../data/maps';
import { NATIVE } from './GameUI';

type Props = {
  region: Region;
  view: View;
  scale: number;
  /** position of the map inside its container */
  inset: { left: number; top: number };
  color: string;
  /** blink continuously (quiz target) or glow steadily (puzzle slot) */
  blink?: boolean;
  /** extra lift so it sits on top of the 3D slab */
  rise?: number;
};

/**
 * A highlighted region drawn on top of the map. Small regions also get a pulsing ring so they
 * are easy to spot on a phone.
 */
export function RegionHighlight({ region, view, scale, inset, color, blink = true, rise = 0 }: Props) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!blink) {
      v.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 0.2, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink, region.id, v]);

  const px = (n: number) => n / scale;
  const [x0, y0, x1, y1] = region.bbox;
  const small = Math.max(x1 - x0, y1 - y0) * scale < 34;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: inset.left, top: inset.top, opacity: v }}>
      <Svg width={view.w * scale} height={view.h * scale} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}>
        <G transform={`translate(0 ${-rise})`}>
          <Path d={region.d} fill={color} fillOpacity={0.85} stroke="#fff" strokeWidth={px(2.5)} strokeLinejoin="round" />
          <Path d={region.d} fill="none" stroke={color} strokeWidth={px(1.2)} strokeLinejoin="round" />
          {small && <Circle cx={region.cx} cy={region.cy} r={px(20)} fill="none" stroke={color} strokeWidth={px(3)} />}
        </G>
      </Svg>
    </Animated.View>
  );
}
