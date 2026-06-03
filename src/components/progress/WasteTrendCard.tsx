import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { WasteWeekSummary } from '@hooks/useWasteLog';

interface WasteTrendCardProps {
  thisWeek: WasteWeekSummary;
  lastWeek: WasteWeekSummary;
}

export function WasteTrendCard({ thisWeek, lastWeek }: WasteTrendCardProps) {
  const scale = useSharedValue(0.94);
  const opacity = useSharedValue(0);

  // Pulse glow
  const glow = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14 });
    opacity.value = withTiming(1, { duration: 350 });
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.6, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const weightKg = thisWeek.totalWeightG >= 1000
    ? `${(thisWeek.totalWeightG / 1000).toFixed(2)} kg`
    : `${Math.round(thisWeek.totalWeightG)} g`;

  const trendPct = lastWeek.totalWeightG > 0
    ? Math.round(((thisWeek.totalWeightG - lastWeek.totalWeightG) / lastWeek.totalWeightG) * 100)
    : null;

  const isImproving = trendPct !== null && trendPct < 0;
  const isSame = trendPct === null || trendPct === 0;

  return (
    <Animated.View style={[styles.card, containerStyle]}>
      {/* Background glow blob */}
      <Animated.View style={[styles.glowBlob, glowStyle]} />

      <View style={styles.top}>
        <DinText style={styles.icon}>🗑️</DinText>
        <View style={{ flex: 1 }}>
          <DinText variant="label">This week's food waste</DinText>
          <DinText variant="caption" color={Colors.textSecondary}>
            {thisWeek.logs.length} log{thisWeek.logs.length !== 1 ? 's' : ''} recorded
          </DinText>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <DinText style={styles.statValue}>{weightKg}</DinText>
          <DinText variant="caption" color={Colors.textSecondary}>weight</DinText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <DinText style={styles.statValue}>
            {Math.round(thisWeek.totalCalories).toLocaleString()} kcal
          </DinText>
          <DinText variant="caption" color={Colors.textSecondary}>wasted</DinText>
        </View>
      </View>

      {/* Trend vs last week */}
      {trendPct !== null && (
        <View style={[styles.trendPill, isImproving ? styles.trendGood : styles.trendBad]}>
          <DinText style={[styles.trendText, isImproving ? styles.trendTextGood : styles.trendTextBad]}>
            {isImproving ? '↓' : '↑'} {Math.abs(trendPct)}% vs last week
          </DinText>
        </View>
      )}
      {isSame && lastWeek.totalWeightG === 0 && (
        <View style={styles.trendPill}>
          <DinText style={styles.trendTextNeutral}>First week tracking — keep going!</DinText>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  glowBlob: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C4874F',
    opacity: 0.6,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  icon: { fontSize: 26 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: { flex: 1, gap: 2 },
  statValue: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 22,
    color: Colors.deepGreen,
    lineHeight: 28,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.paleGoldLight,
    marginHorizontal: Spacing.md,
  },
  trendPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.paleGoldLight,
  },
  trendGood: { backgroundColor: '#E8F5EE' },
  trendBad:  { backgroundColor: '#FDECEA' },
  trendText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 12,
  },
  trendTextGood:    { color: '#27AE60' },
  trendTextBad:     { color: '#C0392B' },
  trendTextNeutral: {
    fontFamily: FontFamily.sora,
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
