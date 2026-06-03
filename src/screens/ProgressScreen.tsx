import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useProgress } from '@hooks/useProgress';
import { CalorieRing } from '@components/progress/CalorieRing';
import { LiquidMacroBar } from '@components/progress/LiquidMacroBar';
import { StreakBadge } from '@components/progress/StreakBadge';
import { WeightChart } from '@components/progress/WeightChart';
import { WeightLogSheet } from '@components/progress/WeightLogSheet';
import { MilestoneGrid } from '@components/progress/MilestoneCard';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';

const MACRO_COLORS = {
  protein: '#4A7C59',
  carbs:   Colors.gold,
  fat:     '#C4874F',
} as const;

export function ProgressScreen() {
  const {
    profile,
    macroProgress,
    weightTrend,
    milestones,
    achievedCount,
    totalMilestones,
    logWeight,
    weightSaving,
    refresh,
  } = useProgress();

  const [weightSheetOpen, setWeightSheetOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const targets = macroProgress?.targets ?? {
    calories: profile?.daily_calorie_target ?? 2000,
    protein_g: profile?.daily_protein_g ?? 150,
    carbs_g: profile?.daily_carbs_g ?? 200,
    fat_g: profile?.daily_fat_g ?? 67,
  };

  const consumed = macroProgress?.consumed ?? {
    calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.deepGreen}
          />
        }
      >
        {/* Page title */}
        <View style={styles.pageHeader}>
          <DinText variant="heading" style={styles.pageTitle}>Your progress</DinText>
          <DinText variant="body" color={Colors.textSecondary}>
            {profile?.display_name ? `${profile.display_name}'s dashboard` : 'Personal dashboard'}
          </DinText>
        </View>

        {/* ── Calorie ring ─────────────────────────────────── */}
        <SectionCard>
          <SectionLabel>Today's calories</SectionLabel>
          <CalorieRing
            consumed={consumed.calories}
            target={targets.calories}
            delay={100}
          />
          <View style={{ height: 36 }} />  {/* space for the "remaining" label */}
        </SectionCard>

        {/* ── Liquid macro bars ─────────────────────────────── */}
        <SectionCard>
          <SectionLabel>Macros</SectionLabel>
          <View style={styles.macroRow}>
            <LiquidMacroBar
              label="Protein"
              consumed={consumed.protein_g}
              target={targets.protein_g}
              color={MACRO_COLORS.protein}
              delay={0}
            />
            <LiquidMacroBar
              label="Carbs"
              consumed={consumed.carbs_g}
              target={targets.carbs_g}
              color={MACRO_COLORS.carbs}
              delay={120}
            />
            <LiquidMacroBar
              label="Fat"
              consumed={consumed.fat_g}
              target={targets.fat_g}
              color={MACRO_COLORS.fat}
              delay={240}
            />
          </View>

          {/* Target row */}
          <View style={styles.targetRow}>
            <TargetPill label="P" value={`${targets.protein_g}g`} color={MACRO_COLORS.protein} />
            <TargetPill label="C" value={`${targets.carbs_g}g`}   color={MACRO_COLORS.carbs} />
            <TargetPill label="F" value={`${targets.fat_g}g`}     color={MACRO_COLORS.fat} />
          </View>
        </SectionCard>

        {/* ── Streak ────────────────────────────────────────── */}
        <SectionCard>
          <SectionLabel>Cooking streak</SectionLabel>
          <View style={styles.streakWrap}>
            <StreakBadge
              streak={profile?.cooking_streak ?? 0}
              longestStreak={profile?.longest_streak ?? 0}
            />
          </View>
          <DinText variant="caption" color={Colors.textMuted} style={styles.streakHint}>
            {profile?.cooking_streak === 0
              ? 'Log a meal today to start your streak!'
              : 'Log a meal every day to keep it going.'}
          </DinText>
        </SectionCard>

        {/* ── Weight trend ──────────────────────────────────── */}
        <SectionCard>
          <View style={styles.sectionHeaderRow}>
            <SectionLabel>Weight</SectionLabel>
            <TouchableOpacity
              onPress={() => setWeightSheetOpen(true)}
              style={styles.logWeightBtn}
            >
              <DinText style={styles.logWeightBtnLabel}>+ Log weight</DinText>
            </TouchableOpacity>
          </View>

          <WeightChart
            trend={weightTrend}
            targetKg={profile?.target_weight_kg ?? null}
            goal={profile?.weight_goal ?? 'maintain'}
          />

          {/* Goal summary */}
          {profile?.target_weight_kg && (
            <View style={styles.goalSummary}>
              <DinText variant="caption" color={Colors.textSecondary}>
                Goal: {profile.target_weight_kg} kg
                ({profile.weight_goal === 'lose' ? 'weight loss' :
                  profile.weight_goal === 'gain' ? 'muscle gain' : 'maintenance'})
              </DinText>
              {weightTrend.progressPct !== null && (
                <LinearProgressBar
                  pct={weightTrend.progressPct / 100}
                  color={Colors.deepGreen}
                />
              )}
            </View>
          )}
        </SectionCard>

        {/* ── Milestones ────────────────────────────────────── */}
        <SectionCard>
          <View style={styles.sectionHeaderRow}>
            <SectionLabel>Milestones</SectionLabel>
            <DinText variant="caption" color={Colors.textSecondary}>
              {achievedCount} / {totalMilestones}
            </DinText>
          </View>
          <MilestoneGrid milestones={milestones} />
        </SectionCard>

        {/* ── Wearable placeholder ──────────────────────────── */}
        <SectionCard style={styles.wearableCard}>
          <DinText style={styles.wearableIcon}>⌚</DinText>
          <View style={{ flex: 1, gap: 4 }}>
            <DinText variant="body" style={{ fontFamily: FontFamily.soraSemibold }}>
              Connect a wearable
            </DinText>
            <DinText variant="caption" color={Colors.textSecondary}>
              Apple Watch, Oura Ring, or Whoop — coming soon. Activity data will automatically
              adjust your daily calorie budget in real time.
            </DinText>
          </View>
        </SectionCard>

      </ScrollView>

      {/* Weight log bottom sheet */}
      <WeightLogSheet
        visible={weightSheetOpen}
        lastWeightKg={weightTrend.latestKg ?? profile?.current_weight_kg ?? null}
        saving={weightSaving}
        onSave={logWeight}
        onClose={() => setWeightSheetOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Small reusable sub-components ───────────────────────────

function SectionCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <DinText variant="label" style={styles.sectionLabel}>{children as string}</DinText>;
}

function TargetPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.targetPill, { borderColor: color }]}>
      <DinText style={[styles.targetPillLabel, { color }]}>{label}</DinText>
      <DinText variant="caption" color={Colors.textSecondary}>{value}</DinText>
    </View>
  );
}

