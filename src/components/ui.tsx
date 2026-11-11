import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

const VARIANTS = {
  primary: { bg: colors.primary, lip: colors.primaryDark, text: '#fff' },
  sun: { bg: colors.sun, lip: colors.sunDark, text: colors.ink },
  mint: { bg: colors.mint, lip: '#119E76', text: '#fff' },
  soft: { bg: colors.surface, lip: colors.surfaceLip, text: colors.ink },
} as const;

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: keyof typeof VARIANTS;
  size?: number; // font size
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
  accessibilityLabel?: string;
};

/** Chunky "3D" game button: a coloured face sitting on a darker lip that presses down. */
export function Button({ label, onPress, variant = 'primary', size = 16, disabled, style, icon, accessibilityLabel }: ButtonProps) {
  const v = VARIANTS[variant];
  const lip = Math.max(3, Math.round(size * 0.28));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: v.bg,
          borderBottomColor: v.lip,
          borderBottomWidth: pressed ? 1 : lip,
          marginTop: pressed ? lip - 1 : 0,
          paddingVertical: size * 0.62,
          paddingHorizontal: size * 1.2,
          borderRadius: size * 0.85,
        },
        variant === 'soft' && { borderWidth: 2, borderColor: colors.surfaceLip },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {icon}
      {label ? <Text style={[styles.btnLabel, { fontSize: size, color: v.text }]}>{label}</Text> : null}
    </Pressable>
  );
}

/** Round icon button with the same pressable lip. */
export function IconButton({ onPress, children, size = 40, accessibilityLabel }: { onPress: () => void; children: ReactNode; size?: number; accessibilityLabel: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: size, height: size, borderRadius: size / 2, borderBottomWidth: pressed ? 1 : 4, marginTop: pressed ? 3 : 0 },
      ]}
    >
      {children}
    </Pressable>
  );
}

type ChipProps = { label: string; selected: boolean; onPress: () => void; size?: number; disabled?: boolean };

export function Chip({ label, selected, onPress, size = 15, disabled }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        {
          paddingVertical: size * 0.45,
          paddingHorizontal: size * 0.95,
          borderRadius: size * 0.8,
          borderBottomWidth: pressed ? 2 : 4,
          marginTop: pressed ? 2 : 0,
        },
        selected && { backgroundColor: colors.primary, borderColor: colors.primary, borderBottomColor: colors.primaryDark },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={{ fontSize: size, fontFamily: fonts.bodyBold, color: selected ? '#fff' : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

/** White card that sits on a soft lavender lip, like a game tile. */
export function Card({ children, style, lip = 6 }: { children: ReactNode; style?: StyleProp<ViewStyle>; lip?: number }) {
  return <View style={[styles.card, { borderBottomWidth: lip }, style]}>{children}</View>;
}

export function Pill({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.pill, style]}>{children}</View>;
}

export function Label({ children, size = 12, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, { fontSize: size }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnLabel: { fontFamily: fonts.black, letterSpacing: 0.3 },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.surfaceLip,
    borderBottomColor: colors.surfaceLip,
  },
  chip: {
    borderWidth: 2,
    borderColor: colors.surfaceLip,
    borderBottomColor: colors.surfaceLip,
    backgroundColor: colors.surface,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.line,
    borderBottomColor: colors.surfaceLip,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 2,
    borderColor: colors.line,
    borderBottomWidth: 4,
    borderBottomColor: colors.surfaceLip,
  },
  label: { fontFamily: fonts.bodyBold, color: colors.inkSoft, letterSpacing: 1.4, textTransform: 'uppercase' },
});
