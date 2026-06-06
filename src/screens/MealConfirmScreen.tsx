import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { AiMealAnalysis, MealSource, MealType } from '@db/database';

// ─── Constants ────────────────────────────────────────────────

const SOURCES: Array<{ value: MealSource; label: string; icon: string }> = [
  { value: 'home_cooked', label: 'Home',       icon: '🏠' },
  { value: 'restaurant',  label: 'Restaurant', icon: '🍴' },
  { value: 'delivery',    label: 'Delivery',   icon: '🛵' },
  { value: 'other',       label: 'Other',      icon: '📦' },
];

const MEAL_TYPES: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch',     label: 'Lunch'     },
  { value: 'dinner',    label: 'Dinner'    },
  { value: 'snack',     label: 'Snack'     },
];

// Visual plate scale — emoji grows with portion
const PORTIONS = [
  { mult: 0.5,  emoji: '🥄', label: '½',  desc: 'Half'    },
  { mult: 0.75, emoji: '🥣', label: '¾',  desc: 'Small'   },
  { mult: 1.0,  emoji: '🍽️', label: '1×', desc: 'Regular' },
  { mult: 1.5,  emoji: '🥘', label: '1½', desc: 'Large'   },
  { mult: 2.0,  emoji: '🫕', label: '2×', desc: 'Double'  },
];

// Witty AI confidence messages
function wittyLine(dish: string, conf: number): string {
  if (conf >= 0.88) return `I'd bet my last byte on it — that's ${dish} 🎯`;
  if (conf >= 0.72) return `Fairly sure that's ${dish} — looking delicious 🍽️`;
  if (conf >= 0.55) return `Pretty confident it's ${dish}... give or take 🧐`;
  if (conf >= 0.35) return `My guess: ${dish} — but you know your food better 🤷`;
  return `Hard to tell — please fill in the details below ✏️`;
}

// ─── Screen ───────────────────────────────────────────────────

interface Props {
  imageUri: string;
  analysis: AiMealAnalysis;
  onSaved: (source: MealSource, calories: number) => void;
  onCancel: () => void;
}

