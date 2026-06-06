import React from 'react';
import { ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { DinText } from './DinText';
import { PressableCard } from './PressableCard';
import { Colors, FontFamily, BorderRadius } from '@constants/theme';

interface DinButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function DinButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: DinButtonProps) {
  return (
    <PressableCard
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.96}
      style={[styles.base, styles[variant], (disabled || loading) ? styles.disabled : undefined, style ?? {}] as any}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? Colors.paleGoldLight : Colors.deepGreen} size="small" />
      ) : (
        <DinText
          style={[
            styles.label,
            variant === 'primary' ? styles.labelPrimary : styles.labelSecondary,
          ]}
        >
          {label}
        </DinText>
      )}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  primary:   { backgroundColor: Colors.deepGreen },
  secondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.deepGreen },
  ghost:     { backgroundColor: 'transparent' },
  disabled:  { opacity: 0.45 },
  label: { fontSize: 16, fontFamily: FontFamily.soraSemibold, letterSpacing: 0.3 },
  labelPrimary:   { color: Colors.paleGoldLight },
  labelSecondary: { color: Colors.deepGreen },
});
