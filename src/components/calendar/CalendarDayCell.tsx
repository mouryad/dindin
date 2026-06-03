import React, { useEffect } from 'react';
import { TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius } from '@constants/theme';
import type { CalendarDay } from '@db/database';

const CELL_SIZE = 48;

interface CalendarDayCellProps {
  day: CalendarDay;
  isSelected: boolean;
  isToday: boolean;
  onPress: (date: string) => void;
}

export function CalendarDayCell({ day, isSelected, isToday, onPress }: CalendarDayCellProps) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  useEffect(() => {
    if (isSelected) {
      glowOpacity.value = withTiming(1, { duration: 250 });
    } else {
      glowOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isSelected]);

  function handlePress() {
    if (!day.hasData) return;
    scale.value = withSequence(
      withSpring(0.88, { damping: 10, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
    onPress(day.date);
  }

  const dayNumber = day.date.split('-')[2];

  if (!day.hasData) {
    return (
      <View style={styles.emptyCell}>
        <DinText style={styles.emptyDayNumber}>{dayNumber}</DinText>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} style={styles.cellWrap}>
      <Animated.View style={[styles.cell, animStyle]}>
        {/* Glow ring when selected */}
        <Animated.View style={[styles.glowRing, glowStyle]} />

        {/* Thumbnail photo */}
        {day.thumbnailUrl ? (
          <Image source={{ uri: day.thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <DinText style={styles.plateEmoji}>🍽</DinText>
          </View>
        )}

        {/* Streak dot */}
        {day.streakActive && <View style={styles.streakDot} />}

        {/* Day number overlay */}
        <View style={[styles.dateOverlay, isToday && styles.dateOverlayToday]}>
          <DinText
            style={[
              styles.dayNumber,
              isToday && styles.dayNumberToday,
              isSelected && styles.dayNumberSelected,
            ]}
          >
            {dayNumber}
          </DinText>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cellWrap: {
    width: CELL_SIZE,
    alignItems: 'center',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE + 8,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  emptyCell: {
    width: CELL_SIZE,
    height: CELL_SIZE + 8,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDayNumber: {
    fontFamily: FontFamily.sora,
    fontSize: 13,
    color: Colors.textMuted,
    opacity: 0.5,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.md,
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  plateEmoji: {
    fontSize: 22,
  },
  glowRing: {
    position: 'absolute',
    inset: -3,
    borderRadius: BorderRadius.md + 3,
    borderWidth: 2.5,
    borderColor: Colors.deepGreen,
    zIndex: 10,
  },
  streakDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.gold,
    zIndex: 5,
  },
  dateOverlay: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    backgroundColor: 'rgba(244,241,232,0.85)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  dateOverlayToday: {
    backgroundColor: Colors.deepGreen,
  },
  dayNumber: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 11,
    color: Colors.deepGreen,
  },
  dayNumberToday: {
    color: Colors.paleGoldLight,
  },
  dayNumberSelected: {
    color: Colors.deepGreen,
  },
});