export function MealConfirmScreen({ imageUri, analysis, onSaved, onCancel }: Props) {
  const { user } = useAuth();

  const [dishName, setDishName] = useState(analysis.dish_name   ?? '');
  const [calories, setCalories] = useState(String(Math.round(analysis.calories   ?? 0)));
  const [proteinG, setProteinG] = useState(String(Math.round(analysis.protein_g  ?? 0)));
  const [carbsG,   setCarbsG]   = useState(String(Math.round(analysis.carbs_g    ?? 0)));
  const [fatG,     setFatG]     = useState(String(Math.round(analysis.fat_g      ?? 0)));
  const [fiberG,   setFiberG]   = useState(String(Math.round(analysis.fiber_g    ?? 0)));
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [source,   setSource]   = useState<MealSource>('home_cooked');
  const [portion,  setPortion]  = useState(1.0);
  const [saving,   setSaving]   = useState(false);

  const checkScale = useSharedValue(0);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));

  const isAiData = (analysis.calories ?? 0) > 0;
  const conf     = analysis.confidence ?? 0;
  const adj      = (val: string) => Math.round((parseFloat(val) || 0) * portion);

  // ── Duplicate meal check ──────────────────────────────────
  async function confirmAndSave() {
    if (!user) return;
    if (!dishName.trim()) { Alert.alert('What did you eat?', 'Add a dish name.'); return; }
    if (!calories || parseFloat(calories) === 0) {
      Alert.alert('Add calories', 'Enter an estimate to track your goal.'); return;
    }
    const today = format(new Date(), 'yyyy-MM-dd');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('meal_logs').select('dish_name')
      .eq('user_id', user.id).eq('meal_type', mealType)
      .gte('logged_at', `${today}T00:00:00`).lte('logged_at', `${today}T23:59:59`)
      .limit(1) as { data: Array<{ dish_name: string | null }> | null };

    if (existing?.length) {
      Alert.alert(
        'Already logged today',
        `You've already logged ${existing[0].dish_name || mealType} for ${mealType}. What's happening?`,
        [
          { text: 'Another serving', onPress: () => promptServings() },
          { text: 'Different meal',  onPress: () => save(1)          },
          { text: 'Cancel', style: 'cancel'                          },
        ],
      );
    } else {
      save(1);
    }
  }

  function promptServings() {
    Alert.alert('How many servings?', 'Macros will be multiplied.', [
      { text: '1 serving',    onPress: () => save(1)   },
      { text: '1.5 servings', onPress: () => save(1.5) },
      { text: '2 servings',   onPress: () => save(2)   },
      { text: '3 servings',   onPress: () => save(3)   },
    ]);
  }

  async function save(servMult = 1) {
    if (!user) return;
    setSaving(true);
    const m   = portion * servMult;
    const cal = (parseFloat(calories) || 0) * m;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('meal_logs').insert({
        user_id:         user.id,
        logged_at:       new Date().toISOString(),
        meal_type:       mealType,
        meal_source:     source,
        dish_name:       dishName.trim(),
        photo_url:       imageUri,
        ai_raw_response: analysis,
        calories:        cal,
        protein_g:       (parseFloat(proteinG) || 0) * m,
        carbs_g:         (parseFloat(carbsG)   || 0) * m,
        fat_g:           (parseFloat(fatG)     || 0) * m,
        fiber_g:         (parseFloat(fiberG)   || 0) * m,
        serving_size:    analysis.serving_size ?? null,
        num_servings:    servMult * portion,
        is_shared:       true,
        is_verified:     false,
        youtube_video_id: null,
        youtube_title:    null,
      });
      if (error) throw error;
      await upsertDailySummary(user.id, {
        calories: cal,
        protein_g: (parseFloat(proteinG) || 0) * m,
        carbs_g:   (parseFloat(carbsG)   || 0) * m,
        fat_g:     (parseFloat(fatG)     || 0) * m,
        thumbnailUrl: imageUri,
      });
      checkScale.value = withSpring(1, { damping: 12, stiffness: 180 });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise((r) => setTimeout(r, 700));
      onSaved(source, cal);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <DinText style={styles.backArrow}>←</DinText>
        </TouchableOpacity>
        <DinText variant="subheading">Log Meal</DinText>
        <View style={{ width: 40 }} />
      </View>

      {/* KAV lifts content above keyboard */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Photo */}
          <View style={styles.photoWrap}>
            <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
            <Animated.View style={[styles.successOverlay, checkStyle]}>
              <DinText style={styles.checkMark}>✓</DinText>
            </Animated.View>
            {/* Witty confidence banner */}
            {isAiData && conf > 0 && (
              <View style={[styles.confBanner, { backgroundColor: confBg(conf) }]}>
                <DinText style={styles.confText}>{wittyLine(dishName || 'something tasty', conf)}</DinText>
              </View>
            )}
            {!isAiData && (
              <View style={[styles.confBanner, { backgroundColor: 'rgba(45,58,31,0.7)' }]}>
                <DinText style={styles.confText}>✏️ AI couldn't detect this — fill in below</DinText>
              </View>
            )}
          </View>

          {/* Where */}
          <Section label="Where did you eat?">
            <View style={styles.chipRow}>
              {SOURCES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => setSource(s.value)}
                  style={[styles.chip, source === s.value && styles.chipActive]}
                >
                  <DinText style={styles.chipIcon}>{s.icon}</DinText>
                  <DinText style={[styles.chipLabel, source === s.value && styles.chipLabelActive]}>
                    {s.label}
                  </DinText>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Portion — visual plate scale */}
          <Section label="Portion size" sub={analysis.serving_size ? `AI: ${analysis.serving_size}` : undefined}>
            <View style={styles.portionRow}>
              {PORTIONS.map((p) => {
                const active = portion === p.mult;
                const emojiSize = active ? 36 : 22;
                return (
                  <TouchableOpacity
                    key={p.mult}
                    onPress={() => { setPortion(p.mult); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={[styles.portionCell, active && styles.portionCellActive]}
                    activeOpacity={0.8}
                  >
                    <DinText style={{ fontSize: emojiSize, lineHeight: emojiSize + 6 }}>{p.emoji}</DinText>
                    <DinText style={[styles.portionFrac, active && styles.portionFracActive]}>{p.label}</DinText>
                    {active && (
                      <DinText style={styles.portionDesc}>{p.desc}</DinText>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            {portion !== 1 && (
              <View style={styles.portionAdjusted}>
                <DinText style={styles.portionAdjText}>
                  {`${adj(calories)} kcal  ·  P ${adj(proteinG)}g  ·  C ${adj(carbsG)}g  ·  F ${adj(fatG)}g`}
                </DinText>
              </View>
            )}
          </Section>

          {/* Nutrition */}
          <Section label="Nutrition details">
            <View style={styles.nutritionCard}>
              {/* Dish name */}
              <View style={styles.fieldRow}>
                <DinText style={styles.fieldLabel}>Dish</DinText>
                <TextInput
                  value={dishName}
                  onChangeText={setDishName}
                  placeholder="What did you eat?"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.fieldInput}
                  returnKeyType="next"
                />
              </View>

              {/* Meal type */}
              <View style={styles.fieldRow}>
                <DinText style={styles.fieldLabel}>Meal</DinText>
                <View style={styles.mealTypeRow}>
                  {MEAL_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => setMealType(t.value)}
                      style={[styles.mealChip, mealType === t.value && styles.mealChipActive]}
                    >
                      <DinText style={[styles.mealChipLabel, mealType === t.value && styles.mealChipLabelActive]}>
                        {t.label}
                      </DinText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.divider} />

              {/* Macro grid */}
              <View style={styles.macroGrid}>
                <MacroCell label="Calories" unit="kcal" value={calories} onChange={setCalories} large adjusted={portion !== 1 ? adj(calories) : null} />
                <MacroCell label="Protein"  unit="g"    value={proteinG} onChange={setProteinG} adjusted={portion !== 1 ? adj(proteinG) : null} />
                <MacroCell label="Carbs"    unit="g"    value={carbsG}   onChange={setCarbsG}   adjusted={portion !== 1 ? adj(carbsG) : null} />
                <MacroCell label="Fat"      unit="g"    value={fatG}     onChange={setFatG}     adjusted={portion !== 1 ? adj(fatG) : null} />
                <MacroCell label="Fibre"    unit="g"    value={fiberG}   onChange={setFiberG}   adjusted={portion !== 1 ? adj(fiberG) : null} />
              </View>
            </View>
          </Section>

          {/* Bottom padding so footer doesn't cover last field */}
          <View style={{ height: 12 }} />
        </ScrollView>

        {/* Footer inside KAV so it lifts with keyboard */}
        <View style={styles.footer}>
          <DinButton label="Log this meal" onPress={confirmAndSave} loading={saving} disabled={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function Section({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <DinText variant="label">{label}</DinText>
        {sub ? <DinText variant="caption" color={Colors.textMuted}>{sub}</DinText> : null}
      </View>
      {children}
    </View>
  );
}

function MacroCell({
  label, unit, value, onChange, large, adjusted,
}: {
  label: string; unit: string; value: string;
  onChange: (v: string) => void;
  large?: boolean; adjusted: number | null;
}) {
  return (
    <View style={styles.macroCell}>
      <DinText style={styles.macroCellLabel}>{label}</DinText>
      <View style={styles.macroCellInput}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          selectTextOnFocus
          style={[styles.macroCellValue, large && styles.macroCellValueLarge]}
        />
        <DinText style={styles.macroCellUnit}>{unit}</DinText>
      </View>
      {adjusted !== null && (
        <DinText style={styles.macroCellAdj}>→ {adjusted}</DinText>
      )}
    </View>
  );
}

function confBg(c: number): string {
  if (c >= 0.72) return 'rgba(39,174,96,0.82)';
  if (c >= 0.45) return 'rgba(192,124,0,0.82)';
  return 'rgba(192,57,43,0.82)';
}

// ─── Daily summary ────────────────────────────────────────────

async function upsertDailySummary(userId: string, data: {
  calories: number; protein_g: number; carbs_g: number; fat_g: number; thumbnailUrl: string;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ex } = await (supabase as any)
    .from('daily_summaries').select('*')
    .eq('user_id', userId).eq('summary_date', today)
    .single() as { data: { total_calories_eaten: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number; meal_count: number } | null };

  if (ex) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('daily_summaries').update({
      total_calories_eaten: (ex.total_calories_eaten || 0) + data.calories,
      total_protein_g:      (ex.total_protein_g     || 0) + data.protein_g,
      total_carbs_g:        (ex.total_carbs_g       || 0) + data.carbs_g,
      total_fat_g:          (ex.total_fat_g         || 0) + data.fat_g,
      meal_count:           (ex.meal_count          || 0) + 1,
      thumbnail_url:         data.thumbnailUrl,
    }).eq('user_id', userId).eq('summary_date', today);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('daily_summaries').insert({
      user_id: userId, summary_date: today,
      total_calories_eaten: data.calories, total_protein_g: data.protein_g,
      total_carbs_g: data.carbs_g, total_fat_g: data.fat_g,
      meal_count: 1, thumbnail_url: data.thumbnailUrl,
      has_weight_log: false, has_fridge_photo: false, streak_active: false,
    });
  }
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.deepGreen },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 12, gap: Spacing.md },

  // Photo
  photoWrap: { height: 200, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  successOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(45,58,31,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { fontSize: 56, color: Colors.paleGoldLight },
  confBanner: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  confText: {
    fontFamily: FontFamily.sora, fontSize: 12, color: '#fff',
    lineHeight: 17, textAlign: 'center',
  },

  // Section
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },

  // Source chips
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1, alignItems: 'center', gap: 3, paddingVertical: 9,
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: Colors.deepGreen, borderColor: Colors.deepGreen },
  chipIcon: { fontSize: 16 },
  chipLabel: { fontFamily: FontFamily.sora, fontSize: 10, color: Colors.textSecondary },
  chipLabelActive: { fontFamily: FontFamily.soraSemibold, color: Colors.paleGoldLight },

  // Portion visual scale
  portionRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  portionCell: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3,
    paddingVertical: 10, paddingHorizontal: 4,
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: 'transparent', minHeight: 72,
  },
  portionCellActive: {
    backgroundColor: Colors.deepGreen, borderColor: Colors.deepGreen, minHeight: 86,
  },
  portionFrac: { fontFamily: FontFamily.soraSemibold, fontSize: 12, color: Colors.textSecondary },
  portionFracActive: { color: Colors.gold },
  portionDesc: { fontFamily: FontFamily.sora, fontSize: 9, color: Colors.paleGoldMedium },
  portionAdjusted: {
    backgroundColor: '#E8F5EE', borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center',
  },
  portionAdjText: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.deepGreen },

  // Nutrition card
  nutritionCard: {
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.lg,
    padding: Spacing.md, gap: 12,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fieldLabel: {
    fontFamily: FontFamily.soraSemibold, fontSize: 12,
    color: Colors.textSecondary, width: 40,
  },
  fieldInput: {
    flex: 1, fontFamily: FontFamily.sora, fontSize: 15, color: Colors.deepGreen,
    borderBottomWidth: 1.5, borderBottomColor: Colors.gold, paddingVertical: 5,
  },
  mealTypeRow: { flex: 1, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  mealChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.full,
    backgroundColor: Colors.paleGoldLight, borderWidth: 1.5, borderColor: 'transparent',
  },
  mealChipActive: { backgroundColor: Colors.deepGreen, borderColor: Colors.deepGreen },
  mealChipLabel: { fontFamily: FontFamily.sora, fontSize: 11, color: Colors.textSecondary },
  mealChipLabelActive: { fontFamily: FontFamily.soraSemibold, color: Colors.paleGoldLight },

  divider: { height: 1, backgroundColor: Colors.paleGoldLight },

  // Macro grid — 2 columns
  macroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  macroCell: {
    width: '48%', backgroundColor: Colors.paleGoldLight,
    borderRadius: BorderRadius.md, padding: 10, gap: 2,
  },
  macroCellLabel: { fontFamily: FontFamily.sora, fontSize: 11, color: Colors.textMuted },
  macroCellInput: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  macroCellValue: {
    fontFamily: FontFamily.fraunces, fontSize: 22, color: Colors.deepGreen,
    minWidth: 50,
  },
  macroCellValueLarge: { fontFamily: FontFamily.frauncesBold, fontSize: 28 },
  macroCellUnit: { fontFamily: FontFamily.sora, fontSize: 11, color: Colors.textMuted },
  macroCellAdj: {
    fontFamily: FontFamily.soraSemibold, fontSize: 11,
    color: Colors.deepGreen, opacity: 0.75,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, paddingTop: Spacing.sm,
    backgroundColor: Colors.paleGoldLight,
  },
});
