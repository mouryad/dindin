import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors } from '@constants/theme';

interface ProgressDotsProps {
  total: number;
  current: number;
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <Dot key={i} active={i === current} past={i < current} />
      ))}
    </View>
  );
}

function Dot({ active, past }: { active: boolean; past: boolean }) {
  const style = useAnimatedStyle(() => ({
    width: withSpring(active ? 24 : 8, { damping: 15 }),
    opacity: withSpring(past ? 0.4 : active ? 1 : 0.25, { damping: 15 }),
  }));

  return (
    <Animated.View style={[styles.dot, style]} />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.deepGreen,
  },
});
