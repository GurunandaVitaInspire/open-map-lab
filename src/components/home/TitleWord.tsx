import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cssAnimation, IS_WEB } from '../../lib/cssAnim';
import { fonts } from '../../theme';

const NAVY = '#1E1856';
const BROWN = '#5A2A00';

/** 16 directions around a circle, for a smooth outline made of text shadows. */
const DIRS = Array.from({ length: 16 }, (_, i) => [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)]);

/**
 * One CSS text-shadow list = a thick outline + a solid 3D extrusion below it + a soft drop shadow.
 * It is painted once (static), so it costs nothing after the headline has appeared.
 */
function gameShadow(o: number, depth: number, ink: string) {
  const r = (n: number) => `${n.toFixed(2)}px`;
  const parts = DIRS.map(([x, y]) => `${r(x * o)} ${r(y * o)} 0 ${ink}`);
  for (let k = 1; k <= depth; k++) {
    parts.push(`0 ${r(k + o)} 0 ${ink}`, `${r(o * 0.75)} ${r(k + o * 0.7)} 0 ${ink}`, `${r(-o * 0.75)} ${r(k + o * 0.7)} 0 ${ink}`);
  }
  parts.push(`0 ${r(depth + o + 5)} ${r(depth * 2.4)} rgba(16, 32, 90, 0.35)`);
  return parts.join(', ');
}

// metallic gold: warm vertical gradient, with a white glint that sweeps across every few seconds
const GOLD_FACE = {
  color: 'transparent',
  backgroundImage:
    'linear-gradient(105deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0) 60%), ' +
    'linear-gradient(180deg, #FFF8C9 0%, #FFE36B 28%, #FFC21A 55%, #F59E0B 80%, #D97706 100%)',
  backgroundSize: '260% 100%, 100% 100%',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: '100% 0, 0 0',
  backgroundClip: 'text',
} as object;

const GLINT = IS_WEB
  ? cssAnimation(
      {
        '0%': { backgroundPosition: '100% 0, 0 0' },
        '32%': { backgroundPosition: '0% 0, 0 0' },
        '100%': { backgroundPosition: '0% 0, 0 0' },
      } as never,
      { duration: 4200, easing: 'cubic-bezier(0.45, 0, 0.55, 1)', delay: 1600 },
    )
  : null;

/**
 * A headline word styled like a game title: white (or metallic gold) letters with a thick dark
 * outline and a chunky 3D extrusion. On the web the outline and depth are one text-shadow list;
 * the gold face sits on top as a second layer (gradient text can't carry shadows itself).
 */
export const TitleWord = memo(function TitleWord({ text, size, gold = false, shine = true }: { text: string; size: number; gold?: boolean; shine?: boolean }) {
  const o = Math.max(1.6, size * 0.05);
  const depth = Math.max(3, Math.round(size * 0.085));
  const ink = gold ? BROWN : NAVY;
  const base = [styles.word, { fontSize: size, lineHeight: size * 1.08 }];
  if (!IS_WEB) {
    // apps: a solid extrusion with a crisp edge (one shadow is all native text supports)
    return (
      <View style={{ paddingBottom: depth }}>
        <Text style={[base, { color: ink, position: 'absolute', top: depth }]}>{text}</Text>
        <Text style={[base, { color: gold ? '#FFC83D' : '#FFFFFF', textShadowColor: ink, textShadowRadius: o * 1.6, textShadowOffset: { width: 0, height: 0 } }]}>
          {text}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ paddingHorizontal: o, paddingBottom: depth + o }}>
      <Text style={[base, { color: ink, textShadow: gameShadow(o, depth, ink) } as object]}>{text}</Text>
      <Text
        aria-hidden
        style={[base, styles.face, { left: o }, gold ? [GOLD_FACE, shine && GLINT] : { color: '#FFFFFF' }] as object}
      >
        {text}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  word: { fontFamily: fonts.display, letterSpacing: 0.5, textAlign: 'center' },
  face: { position: 'absolute', top: 0 },
});
