import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius } from '@constants/theme';
import type { CameraMode } from '@services/aiVision';

interface Props {
  mode: CameraMode;
  onChange: (m: CameraMode) => void;
}

const MODES: Array<{ value: CameraMode; label: string; icon: string }> = [
  { value: 'meal',   label: 'Meal',   icon: '🍽' },
  { value: 'fridge', label: 'Fridge', icon: '🧊' },
];

export function CameraModeSwitcher({ mode, onChange }: Props) {
  return (
    <View style={styles.container}>
      {MODES.map((m) => {
        const active = mode === m.value;
        return (
          <TouchableOpacity
            key={m.value}
            onPress={() => onChange(m.value)}
            style={[styles.tab, active && styles.tabActive]}
            activeOpacity={0.8}
          >
            <DinText style={styles.icon}>{m.icon}</DinText>
            <DinText style={[styles.label, active && styles.labelActive]}>
              {m.label}
            </DinText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(45,58,31,0.75)',
    borderRadius: BorderRadius.full,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
  },
  tabActive: {
    backgroundColor: Colors.gold,
  },
  icon: {
    fontSize: 17,
  },
  label: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 14,
    color: 'rgba(244,241,232,0.65)',
  },
  labelActive: {
    color: Colors.deepGreen,
  },
});
