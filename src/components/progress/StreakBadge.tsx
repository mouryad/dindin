import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius } from '@constants/theme';

interface StreakBadgeProps {
  streak: number;
  longestStreak: number;
  label?: string;
}

export function StreakBadge({ streak, longestStreak, label = 'day streak' }: StreakBadgeProps) {
  const flameScale = useSharedValue(1);
  const flameSkew  = useSharedValue(0);
  const glowOp     = useSharedValue(0.4);
  const numScale   = useSharedValue(0);

  const isActive = streak > 0;

  useEffect(() => {
    // Mount: pop the number in
    numScale.value = withSpring(1, { damping: 10, stiffness: 160 });

    if (!isActive) return;

    // Flame breathe
    flameScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.94, { duration: 700, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    // Subtle lean
    flameSkew.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    // Glow pulse
    glowOp.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.25, { duration: 800 }),
      ),
      -1,
      true,
    );

    return () => {
      cancelAnimation(flameScale);
      cancelAnimation(flameSkew);
      cancelAnimation(glowOp);
    };
  }, [isActive]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: flameScale.value },
      { rotate: `${flameSkew.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOp.value,
  }));

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ scale: numScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Glow halo */}
      {isActive && (
        <Animated.View style={[styles.glow, glowStyle]} />
      )}

      <View style={styles.inner}>
        {/* Flame */}
        <Animated.View style={flameStyle}>
          <DinText style={[styles.flameIcon, !isActive && styles.flameDim]}>
            {streak >= 30 ? '🔥🔥' : streak >= 7 ? '🔥' : '✨'}
          </DinText>
        </Animated.View>

        {/* Number */}
        <Animated.View style={numStyle}>
          <DinText style={[styles.streakNum, !isActive && styles.streakNumDim]}>
            {streak}
          </DinText>
        </Animated.View>

        <DinText style={styles.streakLabel}>{label}</DinText>
      </View>

      {/* Longest streak footnote */}
      {longestStreak > 0 && (
        <DinText style={styles.best}>
          Best: {longestStreak} days
        </DinText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.gold,
    top: -10,
    alignSelf: 'center',
  },
  inner: {
    alignItems: 'center',
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.xl,
    paddingVertical: 20,
    paddingHorizontal: 28,
    gap: 4,
    minWidth: 130,
    zIndex: 2,
  },
  flameIcon: {
    fontSize: 36,
  },
  flameDim: {
    opacity: 0.35,
  },
  streakNum: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 48,
    color: Colors.deepGreen,
    lineHeight: 54,
  },
  streakNumDim: {
    color: Colors.textMuted,
  },
  streakLabel: {
    fontFamily: FontFamily.sora,
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  best: {
    fontFamily: FontFamily.sora,
    fontSize: 11,
    color: Colors.textMuted,
    zIndex: 2,
  },
});
