import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'soft';
  size?: number; // font size
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
  accessibilityLabel?: string;
};

export function Button({ label, onPress, variant = 'primary', size = 16, disabled, style, icon, accessibilityLabel }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.base,
        { paddingVertical: size * 0.7, paddingHorizontal: size * 1.2, borderRadius: size * 0.75 },
        variant === 'primary' && { backgroundColor: colors.ink },
        variant === 'soft' && { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
        variant === 'ghost' && { backgroundColor: 'transparent' },
        (pressed || hovered) && { opacity: 0.82 },
        disabled && { opacity: 0.35 },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.label, { fontSize: size, color: variant === 'primary' ? '#fff' : colors.ink }]}>{label}</Text>
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
      style={[
        styles.chip,
        { paddingVertical: size * 0.5, paddingHorizontal: size * 0.95, borderRadius: size * 2 },
        selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : null,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={{ fontSize: size, fontWeight: '600', color: selected ? '#fff' : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontWeight: '700', letterSpacing: 0.2 },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
});
