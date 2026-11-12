import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useMotion } from '../../lib/motion';
import { colors, fonts } from '../../theme';
import { StarIcon } from '../icons';
import { Looping } from '../Looping';

const NATIVE = Platform.OS !== 'web';

export type HangingItem = {
  key: string;
  title: string;
  subtitle: string;
  art: ReactNode;
  tint: string;
  clip: string;
  clipDark: string;
  stars: number;
  note?: string;
};

type Props = { items: HangingItem[]; onPick: (key: string) => void; board: boolean; s: (n: number) => number };

/**
 * Polaroid-style game cards pegged to a curved rope. Each card drops in with a damped swing,
 * then sways gently around its clip; tapping gives it a little kick.
 */
export function HangingCards({ items, onPick, board, s }: Props) {
  const [width, setWidth] = useState(0);
  const gap = board ? s(26) : 16;
  const pad = board ? s(30) : 20;
  const cardW = board ? Math.min(s(250), (width - pad * 2 - gap * (items.length - 1)) / items.length) : 196;
  const cardH = cardW * (board ? 1.24 : 1.4);
  const contentW = board ? width : pad * 2 + items.length * cardW + (items.length - 1) * gap;
  const sag = board ? s(60) : 34;
  const ropeY = board ? s(24) : 20;
  const height = ropeY + sag + cardH + s(40);

  // quadratic rope from just outside the left edge to just outside the right edge
  const x0 = -30;
  const x1 = contentW + 30;
  const ropeAt = (x: number) => {
    const t = (x - x0) / (x1 - x0);
    return { y: ropeY + 4 * sag * t * (1 - t), slope: (4 * sag * (1 - 2 * t)) / (x1 - x0) };
  };
  const startX = board ? (contentW - (items.length * cardW + (items.length - 1) * gap)) / 2 : pad;

  const rope = (
    <Svg width={contentW} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={`M${x0} ${ropeY} Q ${(x0 + x1) / 2} ${ropeY + 2 * sag} ${x1} ${ropeY}`} stroke="#B9A7E8" strokeWidth={3} fill="none" />
      <Path d={`M${x0} ${ropeY + 1.5} Q ${(x0 + x1) / 2} ${ropeY + 2 * sag + 1.5} ${x1} ${ropeY + 1.5}`} stroke="#fff" strokeWidth={1} fill="none" opacity={0.6} />
    </Svg>
  );

  const cards =
    width > 0 &&
    items.map((it, i) => {
      const cx = startX + cardW / 2 + i * (cardW + gap);
      const r = ropeAt(cx);
      const tilt = (Math.atan(r.slope) * 180) / Math.PI * 0.6 + (i % 2 ? 2.5 : -2.5);
      return <HangingCard key={it.key} item={it} x={cx - cardW / 2} clipY={r.y} w={cardW} h={cardH} tilt={tilt} index={i} onPress={() => onPick(it.key)} s={s} />;
    });

  if (board) {
    return (
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && rope}
        {cards}
      </View>
    );
  }
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width: contentW, height }}>
        {width > 0 && rope}
        {cards}
      </ScrollView>
      <Text style={styles.swipe}>Swipe for more games →</Text>
    </View>
  );
}

