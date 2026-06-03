import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius } from '@constants/theme';
import type { Milestone } from '@hooks/useProgress';

interface MilestoneCardProps {
  milestone: Milestone;
  index: number;
}

export function MilestoneCard({ milestone, index }: MilestoneCardProps) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const prevAchieved = useRef(milestone.achieved);

  useEffect(() => {
    // Entrance animation (staggered)
    opacity.value = withDelay(index * 70, withTiming(1, { duration: 320 }));
    scale.value = withDelay(
      index * 70,
      withSpring(1, { damping: 14, stiffness: 160 }),
    );
  }, []);

  useEffect(() => {
    // Pop when achievement is newly unlocked
    if (milestone.achieved && !prevAchieved.current) {
      scale.value = withSequence(
        withSpring(1.15, { damping: 6, stiffness: 300 }),
        withSpring(1, { damping: 12 }),
      );
      glowScale.value = withSequence(
        withSpring(1.6, { damping: 6 }),
        withSpring(1, { damping: 14 }),
      );
    }
    prevAchieved.current = milestone.achieved;
  }, [milestone.achieved]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: milestone.achieved ? 0.18 : 0,
  }));

  return (
    <Animated.View style={[styles.card, milestone.achieved && styles.cardAchieved, cardStyle]}>
      {/* Gold glow blob behind achieved cards */}
      <Animated.View style={[styles.glow, glowStyle]} />

      <View style={[styles.iconWrap, milestone.achieved && styles.iconWrapAchieved]}>
        <DinText style={[styles.icon, !milestone.achieved && styles.iconLocked]}>
          {milestone.achieved ? milestone.icon : '🔒'}
        </DinText>
      </View>

      <View style={styles.body}>
        <DinText style={[styles.title, !milestone.achieved && styles.titleLocked]}>
          {milestone.title}
        </DinText>
        <DinText variant="caption" color={Colors.textSecondary}>
          {milestone.description}
        </DinText>
      </View>

      {milestone.achieved && (
        <View style={styles.checkBadge}>
          <DinText style={styles.checkText}>✓</DinText>
        </View>
      )}
    </Animated.View>
  );
}

export function MilestoneGrid({ milestones }: { milestones: Milestone[] }) {
  const achieved = milestones.filter((m) => m.achieved);
  const locked   = milestones.filter((m) => !m.achieved);

  return (
    <View style={styles.grid}>
      {/* Show achieved first */}
      {[...achieved, ...locked].map((m, i) => (
        <MilestoneCard key={m.id} milestone={m} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardAchieved: {
    borderColor: Colors.gold,
    backgroundColor: Colors.paleGoldLight,
  },
  glow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.gold,
    left: 0,
    top: -20,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapAchieved: {
    backgroundColor: 'rgba(184,166,120,0.2)',
  },
  icon: { fontSize: 22 },
  iconLocked: { opacity: 0.35 },
  body: { flex: 1, gap: 2 },
  title: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 14,
    color: Colors.deepGreen,
  },
  titleLocked: {
    color: Colors.textMuted,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 13,
    color: Colors.paleGoldLight,
    lineHeight: 16,
  },
});
