import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '../../theme';
import { Button, Chip, Label } from '../ui';

const NATIVE = Platform.OS !== 'web';

export type ChoiceGroup = {
  label: string;
  options: { label: string; value: string; disabled?: boolean }[];
  value: string;
  onChange: (v: string) => void;
  help?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  art: ReactNode;
  tint: string;
  groups: ChoiceGroup[];
  note?: string;
  playLabel: string;
  onPlay: () => void;
  board: boolean;
  s: (n: number) => number;
};

/** Slide-up sheet (centred card on big screens) with a game's options and a big Play button. */
export function SetupSheet({ open, onClose, title, subtitle, art, tint, groups, note, playLabel, onPlay, board, s }: Props) {
  const v = useRef(new Animated.Value(0)).current;
  // only mounted while open (or animating closed), so a closed sheet costs nothing
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(v, {
      toValue: open ? 1 : 0,
      duration: open ? 300 : 200,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: NATIVE,
    }).start(({ finished }) => finished && !open && setMounted(false));
  }, [open, v]);
  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(34,24,74,0.38)', opacity: v }]}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, { justifyContent: board ? 'center' : 'flex-end', alignItems: 'center' }]} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            board ? { width: s(560), borderRadius: s(28), maxHeight: '88%' } : { width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%' },
            {
              opacity: v,
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [board ? 30 : 320, 0] }) },
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [board ? 0.96 : 1, 1] }) },
              ],
            },
          ]}
        >
          <ScrollView contentContainerStyle={{ padding: s(22), gap: s(18) }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: s(14), alignItems: 'center' }}>
              <View style={[styles.art, { backgroundColor: tint, width: s(96), height: s(96), borderRadius: s(18) }]}>{art}</View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { fontSize: s(26), lineHeight: s(30) }]}>{title}</Text>
                <Text style={[styles.subtitle, { fontSize: s(14) }]}>{subtitle}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close} hitSlop={10}>
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  <Path d="M6 6l12 12M18 6L6 18" stroke={colors.ink} strokeWidth={3} strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
            {groups.map((g) => (
              <View key={g.label} style={{ gap: s(10) }}>
                <Label size={s(12)}>{g.label}</Label>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                  {g.options.map((o) => (
                    <Chip key={o.value} size={s(15)} label={o.label} selected={g.value === o.value} disabled={o.disabled} onPress={() => g.onChange(o.value)} />
                  ))}
                </View>
                {g.help ? <Text style={[styles.help, { fontSize: s(13) }]}>{g.help}</Text> : null}
              </View>
            ))}
            {note ? <Text style={[styles.help, { fontSize: s(13) }]}>{note}</Text> : null}
            <Button label={playLabel} variant="sun" size={s(20)} onPress={onPlay} icon={<PlayGlyph size={s(18)} />} />
          </ScrollView>
        </Animated.View>
      </View>
    </View>
  );
}

function PlayGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.5v15l12.5-7.5z" fill={colors.ink} strokeLinejoin="round" stroke={colors.ink} strokeWidth={2} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    shadowColor: '#2A1F5C',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  art: { overflow: 'hidden', padding: 6 },
  title: { fontFamily: fonts.display, color: colors.ink },
  subtitle: { fontFamily: fonts.body, color: colors.inkSoft, lineHeight: 19 },
  help: { fontFamily: fonts.body, color: colors.inkSoft, lineHeight: 19 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    alignSelf: 'flex-start',
  },
});
