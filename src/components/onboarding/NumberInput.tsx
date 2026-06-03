import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';

interface NumberInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  unit?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}

export function NumberInput({ label, value, onChangeText, unit, placeholder, min, max }: NumberInputProps) {
  function adjust(delta: number) {
    const current = parseFloat(value) || 0;
    const next = Math.max(min ?? 0, Math.min(max ?? 999, current + delta));
    onChangeText(next.toString());
  }

  return (
    <View style={styles.container}>
      <DinText variant="label" style={styles.label}>{label}</DinText>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => adjust(-1)} style={styles.stepper}>
          <DinText style={styles.stepperText}>−</DinText>
        </TouchableOpacity>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            keyboardType="numeric"
            placeholder={placeholder ?? '0'}
            placeholderTextColor={Colors.textMuted}
          />
          {unit ? <DinText variant="caption" style={styles.unit}>{unit}</DinText> : null}
        </View>
        <TouchableOpacity onPress={() => adjust(1)} style={styles.stepper}>
          <DinText style={styles.stepperText}>+</DinText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepper: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: 22,
    color: Colors.deepGreen,
    fontFamily: FontFamily.sora,
    lineHeight: 26,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
    gap: 6,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.frauncesBold,
    fontSize: 26,
    color: Colors.deepGreen,
    textAlign: 'center',
  },
  unit: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
});
