import React, { useEffect } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import { DinText } from '@components/ui/DinText';
import { Colors, Spacing, FontFamily, BorderRadius } from '@constants/theme';
import type { MealLog, WeightLog } from '@db/database';
import { useAuth } from '@context/AuthContext';

interface DayDetailModalProps {
  dateStr: string | null;
  data: { mealLogs: MealLog[]; userWeightLogs: WeightLog[]; partnerWeightLogs: WeightLog[] } | null;
  loading: boolean;
  onClose: () => void;
}

export function DayDetailModal({ dateStr, data, loading, onClose }: DayDetailModalProps) {
  const { profile } = useAuth();
  const translateY = useSharedValue(300);
  const backdropOpacity = useSharedValue(0);

  const isOpen = !!dateStr;

  useEffect(() => {
    if (isOpen) {
      backdropOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) });
      translateY.value = withSpring(0, { damping: 22, stiffness: 200 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 250 });
      translateY.value = withSpring(300, { damping: 20 });
    }
  }, [isOpen]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: backdropOpacity.value > 0 ? 'auto' : 'none',
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!dateStr) return null;

  const displayDate = format(parseISO(dateStr), 'EEEE, MMMM d');
  const totalCals = data?.mealLogs.reduce((s, m) => s + (m.calories ?? 0), 0) ?? 0;

  // Determine weight logging status
  const userLogged   = (data?.userWeightLogs.length ?? 0) > 0;
  const partnerLogged = (data?.partnerWeightLogs.length ?? 0) > 0;
  let weightStatus = 'Neither logged weight today';
  if (userLogged && partnerLogged) weightStatus = 'Both of you logged weight ✓';
  else if (userLogged) weightStatus = `Only ${profile?.display_name ?? 'you'} logged weight`;
  else if (partnerLogged) weightStatus = 'Only your partner logged weight';

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View>
            <DinText variant="subheading">{displayDate}</DinText>
            {totalCals > 0 && (
              <DinText variant="caption" color={Colors.textSecondary}>
                {Math.round(totalCals)} kcal eaten
              </DinText>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <DinText style={styles.closeX}>×</DinText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.deepGreen} size="large" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Meal photo grid */}
            {data && data.mealLogs.length > 0 && (
              <View style={styles.section}>
                <DinText variant="label" style={styles.sectionLabel}>Meals</DinText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.photoRow}>
                    {data.mealLogs.map((meal) => (
                      <MealCard key={meal.id} meal={meal} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Weight tracking */}
            <View style={styles.section}>
              <DinText variant="label" style={styles.sectionLabel}>Weight tracking</DinText>
              <View style={styles.weightCard}>
                <DinText
                  variant="body"
                  color={
                    userLogged && partnerLogged
                      ? Colors.success
                      : Colors.textSecondary
                  }
                >
                  {weightStatus}
                </DinText>
                {data?.userWeightLogs.map((wl) => (
                  <WeightEntry key={wl.id} log={wl} label={profile?.display_name ?? 'You'} />
                ))}
                {data?.partnerWeightLogs.map((wl) => (
                  <WeightEntry key={wl.id} log={wl} label="Partner" />
                ))}
              </View>
            </View>

            {/* Macro summary */}
            {data && data.mealLogs.length > 0 && (
              <MacroSummary mealLogs={data.mealLogs} />
            )}
          </ScrollView>
        )}
      </Animated.View>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function MealCard({ meal }: { meal: MealLog }) {
  return (
    <View style={styles.mealCard}>
      {meal.photo_url ? (
        <Image source={{ uri: meal.photo_url }} style={styles.mealPhoto} />
      ) : (
        <View style={[styles.mealPhoto, styles.mealPhotoPlaceholder]}>
          <DinText style={{ fontSize: 28 }}>🍽</DinText>
        </View>
      )}
      <View style={styles.mealCardBody}>
        <DinText variant="body" numberOfLines={1} style={{ fontFamily: FontFamily.soraSemibold }}>
          {meal.dish_name ?? meal.meal_type ?? 'Meal'}
        </DinText>
        {meal.calories != null && (
          <DinText variant="caption">{Math.round(meal.calories)} kcal</DinText>
        )}
        <DinText variant="caption" color={Colors.textMuted}>
          {meal.meal_source?.replace('_', ' ')}
        </DinText>
      </View>
    </View>
  );
}

function WeightEntry({ log, label }: { log: WeightLog; label: string }) {
  return (
    <View style={styles.weightEntry}>
      <DinText variant="caption" color={Colors.textSecondary}>{label}</DinText>
      <DinText style={styles.weightValue}>{log.weight_kg} kg</DinText>
    </View>
  );
}

function MacroSummary({ mealLogs }: { mealLogs: MealLog[] }) {
  const totals = mealLogs.reduce(
    (acc, m) => ({
      protein: acc.protein + (m.protein_g ?? 0),
      carbs: acc.carbs + (m.carbs_g ?? 0),
      fat: acc.fat + (m.fat_g ?? 0),
    }),
    { protein: 0, carbs: 0, fat: 0 },
  );

  return (
    <View style={styles.section}>
      <DinText variant="label" style={styles.sectionLabel}>Macros</DinText>
      <View style={styles.macroRow}>
        <MacroChip label="Protein" value={totals.protein} color="#4A7C59" />
        <MacroChip label="Carbs" value={totals.carbs} color={Colors.gold} />
        <MacroChip label="Fat" value={totals.fat} color="#C4874F" />
      </View>
    </View>
  );
}

function MacroChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.macroChip, { borderColor: color }]}>
      <DinText style={[styles.macroValue, { color }]}>{Math.round(value)}g</DinText>
      <DinText variant="caption" color={Colors.textSecondary}>{label}</DinText>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(45,58,31,0.35)',
    zIndex: 10,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.paleGoldLight,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: 360,
    maxHeight: '80%',
    zIndex: 11,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.paleGoldMedium,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: {
    fontSize: 22,
    color: Colors.deepGreen,
    lineHeight: 26,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  section: { gap: Spacing.sm },
  sectionLabel: { marginBottom: 2 },
  photoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  mealCard: {
    width: 140,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  mealPhoto: {
    width: 140,
    height: 100,
  },
  mealPhotoPlaceholder: {
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealCardBody: {
    padding: Spacing.sm,
    gap: 2,
  },
  weightCard: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  weightEntry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.paleGoldLight,
  },
  weightValue: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 20,
    color: Colors.deepGreen,
  },
  macroRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  macroChip: {
    flex: 1,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    gap: 4,
  },
  macroValue: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 20,
  },
});
