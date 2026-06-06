import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue,
  withSpring, withRepeat, withSequence, withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { useProgress } from '@hooks/useProgress';
import { useHealthData, ACTIVITY_TYPES } from '@hooks/useHealthData';
import { CalorieRing } from '@components/progress/CalorieRing';
import { WeightChart } from '@components/progress/WeightChart';
import { WeightLogSheet } from '@components/progress/WeightLogSheet';
import { WorkoutLogSheet } from '@components/progress/WorkoutLogSheet';
import { MilestoneGrid } from '@components/progress/MilestoneCard';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';

const ACTIVITY_ICON: Record<string, string> = Object.fromEntries(
  ACTIVITY_TYPES.map((a) => [a.id, a.icon]),
);

export function ProgressScreen() {
  const {
    profile, macroProgress, weightTrend, milestones,
    achievedCount, totalMilestones, logWeight, weightSaving, refresh,
  } = useProgress();

  const { caloriesBurned, workouts, logWorkout, saving: workoutSaving, refresh: refreshHealth } = useHealthData();

  const [weightSheetOpen,  setWeightSheetOpen]  = useState(false);
  const [workoutSheetOpen, setWorkoutSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refresh(), refreshHealth()]);
    setRefreshing(false);
  }

  const consumed = macroProgress?.consumed ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const targets  = macroProgress?.targets  ?? {
    calories: profile?.daily_calorie_target ?? 2000,
    protein_g: profile?.daily_protein_g ?? 150,
    carbs_g:   profile?.daily_carbs_g   ?? 200,
    fat_g:     profile?.daily_fat_g     ?? 67,
  };

  const streak = profile?.cooking_streak ?? 0;
  const today  = format(new Date(), 'EEEE, MMMM d');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.deepGreen} />
        }
      >
        {/* ── HEADER ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <DinText variant="heading" style={styles.name}>
              {profile?.display_name ?? 'Progress'}
            </DinText>
            <DinText variant="caption" color={Colors.textSecondary}>{today}</DinText>
          </View>
          {/* Streak pill */}
          <StreakPill streak={streak} />
        </View>

        {/* ── TODAY HERO (calorie ring) ───────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).springify().damping(18)}>
        <View style={styles.heroCard}>
          <CalorieRing
            consumed={consumed.calories}
            target={targets.calories}
            caloriesBurned={caloriesBurned}
            delay={100}
          />
        </View>

        </Animated.View>

        {/* ── QUICK-ACTION ROW ───────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120).springify().damping(18)}>
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickTile} onPress={() => setWeightSheetOpen(true)} activeOpacity={0.8}>
            <DinText style={styles.quickTileEmoji}>⚖️</DinText>
            <DinText style={styles.quickTileMetric}>
              {weightTrend.latestKg != null ? `${weightTrend.latestKg.toFixed(1)} kg` : '–'}
            </DinText>
            <DinText style={styles.quickTileSub}>Weight</DinText>
            <View style={styles.quickTileBtn}>
              <DinText style={styles.quickTileBtnLabel}>+ Log</DinText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickTile} onPress={() => setWorkoutSheetOpen(true)} activeOpacity={0.8}>
            <DinText style={styles.quickTileEmoji}>
              {workouts.length > 0 ? (ACTIVITY_ICON[workouts[workouts.length - 1].type] ?? '⚡') : '⚡'}
            </DinText>
            <DinText style={styles.quickTileMetric}>
              {caloriesBurned > 0 ? `${caloriesBurned} kcal` : '–'}
            </DinText>
            <DinText style={styles.quickTileSub}>Activity</DinText>
            <View style={styles.quickTileBtn}>
              <DinText style={styles.quickTileBtnLabel}>+ Log</DinText>
            </View>
          </TouchableOpacity>
        </View>

        </Animated.View>

        {/* ── MACROS ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(180).springify().damping(18)}>
        <View style={styles.card}>
          <SectionLabel>Macros</SectionLabel>
          <MacroBar label="Protein" emoji="🥩" consumed={consumed.protein_g} target={targets.protein_g} color="#4A7C59" />
          <MacroBar label="Carbs"   emoji="🍞" consumed={consumed.carbs_g}   target={targets.carbs_g}   color={Colors.gold} />
          <MacroBar label="Fat"     emoji="🫙" consumed={consumed.fat_g}     target={targets.fat_g}     color="#C4874F" />
        </View>

        </Animated.View>

        {/* ── WEIGHT TREND ───────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(240).springify().damping(18)}>
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <SectionLabel>Weight</SectionLabel>
            <TouchableOpacity onPress={() => setWeightSheetOpen(true)} style={styles.addBtn}>
              <DinText style={styles.addBtnLabel}>+ Log</DinText>
            </TouchableOpacity>
          </View>
          <WeightChart
            trend={weightTrend}
            targetKg={profile?.target_weight_kg ?? null}
            goal={profile?.weight_goal ?? 'maintain'}
          />
          {profile?.target_weight_kg != null && (
            <DinText variant="caption" color={Colors.textSecondary}>
              {`Goal: ${profile.target_weight_kg} kg (${
                profile.weight_goal === 'lose' ? 'weight loss' :
                profile.weight_goal === 'gain' ? 'muscle gain' : 'maintenance'
              })`}
            </DinText>
          )}
        </View>

        </Animated.View>

        {/* ── MILESTONES ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).springify().damping(18)}>
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <SectionLabel>Milestones</SectionLabel>
            <DinText variant="caption" color={Colors.textSecondary}>
              {`${achievedCount} / ${totalMilestones}`}
            </DinText>
          </View>
          <MilestoneGrid milestones={milestones} />
        </View>
        </Animated.View>

      </ScrollView>

      <WeightLogSheet
        visible={weightSheetOpen}
        lastWeightKg={weightTrend.latestKg ?? profile?.current_weight_kg ?? null}
        saving={weightSaving}
        onSave={logWeight}
        onClose={() => setWeightSheetOpen(false)}
      />
      <WorkoutLogSheet
        visible={workoutSheetOpen}
        weightKg={profile?.current_weight_kg ?? 70}
        saving={workoutSaving}
        onSave={logWorkout}
        onClose={() => setWorkoutSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <DinText variant="label" style={styles.sectionLabel}>{children}</DinText>;
}

function StreakPill({ streak }: { streak: number }) {
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Gentle auto-pulse when active
  useEffect(() => {
    if (streak <= 0) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.0,  { duration: 1200 }),
        withTiming(1.04, { duration: 900 }),
        withTiming(1.0,  { duration: 900 }),
        withTiming(1.0,  { duration: 2800 }),
      ),
      -1, false,
    );
  }, [streak]);

  function pulse() {
    scale.value = withSpring(1.15, { damping: 6 }, () => { scale.value = withSpring(1); });
  }

  return (
    <TouchableOpacity onPress={pulse} activeOpacity={0.9}>
      <Animated.View style={[styles.streakPill, anim]}>
        <DinText style={styles.streakFlame}>{streak >= 7 ? '🔥' : '✨'}</DinText>
        <DinText style={styles.streakNum}>{streak}</DinText>
        <DinText style={styles.streakLabel}>day{streak !== 1 ? 's' : ''}</DinText>
      </Animated.View>
    </TouchableOpacity>
  );
}


function MacroBar({ label, emoji, consumed, target, color }: {
  label: string; emoji: string; consumed: number; target: number; color: string;
}) {
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;
  const width = useSharedValue(0);
  React.useEffect(() => { width.value = withSpring(pct, { damping: 18 }); }, [pct]);
  const barStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` as unknown as number }));

  return (
    <View style={styles.macroBarRow}>
      <DinText style={styles.macroBarEmoji}>{emoji}</DinText>
      <DinText style={styles.macroBarLabel}>{label}</DinText>
      <View style={styles.macroTrack}>
        <Animated.View style={[styles.macroFill, { backgroundColor: color }, barStyle]} />
      </View>
      <DinText style={[styles.macroBarValue, { color }]}>
        {`${Math.round(consumed)}g`}
      </DinText>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.paleGoldLight },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 120, gap: Spacing.md },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  name: { fontSize: 26, lineHeight: 32 },

  // Streak pill
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.deepGreen,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  streakFlame: { fontSize: 16 },
  streakNum: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 20,
    color: Colors.paleGoldLight,
    lineHeight: 24,
  },
  streakLabel: {
    fontFamily: FontFamily.sora,
    fontSize: 11,
    color: Colors.paleGoldMedium,
  },

  // Hero ring card
  heroCard: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },

  // Quick-action 2-column row
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickTile: {
    flex: 1,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    gap: 4,
    minHeight: 100,
    shadowColor: Colors.deepGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  quickTileEmoji: { fontSize: 32 },
  quickTileMetric: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 24,
    color: Colors.deepGreen,
    lineHeight: 28,
  },
  quickTileSub: {
    fontFamily: FontFamily.sora,
    fontSize: 11,
    color: Colors.textMuted,
  },
  quickTileBtn: {
    marginTop: 8,
    backgroundColor: Colors.deepGreen,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  quickTileBtnLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 12,
    color: Colors.paleGoldLight,
  },

  // Generic card
  card: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    shadowColor: Colors.deepGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: { marginBottom: 2 },
  addBtn: {
    backgroundColor: Colors.deepGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  addBtnLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 12,
    color: Colors.paleGoldLight,
  },

  // Compact macro bars
  macroBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroBarEmoji: { fontSize: 16, width: 24, textAlign: 'center' },
  macroBarLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 12,
    color: Colors.textSecondary,
    width: 48,
  },
  macroTrack: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.paleGoldLight,
    borderRadius: 5,
    overflow: 'hidden',
  },
  macroFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroBarValue: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 12,
    width: 40,
    textAlign: 'right',
  },
});
