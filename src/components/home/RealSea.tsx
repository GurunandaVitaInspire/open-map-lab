import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useMotion } from '../../lib/motion';
import { SEA_POSTER_NATIVE, SEA_REMOTE } from './seaAssets';

/**
 * Real ocean footage behind the bottom of the landing page (iOS / Android).
 * Streams the same clip the website uses (not bundled, so the app stays small), with the still
 * poster underneath while it loads. Paused whenever motion is paused.
 */
export function RealSea({ height, children }: { height: number; children?: ReactNode }) {
  const motion = useMotion();
  const player = useVideoPlayer({ uri: SEA_REMOTE, useCaching: true }, (p) => {
    p.loop = true;
    p.muted = true;
  });
  useEffect(() => {
    if (motion) player.play();
    else player.pause();
  }, [motion, player]);
  return (
    <View style={[styles.box, { height }]}>
      <Image source={SEA_POSTER_NATIVE} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
});
