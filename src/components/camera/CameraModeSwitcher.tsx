import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius } from '@constants/theme';
import type { CameraMode } from '@services/aiVision';

interface CameraModeSwitcherProps {
  mode: CameraMode;
  onChange: (m: CameraMode) => void;
}

const MODES: Array<{ value: CameraMode; label: string; icon: string }> = [
  { value: 'meal',   label: 'Meal',  icon: '🍽' },
  { value: 'fridge', label: 'Fridge', icon: '🧊' },
  { value: 'waste',  label: 'Waste', icon: '🗑️' },
];

export function CameraModeSwitcher({ mode, onChange }: CameraModeSwitcherProps) {
  return (
    <View style={styles.container}>
      {MODES.map((m) => (
        <ModeTab key={m.value} item={m} active={mode === m.value} onPress={() => onChange(m.value)} />
      ))}
    </View>
  );
}

function ModeTab({
  item, active, onPress,
}: { item: { value: CameraMode; label: string; icon: string }; active: boolean; onPress: () => void }) {
  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: withSpring(
      active ? 'rgba(244,241,232,0.95)' : 'rgba(244,241,232,0.12)',
      { damping: 18 },
    ),
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.tab}>
      <Animated.View style={[styles.tabInner, animStyle]}>
        <DinText style={styles.icon}>{item.icon}</DinText>
        <DinText
          style={[styles.label, active && styles.labelActive]}
        >
          {item.label}
        </DinText>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: BorderRadius.full,
    padding: 4,
  },
  tab: {
    flex: 1,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
  },
  icon: {
    fontSize: 16,
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
