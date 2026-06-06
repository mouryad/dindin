import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { format, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { MealType, MealSource } from '@db/database';

const MEAL_TYPES: Array<{ value: MealType; label: string; icon: string }> = [
  { value: 'breakfast', label: 'Breakfast', icon: '☀️' },
  { value: 'lunch',     label: 'Lunch',     icon: '🌤' },
  { value: 'dinner',    label: 'Dinner',    icon: '🌙' },
  { value: 'snack',     label: 'Snack',     icon: '🍎' },
];

const SOURCES: Array<{ value: MealSource; label: string }> = [
  { value: 'home_cooked', label: '🏠 Home' },
  { value: 'restaurant',  label: '🍴 Restaurant' },
  { value: 'delivery',    label: '🛵 Delivery' },
  { value: 'other',       label: '📦 Other' },
];

const DATE_OPTIONS = [
  { label: 'Today',      value: 0 },
  { label: 'Yesterday',  value: -1 },
  { label: '2 days ago', value: -2 },
];

interface Props {
  visible: boolean;
  onSaved: () => void;
  onClose: () => void;
}

export function ManualMealSheet({ visible, onSaved, onClose }: Props) {
  const { user } = useAuth();

  const [dishName,  setDishName]  = useState('');
  const [calories,  setCalories]  = useState('');
  const [protein,   setProtein]   = useState('');
  const [carbs,     setCarbs]     = useState('');
  const [fat,       setFat]       = useState('');
  const [mealType,  setMealType]  = useState<MealType>('lunch');
  const [source,    setSource]    = useState<MealSource>('home_cooked');
  const [daysAgo,   setDaysAgo]   = useState(0);
  const [saving,    setSaving]    = useState(false);

  const translateY = useSharedValue(600);
  const backdropOp = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      backdropOp.value = withTiming(1, { duration: 260 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
    } else {
      backdropOp.value = withTiming(0, { duration: 200 });
      translateY.value = withSpring(600, { damping: 20 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOp.value }));
  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  async function handleSave() {
    if (!user || !dishName.trim()) return;
    if (!calories.trim()) {
      Alert.alert('Calories required', 'Enter at least an estimated calorie count.');
      return;
    }
    setSaving(true);
    try {
      const loggedAt = subDays(new Date(), daysAgo).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('meal_logs').insert({
        user_id:      user.id,
        logged_at:    loggedAt,
        meal_type:    mealType,
        meal_source:  source,
        dish_name:    dishName.trim(),
        calories:     parseFloat(calories) || null,
        protein_g:    parseFloat(protein) || null,
        carbs_g:      parseFloat(carbs)   || null,
        fat_g:        parseFloat(fat)     || null,
        is_shared:    true,
        is_verified:  false,
        notes:        'Logged manually',
      });
      if (error) throw error;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Reset form
      setDishName(''); setCalories(''); setProtein(''); setCarbs(''); setFat('');
      setMealType('lunch'); setSource('home_cooked'); setDaysAgo(0);
      onSaved();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : undefined}
        style={styles.avoidWrap}
      >
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />
          <DinText variant="subheading" style={styles.title}>Log a meal</DinText>
          <DinText variant="caption" color={Colors.textSecondary} style={styles.subtitle}>
            Forgot to take a photo? Add it manually.
          </DinText>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Dish name */}
            <Label>Dish name</Label>
            <TextInput
              value={dishName}
              onChangeText={setDishName}
              placeholder="e.g. Dal Tadka, Idli Sambar, Salad"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              autoFocus={visible}
            />

            {/* When */}
            <Label>When</Label>
            <View style={styles.chipRow}>
              {DATE_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  onPress={() => setDaysAgo(d.value)}
                  style={[styles.chip, daysAgo === d.value && styles.chipActive]}
                >
                  <DinText style={[styles.chipLabel, daysAgo === d.value && styles.chipLabelActive]}>
                    {d.label}
                  </DinText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Meal type */}
            <Label>Meal type</Label>
            <View style={styles.chipRow}>
              {MEAL_TYPES.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setMealType(m.value)}
                  style={[styles.chip, mealType === m.value && styles.chipActive]}
                >
                  <DinText style={styles.chipIcon}>{m.icon}</DinText>
                  <DinText style={[styles.chipLabel, mealType === m.value && styles.chipLabelActive]}>
                    {m.label}
                  </DinText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Source */}
            <Label>Where</Label>
            <View style={styles.chipRow}>
              {SOURCES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  onPress={() => setSource(s.value)}
                  style={[styles.chip, source === s.value && styles.chipActive]}
                >
                  <DinText style={[styles.chipLabel, source === s.value && styles.chipLabelActive]}>
                    {s.label}
                  </DinText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Calories */}
            <Label>Calories (kcal) *</Label>
            <TextInput
              value={calories}
              onChangeText={setCalories}
              placeholder="e.g. 450"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />

            {/* Optional macros */}
            <Label>Macros (optional)</Label>
            <View style={styles.macroRow}>
              <MacroInput label="Protein g" value={protein} onChange={setProtein} />
              <MacroInput label="Carbs g"   value={carbs}   onChange={setCarbs} />
              <MacroInput label="Fat g"     value={fat}     onChange={setFat} />
            </View>

            <DinButton
              label="Save meal"
              onPress={handleSave}
              loading={saving}
              disabled={!dishName.trim() || !calories.trim() || saving}
              style={{ marginTop: Spacing.md, marginBottom: Spacing.xl }}
            />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}

function Label({ children }: { children: string }) {
  return <DinText variant="label" style={{ marginTop: Spacing.md, marginBottom: 6 }}>{children}</DinText>;
}

function MacroInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <DinText variant="caption" color={Colors.textMuted} style={{ marginBottom: 4 }}>{label}</DinText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={Colors.textMuted}
        keyboardType="numeric"
        style={styles.macroInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(45,58,31,0.4)', zIndex: 20 },
  avoidWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 21 },
  sheet: {
    backgroundColor: Colors.paleGoldLight, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg, paddingBottom: 52, maxHeight: '92%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.paleGoldMedium,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 13,
    fontFamily: FontFamily.sora, fontSize: 15, color: Colors.textPrimary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.paleGoldMedium, borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: Colors.deepGreen, borderColor: Colors.deepGreen },
  chipIcon: { fontSize: 14 },
  chipLabel: { fontFamily: FontFamily.sora, fontSize: 12, color: Colors.textSecondary },
  chipLabelActive: { fontFamily: FontFamily.soraSemibold, color: Colors.paleGoldLight },
  macroRow: { flexDirection: 'row', gap: 8 },
  macroInput: {
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 10,
    fontFamily: FontFamily.sora, fontSize: 14, color: Colors.textPrimary, textAlign: 'center',
  },
});