function LinearProgressBar({ pct, color }: { pct: number; color: string }) {
  const width = useSharedValue(0);
  React.useEffect(() => { width.value = withSpring(pct, { damping: 18 }); }, [pct]);
  const barStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` as unknown as number }));

  return (
    <View style={styles.linearTrack}>
      <Animated.View style={[styles.linearFill, { backgroundColor: color }, barStyle]} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 120, gap: Spacing.md },

  pageHeader: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: 4,
  },
  pageTitle: { fontSize: 30, lineHeight: 38 },

  card: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionLabel: { marginBottom: 4 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  macroRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },

  targetRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  targetPillLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 12,
  },

  streakWrap: { alignItems: 'center', paddingVertical: Spacing.sm },
  streakHint: { textAlign: 'center' },

  logWeightBtn: {
    backgroundColor: Colors.deepGreen,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  logWeightBtnLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 13,
    color: Colors.paleGoldLight,
  },

  goalSummary: { gap: 8, marginTop: 4 },
  linearTrack: {
    height: 6,
    backgroundColor: Colors.paleGoldLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  linearFill: {
    height: '100%',
    borderRadius: 3,
  },

  wearableCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: Colors.gold,
    backgroundColor: 'transparent',
    opacity: 0.85,
  },
  wearableIcon: { fontSize: 28 },
});
