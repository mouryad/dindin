// Circular calorie progress ring built from two half-circle masks.
// No SVG dependency — pure View/Reanimated.
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily } from '@constants/theme';

const SIZE      = 180;
const THICKNESS = 14;
const INNER     = SIZE - THICKNESS * 2;

interface CalorieRingProps {
  consumed: number;
  target: number;
  caloriesBurned?: number;   // from wearable
  delay?: number;
}

export function CalorieRing({ consumed, target, caloriesBurned = 0, delay = 0 }: CalorieRingProps) {
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(pct, { damping: 14, stiffness: 80, mass: 1.5 }));
  }, [pct, delay]);

  // Left half rotates 0 → 180 deg covering the left semicircle (pct 0–0.5)
  const leftStyle = useAnimatedStyle(() => {
    const deg = interpolate(progress.value, [0, 0.5], [0, 180], Extrapolation.CLAMP);
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  // Right half rotates 0 → 180 deg, but only starts once left is full (pct 0.5–1)
  const rightStyle = useAnimatedStyle(() => {
    const deg = interpolate(progress.value, [0.5, 1], [0, 180], Extrapolation.CLAMP);
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const deficit = Math.max(0, consumed - target + caloriesBurned);
  const remaining = Math.max(0, target - consumed + caloriesBurned);
  const isOverBudget = consumed > target && caloriesBurned === 0;

  const arcColor = isOverBudget ? '#C0392B' : Colors.deepGreen;

  return (
    <View style={styles.wrap}>
      {/* Ring base — gray track */}
      <View style={[styles.ring, styles.track]} />

      {/* Right semicircle (fills first, pct 0–0.5) */}
      <View style={[styles.halfClip, styles.rightClip]}>
        <Animated.View
          style={[
            styles.half,
            styles.rightHalf,
            { borderColor: arcColor },
            rightStyle,
          ]}
        />
      </View>

      {/* Left semicircle (fills second, pct 0.5–1) */}
      <View style={[styles.halfClip, styles.leftClip]}>
        <Animated.View
          style={[
            styles.half,
            styles.leftHalf,
            { borderColor: arcColor },
            leftStyle,
          ]}
        />
      </View>

      {/* Inner white/pale circle to create the "ring" effect */}
      <View style={styles.innerCircle}>
        {/* Center text */}
        <DinText style={styles.calorieNum}>{Math.round(consumed)}</DinText>
        <DinText style={styles.calorieUnit}>kcal</DinText>
        <DinText style={styles.targetLabel}>of {target}</DinText>
        {caloriesBurned > 0 && (
          <DinText style={styles.burnedLabel}>+{Math.round(caloriesBurned)} burned</DinText>
        )}
      </View>

      {/* Remaining / over budget label */}
      <View style={styles.statusLabel}>
        {isOverBudget ? (
          <DinText style={[styles.statusText, { color: '#C0392B' }]}>
            {Math.round(consumed - target)} over
          </DinText>
        ) : (
          <DinText style={styles.statusText}>
            {Math.round(remaining)} remaining
          </DinText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
  },
  track: {
    borderWidth: THICKNESS,
    borderColor: Colors.paleGoldMedium,
  },
  // Clip the half-circles so they don't bleed outside their side
  halfClip: {
    position: 'absolute',
    width: SIZE / 2,
    height: SIZE,
    overflow: 'hidden',
  },
  leftClip: { left: 0 },
  rightClip: { right: 0 },
  half: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: THICKNESS,
    borderColor: Colors.deepGreen,
  },
  // The left half starts rotated 180° (hidden) and animates to 0° (visible)
  leftHalf: {
    right: 0,
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    transform: [{ rotate: '180deg' }],
  },
  rightHalf: {
    left: 0,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '0deg' }],
  },
  innerCircle: {
    position: 'absolute',
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    backgroundColor: Colors.paleGoldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieNum: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 36,
    color: Colors.deepGreen,
    lineHeight: 42,
  },
  calorieUnit: {
    fontFamily: FontFamily.sora,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  targetLabel: {
    fontFamily: FontFamily.sora,
    fontSize: 10,
    color: Colors.textMuted,
  },
  burnedLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 10,
    color: '#4A7C59',
    marginTop: 2,
  },
  statusLabel: {
    position: 'absolute',
    bottom: -28,
    alignSelf: 'center',
  },
  statusText: {
    fontFamily: FontFamily.sora,
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
