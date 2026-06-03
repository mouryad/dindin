import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { format, startOfMonth, getDay, getDaysInMonth, isToday, parseISO } from 'date-fns';
import { useCalendar } from '@hooks/useCalendar';
import { CalendarDayCell } from '@components/calendar/CalendarDayCell';
import { DayDetailModal } from '@components/calendar/DayDetailModal';
import { DinText } from '@components/ui/DinText';
import { Colors, Spacing, FontFamily, BorderRadius } from '@constants/theme';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function CalendarScreen() {
  const {
    currentMonth,
    calendarData,
    loading,
    selectedDay,
    expandedDayData,
    expandedLoading,
    selectDay,
    closeDay,
    goToPrevMonth,
    goToNextMonth,
  } = useCalendar();

  const monthLabel = format(currentMonth, 'MMMM yyyy');

  // Build the grid: empty prefix cells + day cells
  const firstDayOfWeek = getDay(startOfMonth(currentMonth)); // 0=Sun
  const daysInMonth = getDaysInMonth(currentMonth);
  const year = currentMonth.getFullYear();
  const month = String(currentMonth.getMonth() + 1).padStart(2, '0');

  const prefixCells = Array.from({ length: firstDayOfWeek });
  const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
    const dayStr = String(i + 1).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  });

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <DinText variant="heading" style={styles.heroTitle}>
            Our Story
          </DinText>
          <DinText variant="body" color={Colors.textSecondary} style={styles.heroSubtitle}>
            Every meal, every day. Together.
          </DinText>
        </View>

        {/* Month navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn}>
            <DinText style={styles.navArrow}>‹</DinText>
          </TouchableOpacity>
          <DinText variant="subheading" style={styles.monthLabel}>{monthLabel}</DinText>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn}>
            <DinText style={styles.navArrow}>›</DinText>
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d) => (
            <View key={d} style={styles.weekdayCell}>
              <DinText style={styles.weekdayLabel}>{d}</DinText>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.deepGreen} size="large" />
          </View>
        ) : (
          <View style={styles.grid}>
            {/* Empty prefix cells */}
            {prefixCells.map((_, i) => (
              <View key={`empty-${i}`} style={styles.gridCell} />
            ))}

            {/* Day cells */}
            {dayCells.map((dateStr) => {
              const day = calendarData[dateStr];
              if (!day) {
                // Day without summary yet
                const dayNum = dateStr.split('-')[2];
                return (
                  <View key={dateStr} style={styles.gridCell}>
                    <View style={styles.emptyDayCell}>
                      <DinText style={styles.emptyDayNum}>{dayNum}</DinText>
                    </View>
                  </View>
                );
              }
              return (
                <View key={dateStr} style={styles.gridCell}>
                  <CalendarDayCell
                    day={day}
                    isSelected={selectedDay === dateStr}
                    isToday={isToday(parseISO(dateStr))}
                    onPress={selectDay}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* Legend */}
        <View style={styles.legend}>
          <LegendItem color={Colors.gold} label="Active streak day" />
          <LegendItem color={Colors.deepGreen} label="Selected day" isOutline />
          <LegendItem color={Colors.paleGoldMedium} label="Meal logged" />
        </View>
      </ScrollView>

      {/* Day detail bottom sheet */}
      <DayDetailModal
        dateStr={selectedDay}
        data={expandedDayData}
        loading={expandedLoading}
        onClose={closeDay}
      />
    </SafeAreaView>
  );
}

function LegendItem({
  color, label, isOutline,
}: {
  color: string; label: string; isOutline?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          isOutline
            ? { borderWidth: 2, borderColor: color, backgroundColor: 'transparent' }
            : { backgroundColor: color },
        ]}
      />
      <DinText variant="caption" color={Colors.textSecondary}>{label}</DinText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: 36,
    lineHeight: 44,
  },
  heroSubtitle: {
    marginTop: 4,
  },

  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: {
    fontSize: 24,
    color: Colors.deepGreen,
    lineHeight: 28,
  },
  monthLabel: {
    fontFamily: FontFamily.frauncesMedium,
    fontSize: 20,
  },

  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: 6,
  },
  gridCell: {
    width: '13.28%',   // 7 columns with gap
    alignItems: 'center',
  },
  emptyDayCell: {
    width: 48,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDayNum: {
    fontFamily: FontFamily.sora,
    fontSize: 13,
    color: Colors.textMuted,
    opacity: 0.4,
  },

  loadingWrap: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.paleGoldMedium,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
