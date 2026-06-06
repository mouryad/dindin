import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Alert,
} from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue,
  withSpring, withRepeat, withSequence, withTiming,
  FadeInDown, FadeIn,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { useAuth } from '@context/AuthContext';
import { useCouple } from '@hooks/useCouple';
import { useTodayMeals } from '@hooks/useMealLog';
import { CameraScreen } from '@screens/CameraScreen';
import { MealConfirmScreen } from '@screens/MealConfirmScreen';
import { FridgeConfirmScreen } from '@screens/FridgeConfirmScreen';
import { MealPlanSection } from '@components/home/MealPlanSection';
import { ManualMealSheet } from '@components/home/ManualMealSheet';
import { SettingsScreen } from '@screens/SettingsScreen';
import { useMealPlan } from '@hooks/useMealPlan';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { AiMealAnalysis, MealSource } from '@db/database';
import type { FridgeScanResult } from '@services/aiVision';

type CameraFlow = 'closed' | 'camera' | 'meal_confirm' | 'fridge_confirm';

interface CapturePayload {
  uri: string;
  mealAnalysis?: AiMealAnalysis;
  fridgeResult?: FridgeScanResult;
}

export function HomeScreen() {
  const { profile, user } = useAuth();
  const { couple } = useCouple();
  const { meals, macroProgress, refresh } = useTodayMeals();
  const { plan: mealPlan, loading: planLoading, error: planError, cuisine, selectCuisine, inventory: mealInventory, refresh: refreshPlan, replaceMealInPlan } = useMealPlan();

  const [cameraFlow, setCameraFlow]       = useState<CameraFlow>('closed');
  const [manualSheetOpen, setManualSheetOpen] = useState(false);
  const [capturePayload, setCapturePayload] = useState<CapturePayload | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Outside-food nudge shown after logging restaurant/delivery meal
  const [nudge, setNudge] = useState<{ calories: number; source: MealSource } | null>(null);
  // Contextual "eating out?" prompt during meal times
  const [showEatingOutPrompt, setShowEatingOutPrompt] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);

  useEffect(() => {
    if (promptDismissed) return;
    const hour = new Date().getHours();
    const isMealTime = (hour >= 12 && hour <= 14) || (hour >= 18 && hour <= 21);
    setShowEatingOutPrompt(isMealTime);
  }, [promptDismissed]);

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  // Gentle idle pulse on FAB
  const fabPulse = useSharedValue(1);
  const fabPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabPulse.value }] }));
  useEffect(() => {
    fabPulse.value = withRepeat(
      withSequence(
        withTiming(1.0,  { duration: 1000 }),
        withTiming(1.03, { duration: 1000 }),
        withTiming(1.0,  { duration: 1000 }),
        withTiming(1.0,  { duration: 2400 }), // long pause
      ),
      -1, false,
    );
  }, []);

  function openCamera() {
    fabScale.value = withSpring(0.95, { damping: 20 }, () => { fabScale.value = withSpring(1, { damping: 20 }); });
    setCameraFlow('camera');
  }

  function handleMealCaptured(uri: string, analysis: AiMealAnalysis) {
    setCapturePayload({ uri, mealAnalysis: analysis });
    setCameraFlow('meal_confirm');
  }

  function handleFridgeCaptured(uri: string, result: FridgeScanResult) {
    setCapturePayload({ uri, fridgeResult: result });
    setCameraFlow('fridge_confirm');
  }

  function handleFridgeSaved(addedCount: number) {
    setCameraFlow('closed');
    setCapturePayload(null);
    Alert.alert('Fridge updated', `${addedCount} item${addedCount !== 1 ? 's' : ''} added to your inventory.`);
  }

  function handleMealSaved(source: MealSource, calories: number) {
    setCameraFlow('closed');
    setCapturePayload(null);
    refresh();
    if (source === 'restaurant' || source === 'delivery') {
      setNudge({ calories, source });
    }
  }

  const greeting = getGreeting(profile?.display_name);
  const today = format(new Date(), 'EEEE, MMMM d');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <DinText variant="heading" style={styles.greeting}>{greeting}</DinText>
            <DinText variant="caption" color={Colors.textSecondary}>{today}</DinText>
          </View>
          <TouchableOpacity
            onPress={() => setSettingsOpen(true)}
            style={styles.avatarPlaceholder}
            activeOpacity={0.8}
          >
            {user?.user_metadata?.avatar_url ? (
              <Image
                source={{ uri: user.user_metadata.avatar_url as string }}
                style={styles.avatarImage}
              />
            ) : (
              <DinText style={styles.avatarInitial}>
                {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
              </DinText>
            )}
          </TouchableOpacity>
        </View>

        {/* Meal plan — entrance */}
        <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
        <MealPlanSection
          plan={mealPlan}
          loading={planLoading}
          error={planError}
          cuisine={cuisine}
          inventory={mealInventory}
          onCuisineChange={selectCuisine}
          onRefresh={refreshPlan}
          onUpdateMeal={replaceMealInPlan}
        />
        </Animated.View>

        {/* Outside-food nudge */}
        {nudge && (
          <View style={styles.nudgeCard}>
            <View style={styles.nudgeTop}>
              <DinText style={styles.nudgeEmoji}>
                {nudge.source === 'delivery' ? '🛵' : '🍴'}
              </DinText>
              <View style={{ flex: 1 }}>
                <DinText style={styles.nudgeTitle}>Logged! Here's how it fits</DinText>
                <DinText variant="caption" color={Colors.textSecondary}>
                  {`${Math.round(nudge.calories)} kcal from ${nudge.source === 'delivery' ? 'delivery' : 'eating out'}`}
                </DinText>
              </View>
              <TouchableOpacity onPress={() => setNudge(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <DinText style={styles.nudgeDismiss}>✕</DinText>
              </TouchableOpacity>
            </View>
            <DinText variant="caption" color={Colors.textSecondary} style={styles.nudgeTip}>
              💡 Balance it out — try a lighter, home-cooked meal next time. Your meal plan has ideas ready above.
            </DinText>
          </View>
        )}

        {/* Eating-out contextual prompt */}
        {showEatingOutPrompt && !nudge && (
          <TouchableOpacity
            style={styles.eatingOutCard}
            onPress={openCamera}
            activeOpacity={0.85}
          >
            <DinText style={styles.eatingOutEmoji}>🍕</DinText>
            <View style={{ flex: 1 }}>
              <DinText style={styles.eatingOutTitle}>Ordering in or eating out?</DinText>
              <DinText variant="caption" color={Colors.textSecondary}>
                Snap a photo to track calories
              </DinText>
            </View>
            <TouchableOpacity
              onPress={() => { setShowEatingOutPrompt(false); setPromptDismissed(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.eatingOutDismiss}
            >
              <DinText style={styles.nudgeDismiss}>✕</DinText>
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        {/* Calorie ring card */}
        {macroProgress && (
          <View style={styles.card}>
            <DinText variant="subheading" style={styles.cardTitle}>Today's nutrition</DinText>
            <View style={styles.calorieRow}>
              <View style={styles.calorieMain}>
                <DinText style={styles.calorieValue}>
                  {Math.round(macroProgress.consumed.calories)}
                </DinText>
                <DinText variant="caption" color={Colors.textSecondary}>
                  / {macroProgress.targets.calories} kcal
                </DinText>
              </View>
              <MacroBar
                label="Protein"
                pct={macroProgress.percentages.protein}
                color="#4A7C59"
                value={`${Math.round(macroProgress.consumed.protein_g)}g`}
              />
              <MacroBar
                label="Carbs"
                pct={macroProgress.percentages.carbs}
                color={Colors.gold}
                value={`${Math.round(macroProgress.consumed.carbs_g)}g`}
              />
              <MacroBar
                label="Fat"
                pct={macroProgress.percentages.fat}
                color="#C4874F"
                value={`${Math.round(macroProgress.consumed.fat_g)}g`}
              />
            </View>
          </View>
        )}

        {/* Today's meals */}
        {meals.length > 0 && (
          <View style={styles.section}>
            <DinText variant="label">Logged today</DinText>
            {meals.map((meal, i) => (
              <Animated.View key={meal.id} entering={FadeInDown.delay(i * 60).springify()}>
              <View style={styles.mealRow}>
                <DinText style={styles.mealDot}>•</DinText>
                <View style={{ flex: 1 }}>
                  <DinText variant="body">{meal.dish_name ?? meal.meal_type ?? 'Meal'}</DinText>
                  <DinText variant="caption" color={Colors.textMuted}>
                    {Math.round(meal.calories ?? 0)} kcal · {meal.meal_type}
                  </DinText>
                </View>
              </View>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Manual log shortcut */}
        <TouchableOpacity
          onPress={() => setManualSheetOpen(true)}
          style={styles.manualLogBtn}
          activeOpacity={0.8}
        >
          <DinText style={styles.manualLogIcon}>✏️</DinText>
          <DinText style={styles.manualLogLabel}>Log a meal manually</DinText>
          <DinText style={styles.manualLogArrow}>›</DinText>
        </TouchableOpacity>

        {meals.length === 0 && !macroProgress && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.emptyCard}>
            <DinText style={styles.emptyEmoji}>🍽</DinText>
            <DinText variant="subheading" style={{ textAlign: 'center' }}>
              Nothing logged yet today
            </DinText>
            <DinText variant="body" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
              Snap a photo of your meal to track calories
            </DinText>
            <TouchableOpacity onPress={openCamera} style={styles.emptyCtaBtn} activeOpacity={0.85}>
              <DinText style={styles.emptyCtaLabel}>📷  Log a meal</DinText>
            </TouchableOpacity>
          </Animated.View>
        )}

      </ScrollView>

      {/* FAB */}
      <Animated.View style={[styles.fabWrap, fabStyle, fabPulseStyle]}>
        <TouchableOpacity onPress={openCamera} style={styles.fab} activeOpacity={0.85}>
          <DinText style={styles.fabIcon}>📷</DinText>
        </TouchableOpacity>
      </Animated.View>

      {/* Camera modal — meal + fridge, no waste */}
      <Modal visible={cameraFlow === 'camera'} animationType="slide" statusBarTranslucent>
        <CameraScreen
          initialMode="meal"
          showModeSwitcher
          onMealCaptured={handleMealCaptured}
          onFridgeCaptured={handleFridgeCaptured}
          onClose={() => setCameraFlow('closed')}
        />
      </Modal>

      {/* Fridge confirm modal */}
      <Modal visible={cameraFlow === 'fridge_confirm'} animationType="slide">
        {capturePayload?.fridgeResult && (
          <FridgeConfirmScreen
            imageUri={capturePayload.uri}
            result={capturePayload.fridgeResult}
            coupleId={couple?.id ?? null}
            onSaved={handleFridgeSaved}
            onCancel={() => setCameraFlow('camera')}
          />
        )}
      </Modal>

      {/* Meal confirm modal */}
      <Modal visible={cameraFlow === 'meal_confirm'} animationType="slide">
        {capturePayload?.mealAnalysis && (
          <MealConfirmScreen
            imageUri={capturePayload.uri}
            analysis={capturePayload.mealAnalysis}
            onSaved={handleMealSaved}
            onCancel={() => setCameraFlow('camera')}
          />
        )}
      </Modal>

      {/* Manual meal sheet */}
      <ManualMealSheet
        visible={manualSheetOpen}
        onSaved={() => { setManualSheetOpen(false); refresh(); }}
        onClose={() => setManualSheetOpen(false)}
      />

      {/* Settings modal */}
      <Modal visible={settingsOpen} animationType="slide">
        <SettingsScreen onClose={() => setSettingsOpen(false)} />
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function MacroBar({ label, pct, color, value }: { label: string; pct: number; color: string; value: string }) {
  return (
    <View style={styles.macroBarWrap}>
      <DinText variant="caption" color={Colors.textSecondary}>{label}</DinText>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <DinText variant="caption" color={Colors.textMuted}>{value}</DinText>
    </View>
  );
}

function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  const prefix = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${prefix}, ${name}` : prefix;
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 120, gap: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.lg,
  },
  greeting: { fontSize: 30, lineHeight: 38 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.deepGreen,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.deepGreen,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 6, elevation: 4,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarInitial: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 20,
    color: Colors.paleGoldLight,
  },
  card: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowColor: Colors.deepGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 1,
  },
  cardTitle: { fontSize: 18 },
  calorieRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  calorieMain: { alignItems: 'center', marginRight: Spacing.sm },
  calorieValue: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 40,
    color: Colors.deepGreen,
    lineHeight: 46,
  },
  macroBarWrap: { flex: 1, gap: 4, minWidth: 60 },
  barBg: {
    height: 6,
    backgroundColor: Colors.paleGoldLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  section: { gap: Spacing.sm },
  mealRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: Colors.deepGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  mealDot: { fontSize: 18, color: Colors.gold, lineHeight: 22 },
  emptyCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyEmoji: { fontSize: 56 },
  emptyCtaBtn: {
    backgroundColor: Colors.deepGreen, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl, paddingVertical: 13, marginTop: Spacing.sm,
  },
  emptyCtaLabel: {
    fontFamily: FontFamily.soraSemibold, fontSize: 15, color: Colors.paleGoldLight,
  },
  wasteQuickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  wasteQuickActionIcon: { fontSize: 22 },
  wasteQuickActionTitle: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 14,
    color: Colors.deepGreen,
  },
  wasteArrow: { fontSize: 22, color: Colors.textMuted },
  manualLogBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: Colors.deepGreen,
    shadowColor: Colors.deepGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  manualLogIcon: { fontSize: 16 },
  manualLogLabel: { flex: 1, fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.deepGreen },
  manualLogArrow: { fontSize: 20, color: Colors.textMuted },

  // Outside-food nudge
  nudgeCard: {
    backgroundColor: '#FFF8EE',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#E8963A',
  },
  nudgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  nudgeEmoji: { fontSize: 26 },
  nudgeTitle: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 14,
    color: Colors.deepGreen,
  },
  nudgeDismiss: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  nudgeTip: {
    lineHeight: 18,
  },

  // Eating-out prompt
  eatingOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: Colors.gold,
  },
  eatingOutEmoji: { fontSize: 26 },
  eatingOutTitle: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 14,
    color: Colors.deepGreen,
  },
  eatingOutDismiss: {
    padding: 4,
  },
  fabWrap: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
  },
  fab: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.deepGreen,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.deepGreen,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42, shadowRadius: 16, elevation: 10,
  },
  fabIcon: { fontSize: 28 },
});
