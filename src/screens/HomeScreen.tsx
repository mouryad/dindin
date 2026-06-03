import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Alert,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { format } from 'date-fns';
import { useAuth } from '@context/AuthContext';
import { useCouple } from '@hooks/useCouple';
import { useTodayMeals } from '@hooks/useMealLog';
import { useWasteLog } from '@hooks/useWasteLog';
import { CameraScreen } from '@screens/CameraScreen';
import { MealConfirmScreen } from '@screens/MealConfirmScreen';
import { FridgeConfirmScreen } from '@screens/FridgeConfirmScreen';
import { WasteConfirmScreen } from '@screens/WasteConfirmScreen';
import { WasteTrendCard } from '@components/progress/WasteTrendCard';
import { SettingsScreen } from '@screens/SettingsScreen';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { AiMealAnalysis } from '@db/database';
import type { FridgeScanResult, WasteScanResult } from '@services/aiVision';

type CameraFlow = 'closed' | 'camera' | 'meal_confirm' | 'fridge_confirm' | 'waste_confirm';

interface CapturePayload {
  uri: string;
  mealAnalysis?: AiMealAnalysis;
  fridgeResult?: FridgeScanResult;
  wasteResult?: WasteScanResult;
}

export function HomeScreen() {
  const { profile, user } = useAuth();
  const { couple } = useCouple();
  const { meals, macroProgress, refresh } = useTodayMeals();
  const { thisWeek: wasteThisWeek, lastWeek: wasteLastWeek } = useWasteLog();

  const [cameraFlow, setCameraFlow] = useState<CameraFlow>('closed');
  const [capturePayload, setCapturePayload] = useState<CapturePayload | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  function openCamera() {
    fabScale.value = withSpring(0.9, {}, () => { fabScale.value = withSpring(1); });
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

  function handleWasteCaptured(uri: string, result: WasteScanResult) {
    setCapturePayload({ uri, wasteResult: result });
    setCameraFlow('waste_confirm');
  }

  function handleWasteSaved(weightG: number, calories: number) {
    setCameraFlow('closed');
    setCapturePayload(null);
    Alert.alert(
      'Waste logged',
      `${(weightG / 1000).toFixed(2)} kg · ${calories} kcal recorded for today.`,
    );
  }

  function handleMealSaved() {
    setCameraFlow('closed');
    setCapturePayload(null);
    refresh();
  }

  function handleFridgeSaved(addedCount: number) {
    setCameraFlow('closed');
    setCapturePayload(null);
    Alert.alert('Fridge updated', `${addedCount} item${addedCount !== 1 ? 's' : ''} added to your shared inventory.`);
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
            <DinText style={styles.avatarInitial}>
              {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
            </DinText>
          </TouchableOpacity>
        </View>

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
            {meals.map((meal) => (
              <View key={meal.id} style={styles.mealRow}>
                <DinText style={styles.mealDot}>•</DinText>
                <View style={{ flex: 1 }}>
                  <DinText variant="body">{meal.dish_name ?? meal.meal_type ?? 'Meal'}</DinText>
                  <DinText variant="caption" color={Colors.textMuted}>
                    {Math.round(meal.calories ?? 0)} kcal · {meal.meal_type}
                  </DinText>
                </View>
              </View>
            ))}
          </View>
        )}

        {meals.length === 0 && !macroProgress && (
          <View style={styles.emptyCard}>
            <DinText style={styles.emptyEmoji}>🍽</DinText>
            <DinText variant="subheading" style={{ textAlign: 'center' }}>
              Nothing logged yet today
            </DinText>
            <DinText variant="body" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
              Tap the camera button below to log your first meal
            </DinText>
          </View>
        )}

        {/* Waste section */}
        {couple && (
          <View style={styles.section}>
            <DinText variant="label">Food waste</DinText>
            {wasteThisWeek.logs.length > 0 && (
              <WasteTrendCard thisWeek={wasteThisWeek} lastWeek={wasteLastWeek} />
            )}
            <TouchableOpacity
              onPress={openCamera}
              style={styles.wasteQuickAction}
              activeOpacity={0.82}
            >
              <DinText style={styles.wasteQuickActionIcon}>🗑️</DinText>
              <View style={{ flex: 1 }}>
                <DinText style={styles.wasteQuickActionTitle}>Log food waste</DinText>
                <DinText variant="caption" color={Colors.textSecondary}>
                  Photograph leftovers to track waste
                </DinText>
              </View>
              <DinText style={styles.wasteArrow}>›</DinText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Animated.View style={[styles.fabWrap, fabStyle]}>
        <TouchableOpacity onPress={openCamera} style={styles.fab} activeOpacity={0.85}>
          <DinText style={styles.fabIcon}>📷</DinText>
        </TouchableOpacity>
      </Animated.View>

      {/* Camera modal */}
      <Modal visible={cameraFlow === 'camera'} animationType="slide" statusBarTranslucent>
        <CameraScreen
          onMealCaptured={handleMealCaptured}
          onFridgeCaptured={handleFridgeCaptured}
          onWasteCaptured={handleWasteCaptured}
          onClose={() => setCameraFlow('closed')}
        />
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

      {/* Waste confirm modal */}
      <Modal visible={cameraFlow === 'waste_confirm'} animationType="slide">
        {capturePayload?.wasteResult && (
          <WasteConfirmScreen
            imageUri={capturePayload.uri}
            result={capturePayload.wasteResult}
            onSaved={handleWasteSaved}
            onCancel={() => setCameraFlow('camera')}
          />
        )}
      </Modal>

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
  greeting: { fontSize: 26, lineHeight: 34 },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  mealDot: { fontSize: 18, color: Colors.gold, lineHeight: 22 },
  emptyCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyEmoji: { fontSize: 56 },
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
  fabWrap: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
  },
  fab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.deepGreen,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: { fontSize: 28 },
});
