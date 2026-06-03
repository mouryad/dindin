import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily } from '@constants/theme';

interface LiquidMacroBarProps {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
  color: string;
  delay?: number;
}

const BAR_HEIGHT = 110;

export function LiquidMacroBar({
  label, consumed, target, unit = 'g', color, delay = 0,
}: LiquidMacroBarProps) {
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;
  const fillH = useSharedValue(0);
  // Wave oscillation: x-translation of the oval that sits atop the fill
  const waveX = useSharedValue(0);
  const waveScale = useSharedValue(1);
  const isGoalMet = pct >= 1;

  useEffect(() => {
    // Rise to target height with a spring (bouncy when goal is met)
    fillH.value = withDelay(
      delay,
      isGoalMet
        ? withSpring(pct * BAR_HEIGHT, { damping: 6, stiffness: 80, mass: 1.2 })
        : withSpring(pct * BAR_HEIGHT, { damping: 18, stiffness: 120 }),
    );

    // Continuous wave: alternate x-translation
    waveX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(10, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
          withTiming(-10, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );

    // Gentle scale pulse on the wave oval
    waveScale.value = withDelay(
      delay + 400,
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.96, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );

    return () => {
      cancelAnimation(waveX);
      cancelAnimation(waveScale);
    };
  }, [pct, isGoalMet, delay]);

  const fillStyle = useAnimatedStyle(() => ({
    height: fillH.value,
  }));

  const waveStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: waveX.value },
      { scaleX: waveScale.value },
    ],
  }));

  const displayPct = Math.round(pct * 100);

  return (
    <View style={styles.wrapper}>
      {/* Tube container */}
      <View style={[styles.tube, isGoalMet && { borderColor: color }]}>
        {/* Liquid fill rising from bottom */}
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]}>
          {/* Wave oval — sits at the very top of the fill, wider than tube, slides side to side */}
          <Animated.View style={[styles.waveOval, { backgroundColor: color }, waveStyle]} />
        </Animated.View>

        {/* Goal-met sparkle */}
        {isGoalMet && (
          <View style={styles.goalBadge}>
            <DinText style={styles.goalBadgeText}>✓</DinText>
          </View>
        )}
      </View>

      {/* Labels */}
      <DinText style={[styles.pctLabel, { color }]}>{displayPct}%</DinText>
      <DinText style={styles.valueLabel}>
        {Math.round(consumed)}<DinText style={styles.unitLabel}>{unit}</DinText>
      </DinText>
      <DinText style={styles.macroLabel}>{label}</DinText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  tube: {
    width: 56,
    height: BAR_HEIGHT,
    borderRadius: 28,
    backgroundColor: Colors.paleGoldMedium,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'flex-end',   // fill rises from bottom
  },
  fill: {
    width: '100%',
    borderRadius: 28,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  // Wide flat oval that creates the "liquid surface" illusion
  waveOval: {
    position: 'absolute',
    top: -10,
    left: -14,
    right: -14,
    height: 22,
    borderRadius: 11,
    opacity: 0.55,
  },
  goalBadge: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    zIndex: 4,
  },
  goalBadgeText: {
    fontSize: 18,
    color: Colors.paleGoldLight,
  },
  pctLabel: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 16,
    lineHeight: 20,
  },
  valueLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 13,
    color: Colors.deepGreen,
  },
  unitLabel: {
    fontFamily: FontFamily.sora,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  macroLabel: {
    fontFamily: FontFamily.sora,
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
