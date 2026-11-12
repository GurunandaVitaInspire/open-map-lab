import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { G, Path, Rect } from 'react-native-svg';
import { INDIA } from '../data/maps';
import worldLite from '../data/generated/world-lite.json';
import { makeJigsaw } from '../lib/jigsaw';
import { useMotion } from '../lib/motion';
import { colors, fonts } from '../theme';
import { Looping } from './Looping';
import { buildPicture } from './PuzzlePicture';

export type ArtKind = 'place' | 'quiz' | 'puzzle' | 'world';

/** Small illustration for each game, drawn from the real map data. */
export const GameArt = memo(function GameArt({ kind }: { kind: ArtKind }) {
  if (kind === 'world') return <WorldArt />;
  if (kind === 'puzzle') return <JigsawArt />;
  return <IndiaArt kind={kind} />;
});

function IndiaArt({ kind }: { kind: 'place' | 'quiz' }) {
  const { data } = INDIA;
  const motion = useMotion();
  const hero = data.regions.find((r) => r.id === (kind === 'quiz' ? 'andhra-pradesh' : 'maharashtra'))!;
  const vb = `-40 -60 ${data.width + 80} ${data.height + 110}`;
  return (
    <View style={{ flex: 1 }}>
      <Svg width="100%" height="100%" viewBox={vb}>
        <G transform="translate(0 14)">
          {data.regions.map((r) => (
            <Path key={r.id} d={r.d} fill={colors.landSide} stroke={colors.landSide} strokeWidth={4} />
          ))}
        </G>
        {data.regions.map((r) => (
          <Path key={r.id} d={r.d} fill={kind === 'place' && r.id === hero.id ? colors.landSide : colors.landTop} stroke={colors.landStroke} strokeWidth={2} />
        ))}
        {kind === 'place' && (
          <G transform="translate(-70 -90)">
            <Path d={hero.d} transform="translate(8 26)" fill={colors.shadow} opacity={0.18} />
            <Path d={hero.d} transform="translate(0 12)" fill={colors.primaryDark} />
            <Path d={hero.d} fill={colors.primary} stroke="#fff" strokeWidth={5} />
          </G>
        )}
      </Svg>
      {kind === 'quiz' && (
        <>
          <Looping on={motion} style={StyleSheet.absoluteFill} pointerEvents="none" from={{ opacity: 1 }} to={{ opacity: 0.25 }} duration={600} smooth alternate>
            <Svg width="100%" height="100%" viewBox={vb}>
              <Path d={hero.d} fill={colors.mint} stroke="#fff" strokeWidth={6} />
            </Svg>
          </Looping>
          <View style={styles.bubble} pointerEvents="none">
            <Text style={styles.bubbleText}>?</Text>
          </View>
        </>
      )}
    </View>
  );
}

function JigsawArt() {
  const { data } = INDIA;
  const pic = useMemo(() => buildPicture(data), [data]);
  const jig = useMemo(() => makeJigsaw(data.width, data.height, 4, 3, 7), [data]);
  const lifted = jig.pieces[4]; // middle-left piece pops out
  const vb = `-60 -80 ${data.width + 120} ${data.height + 140}`;
  return (
    <Svg width="100%" height="100%" viewBox={vb}>
      <Rect x={0} y={0} width={data.width} height={data.height} rx={18} fill="#BFE7F8" />
      {pic.states.map((s) => (
        <Path key={s.r.id} d={s.r.d} fill={s.fill} stroke="#fff" strokeWidth={3} />
      ))}
      {/* the empty spot */}
      <Path d={lifted.path} fill="#F3E4CB" />
      {jig.pieces.map((p) => (
        <Path key={p.id} d={p.path} fill="none" stroke="#fff" strokeWidth={7} strokeLinejoin="round" />
      ))}
      {/* the lifted piece, floating up-left */}
      <G transform="translate(-90 -110) rotate(-8 170 420)">
        <Path d={lifted.path} transform="translate(14 30)" fill={colors.shadow} opacity={0.2} />
        <Path d={lifted.path} transform="translate(0 12)" fill="#C9A877" />
        <Path d={lifted.path} fill="#FFD966" stroke="#fff" strokeWidth={7} strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

function WorldArt() {
  // tiny simplified world (37 KB) so the landing page never loads the full world map
  const data = worldLite as { width: number; height: number; regions: { id: string; d: string }[] };
  const hero = data.regions.find((r) => r.id === 'bra') ?? data.regions[0];
  const depth = data.width / 70;
  return (
    <Svg width="100%" height="100%" viewBox={`0 ${-depth * 3} ${data.width} ${data.height + depth * 6}`}>
      <G transform={`translate(0 ${depth})`}>
        {data.regions.map((r) => (
          <Path key={r.id} d={r.d} fill={colors.landSide} stroke={colors.landSide} strokeWidth={depth / 3} />
        ))}
      </G>
      {data.regions.map((r) => (
        <Path key={r.id} d={r.d} fill={r.id === hero.id ? colors.landSide : colors.landTop} stroke={colors.landStroke} strokeWidth={data.width / 600} />
      ))}
      <G transform="translate(-30 -40)">
        <Path d={hero.d} transform={`translate(0 ${depth})`} fill="#2B7FD1" />
        <Path d={hero.d} fill={colors.sky} stroke="#fff" strokeWidth={2.5} />
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.mint,
    borderBottomWidth: 3,
    borderBottomColor: '#119E76',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: { fontFamily: fonts.display, color: '#fff', fontSize: 18, lineHeight: 22 },
});
