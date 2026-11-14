import { memo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useMotion } from '../../lib/motion';
import { Looping } from '../Looping';
import { Globe } from './Globe';

// Real imagery (public domain / CC0, see assets/scene/CREDITS.md)
const CLOUDS = [
  { src: require('../../../assets/scene/cloud-1.webp'), ratio: 463 / 640 },
  { src: require('../../../assets/scene/cloud-2.webp'), ratio: 541 / 640 },
  { src: require('../../../assets/scene/cloud-3.webp'), ratio: 476 / 640 },
];
const EARTH = require('../../../assets/scene/earth.jpg');
const EARTH_CLOUDS = require('../../../assets/scene/earth-clouds.webp');
const BALLOON = require('../../../assets/scene/balloon.webp');
const BALLOON_RATIO = 305 / 240;

type Drift = { cloud: number; top: number; w: number; opacity: number; secs: number; phase: number };

/** Big near clouds drift faster than small far ones, which gives the sky depth (parallax). */
const BOARD_SKY: Drift[] = [
  { cloud: 0, top: 0.02, w: 300, opacity: 0.95, secs: 150, phase: 0.08 },
  { cloud: 2, top: 0.2, w: 220, opacity: 0.7, secs: 210, phase: 0.55 },
  { cloud: 1, top: 0.43, w: 260, opacity: 0.6, secs: 240, phase: 0.3 },
  { cloud: 0, top: 0.66, w: 180, opacity: 0.5, secs: 280, phase: 0.8 },
  { cloud: 2, top: 0.05, w: 150, opacity: 0.55, secs: 300, phase: 0.4 },
];
const PHONE_SKY: Drift[] = [
  { cloud: 0, top: 0.02, w: 190, opacity: 0.9, secs: 110, phase: 0.15 },
  { cloud: 2, top: 0.3, w: 150, opacity: 0.6, secs: 160, phase: 0.6 },
  { cloud: 1, top: 0.62, w: 170, opacity: 0.5, secs: 190, phase: 0.35 },
];

/** Soft, photo-real clouds drifting slowly across the sky, behind everything else. */
export const SkyClouds = memo(function SkyClouds({ board }: { board: boolean }) {
  const on = useMotion();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const drifts = board ? BOARD_SKY : PHONE_SKY;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setBox({ w: Math.round(e.nativeEvent.layout.width / 50) * 50, h: e.nativeEvent.layout.height })}
    >
      {box.w > 0 &&
        drifts.map((d, i) => {
          const c = CLOUDS[d.cloud];
          const w = board ? Math.max(d.w, (box.w * d.w) / 1366) : d.w;
          return (
            <Looping
              key={i}
              on={on}
              style={{ position: 'absolute', top: box.h * d.top, left: 0, opacity: d.opacity }}
              from={{ transform: [{ translateX: -w }] }}
              to={{ transform: [{ translateX: box.w }] }}
              duration={d.secs * 1000}
              phase={d.phase}
            >
              <Image source={c.src} style={{ width: w, height: w * c.ratio }} />
            </Looping>
          );
        })}
    </View>
  );
});

/** A real hot-air balloon, rising and sinking gently with a slow sway. */
function Balloon({ width, on, bob = 16, secs = 4.6, phase = 0 }: { width: number; on: boolean; bob?: number; secs?: number; phase?: number }) {
  return (
    <Looping on={on} from={{ transform: [{ translateY: 0 }] }} to={{ transform: [{ translateY: -bob }] }} duration={secs * 1000} phase={phase} smooth alternate>
      <Looping
        on={on}
        from={{ transform: [{ rotate: '-2.5deg' }] }}
        to={{ transform: [{ rotate: '2.5deg' }] }}
        duration={secs * 700}
        phase={(phase + 0.3) % 1}
        smooth
        alternate
      >
        <Image source={BALLOON} style={{ width, height: width * BALLOON_RATIO }} accessibilityIgnoresInvertColors />
      </Looping>
    </Looping>
  );
}

/**
 * Fills the empty margins beside the game cards on wide screens: the real Earth spinning on the
 * left, hot-air balloons floating on the right (a hazy far one behind a near one, for depth).
 */
export function SideScenes({ side, height, s }: { side: number; height: number; s: (n: number) => number }) {
  const on = useMotion();
  if (side < 150 || height < 300) return null;
  const globe = Math.min(side * 0.72, s(250), height * 0.38);
  const balloon = Math.min(side * 0.5, s(170), (height * 0.42) / BALLOON_RATIO);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.col, { left: 0, width: side }]} pointerEvents="box-none">
        <Looping on={on} pointerEvents="box-none" from={{ transform: [{ translateY: 6 }] }} to={{ transform: [{ translateY: -6 }] }} duration={5200} smooth alternate>
          <Globe size={globe} earth={EARTH} clouds={EARTH_CLOUDS} on={on} interactive />
        </Looping>
      </View>
      <View style={[styles.col, { right: 0, width: side }]} pointerEvents="none">
        {/* far balloon: small, hazy, slower */}
        <View style={{ position: 'absolute', top: '16%', right: side * 0.12, opacity: 0.55 }}>
          <Balloon width={balloon * 0.42} on={on} bob={8} secs={6.2} phase={0.5} />
        </View>
        <View style={{ marginTop: height * 0.12, marginRight: side * 0.08 }}>
          <Balloon width={balloon} on={on} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