function HangingCard({
  item,
  x,
  clipY,
  w,
  h,
  tilt,
  index,
  onPress,
  s,
}: {
  item: HangingItem;
  x: number;
  clipY: number;
  w: number;
  h: number;
  tilt: number;
  index: number;
  onPress: () => void;
  s: (n: number) => number;
}) {
  const motion = useMotion();
  // Entrance drop/swing and the tap "kick" are short one-off animations; the endless idle sway is
  // a GPU loop (Looping), so it costs nothing while the page sits open.
  const angle = useRef(new Animated.Value(motion ? tilt + (index % 2 ? -14 : 14) : tilt)).current;
  const drop = useRef(new Animated.Value(motion ? -70 : 0)).current;

  useEffect(() => {
    if (!motion) {
      angle.setValue(tilt);
      drop.setValue(0);
      return;
    }
    const entrance = Animated.sequence([
      Animated.delay(250 + index * 110),
      Animated.parallel([
        Animated.spring(drop, { toValue: 0, friction: 6, tension: 70, useNativeDriver: NATIVE }),
        Animated.spring(angle, { toValue: tilt, friction: 2.2, tension: 26, useNativeDriver: NATIVE }),
      ]),
    ]);
    entrance.start();
    return () => entrance.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion, tilt]);

  const kick = () => {
    if (motion) {
      Animated.sequence([
        Animated.timing(angle, { toValue: tilt + (index % 2 ? -9 : 9), duration: 110, useNativeDriver: NATIVE }),
        Animated.spring(angle, { toValue: tilt, friction: 2.6, tension: 40, useNativeDriver: NATIVE }),
      ]).start();
    }
    onPress();
  };

  const pivot = h / 2 + 12; // the clip sits 12px above the card
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: clipY + 12,
        width: w,
        height: h,
        transform: [
          { translateY: drop },
          { translateY: -pivot },
          { rotate: angle.interpolate({ inputRange: [-90, 90], outputRange: ['-90deg', '90deg'] }) },
          { translateY: pivot },
        ],
      }}
    >
      <Looping
        on={motion}
        style={StyleSheet.absoluteFill}
        from={{ transform: [{ translateY: -pivot }, { rotate: '-2deg' }, { translateY: pivot }] }}
        to={{ transform: [{ translateY: -pivot }, { rotate: '2deg' }, { translateY: pivot }] }}
        duration={1900 + index * 160}
        phase={(index * 0.37) % 1}
        smooth
        alternate
      >
      {/* clothes-peg clip */}
      <View style={[styles.clipWrap, { left: w / 2 - 9, top: -24 }]} pointerEvents="none">
        <Svg width={18} height={34} viewBox="0 0 18 34">
          <Rect x={1} y={4} width={16} height={28} rx={4} fill={item.clipDark} />
          <Rect x={1} y={1} width={16} height={28} rx={4} fill={item.clip} />
          <Rect x={7} y={6} width={4} height={12} rx={2} fill="rgba(255,255,255,0.55)" />
        </Svg>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle}`}
        onPress={kick}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          styles.card,
          { borderRadius: s(18), padding: s(10) },
          (hovered || pressed) && { transform: [{ scale: pressed ? 0.98 : 1.04 }] },
        ]}
      >
        <View style={[styles.art, { backgroundColor: item.tint, borderRadius: s(12), height: w * 0.78 }]}>{item.art}</View>
        <View style={{ paddingHorizontal: 4, paddingTop: s(8), gap: 2, flex: 1 }}>
          <Text style={[styles.title, { fontSize: s(19), lineHeight: s(23) }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.subtitle, { fontSize: s(12.5) }]} numberOfLines={2}>
            {item.subtitle}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
            {[0, 1, 2].map((k) => (
              <StarIcon key={k} size={s(14)} filled={k < item.stars} />
            ))}
            {item.note ? <Text style={[styles.note, { fontSize: s(11) }]}>{item.note}</Text> : null}
          </View>
        </View>
      </Pressable>
      </Looping>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clipWrap: { position: 'absolute', zIndex: 2 },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    shadowColor: '#2A1F5C',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    borderWidth: 1,
    borderColor: '#EFEAFB',
  },
  art: { overflow: 'hidden', padding: 6 },
  title: { fontFamily: fonts.display, color: colors.ink },
  subtitle: { fontFamily: fonts.body, color: colors.inkSoft, lineHeight: 16 },
  note: { fontFamily: fonts.bodyBold, color: colors.inkSoft, marginLeft: 4 },
  swipe: { fontFamily: fonts.bodyBold, color: colors.inkSoft, fontSize: 12, textAlign: 'center', marginTop: 2 },
});
