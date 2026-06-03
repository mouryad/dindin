import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';

interface ChipSelectorProps<T extends string> {
  options: Array<{ label: string; value: T }>;
  selected: T[];
  onToggle: (value: T) => void;
  multiSelect?: boolean;
}

export function ChipSelector<T extends string>({
  options,
  selected,
  onToggle,
  multiSelect = true,
}: ChipSelectorProps<T>) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={isSelected}
            onPress={() => onToggle(opt.value)}
          />
        );
      })}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: withSpring(selected ? Colors.deepGreen : Colors.paleGoldMedium, { damping: 16 }),
    borderColor: withSpring(selected ? Colors.deepGreen : Colors.gold, { damping: 16 }),
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.chip, animStyle]}>
        <DinText style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
          {label}
        </DinText>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  chipLabel: {
    fontFamily: FontFamily.soraMedium,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  chipLabelSelected: {
    color: Colors.paleGoldLight,
  },
});
