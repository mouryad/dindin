import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { calculateDailyTargets } from '@lib/macroCalculator';
import { OnboardingStep } from '@components/onboarding/OnboardingStep';
import { ChipSelector } from '@components/onboarding/ChipSelector';
import { NumberInput } from '@components/onboarding/NumberInput';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { ProgressDots } from '@components/ui/ProgressDots';
import { Colors, Spacing, FontFamily, BorderRadius } from '@constants/theme';
import type {
  OnboardingData,
  DietaryRestriction,
  Gender,
  ActivityLevel,
  WeightGoal,
} from '@db/database';

const TOTAL_STEPS = 5;

const DIETARY_OPTIONS: Array<{ label: string; value: DietaryRestriction }> = [
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Vegan', value: 'vegan' },
  { label: 'Pescatarian', value: 'pescatarian' },
  { label: 'Gluten-free', value: 'gluten-free' },
  { label: 'Dairy-free', value: 'dairy-free' },
  { label: 'Nut-free', value: 'nut-free' },
  { label: 'Halal', value: 'halal' },
  { label: 'Kosher', value: 'kosher' },
  { label: 'Low-carb', value: 'low-carb' },
  { label: 'Keto', value: 'keto' },
];

const ACTIVITY_OPTIONS: Array<{ label: string; value: ActivityLevel; desc: string }> = [
  { label: 'Sedentary', value: 'sedentary', desc: 'Desk job, little movement' },
  { label: 'Light', value: 'light', desc: '1–3 workouts/week' },
  { label: 'Moderate', value: 'moderate', desc: '3–5 workouts/week' },
  { label: 'Active', value: 'active', desc: '6–7 workouts/week' },
  { label: 'Very active', value: 'very_active', desc: 'Athletic training daily' },
];

const GOAL_OPTIONS: Array<{ label: string; value: WeightGoal; emoji: string }> = [
  { label: 'Lose weight', value: 'lose', emoji: '🔥' },
  { label: 'Stay balanced', value: 'maintain', emoji: '⚖️' },
  { label: 'Build mass', value: 'gain', emoji: '💪' },
];

const GENDER_OPTIONS: Array<{ label: string; value: Gender }> = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const DEFAULT_STATE: OnboardingData = {
  step: 0,
  displayName: '',
  gender: null,
  dateOfBirth: null,
  heightCm: null,
  currentWeightKg: null,
  targetWeightKg: null,
  weightGoal: 'maintain',
  activityLevel: 'moderate',
  dietaryRestrictions: [],
  allergies: [],
};

interface OnboardingScreenProps {
  onComplete: () => void;
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { user, refreshProfile } = useAuth();
  const [data, setData] = useState<OnboardingData>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local string states for number inputs
  const [heightStr, setHeightStr] = useState('');
  const [currWeightStr, setCurrWeightStr] = useState('');
  const [targetWeightStr, setTargetWeightStr] = useState('');

  const step = data.step;

  function patch<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((d) => ({ ...d, [key]: value }));
    setError(null);
  }

  function toggleDietary(value: DietaryRestriction) {
    const list = data.dietaryRestrictions;
    patch(
      'dietaryRestrictions',
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );
  }

  function canAdvance(): boolean {
    switch (step) {
      case 0: return data.displayName.trim().length >= 2;
      case 1: return data.gender !== null;
      case 2: return (parseFloat(heightStr) > 0) && (parseFloat(currWeightStr) > 0) && (parseFloat(targetWeightStr) > 0);
      case 3: return true;
      case 4: return true;
      default: return true;
    }
  }

  async function handleNext() {
    if (step < TOTAL_STEPS - 1) {
      // Sync number inputs into data
      if (step === 2) {
        patch('heightCm', parseFloat(heightStr) || null);
        patch('currentWeightKg', parseFloat(currWeightStr) || null);
        patch('targetWeightKg', parseFloat(targetWeightStr) || null);
      }
      patch('step', step + 1);
    } else {
      await handleFinish();
    }
  }

  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const heightCm = parseFloat(heightStr) || data.heightCm || 170;
      const currentWeightKg = parseFloat(currWeightStr) || data.currentWeightKg || 70;
      const targetWeightKg = parseFloat(targetWeightStr) || data.targetWeightKg || 70;

      const targets = (data.gender && data.dateOfBirth)
        ? calculateDailyTargets({
            weightKg: currentWeightKg,
            targetWeightKg,
            heightCm,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            activityLevel: data.activityLevel,
            weightGoal: data.weightGoal,
          })
        : { calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 67 };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbErr } = await (supabase.from('profiles') as any).update({
        display_name: data.displayName.trim(),
        gender: data.gender,
        date_of_birth: data.dateOfBirth,
        height_cm: heightCm,
        current_weight_kg: currentWeightKg,
        target_weight_kg: targetWeightKg,
        weight_goal: data.weightGoal,
        activity_level: data.activityLevel,
        dietary_restrictions: data.dietaryRestrictions,
        allergies: data.allergies,
        daily_calorie_target: targets.calories,
        daily_protein_g: targets.protein_g,
        daily_carbs_g: targets.carbs_g,
        daily_fat_g: targets.fat_g,
        onboarding_complete: true,
      }).eq('id', user.id);

      if (dbErr) throw dbErr;
      await refreshProfile();
      onComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          {step > 0 ? (
            <TouchableOpacity onPress={() => patch('step', step - 1)} style={styles.backBtn}>
              <DinText style={styles.backArrow}>←</DinText>
            </TouchableOpacity>
          ) : <View style={styles.backBtn} />}
          <ProgressDots total={TOTAL_STEPS} current={step} />
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Step 0: Welcome & name */}
          {step === 0 && (
            <OnboardingStep
              visible={step === 0}
              title={`Hello,\nI'm Dindin.`}
              subtitle="I'll help you and your partner eat well together. First, what should I call you?"
            >
              <View style={styles.textInputWrap}>
                <DinText variant="label">Your name</DinText>
                <View style={styles.bigInput}>
                  <DinText style={styles.bigInputCursor}>{data.displayName || ' '}</DinText>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {/* Simple name entry via keyboard-ish approach */}
                  {/* In production this would be a styled TextInput */}
                  <View>
                    <DinText variant="caption" color={Colors.textMuted}>
                      Type your first name below
                    </DinText>
                  </View>
                </ScrollView>
                <NameTextInput value={data.displayName} onChange={(v) => patch('displayName', v)} />
              </View>
            </OnboardingStep>
          )}

          {/* Step 1: Gender */}
          {step === 1 && (
            <OnboardingStep
              visible={step === 1}
              title={`Nice to meet\nyou, ${data.displayName}.`}
              subtitle="To calculate your personalised calorie targets, I need a couple of details."
            >
              <DinText variant="label">How do you identify?</DinText>
              <ChipSelector
                options={GENDER_OPTIONS}
                selected={data.gender ? [data.gender] : []}
                onToggle={(v) => patch('gender', v as Gender)}
                multiSelect={false}
              />
              <View style={styles.dobRow}>
                <DinText variant="label">Date of birth</DinText>
                <DateInputSimple
                  value={data.dateOfBirth ?? ''}
                  onChange={(v) => patch('dateOfBirth', v)}
                />
              </View>
            </OnboardingStep>
          )}

          {/* Step 2: Body stats */}
          {step === 2 && (
            <OnboardingStep
              visible={step === 2}
              title="Body stats"
              subtitle="These stay private — they're only used to personalise your calorie target."
            >
              <NumberInput
                label="Height"
                value={heightStr}
                onChangeText={setHeightStr}
                unit="cm"
                placeholder="170"
                min={100}
                max={250}
              />
              <NumberInput
                label="Current weight"
                value={currWeightStr}
                onChangeText={setCurrWeightStr}
                unit="kg"
                placeholder="70"
                min={30}
                max={300}
              />
              <NumberInput
                label="Target weight"
                value={targetWeightStr}
                onChangeText={setTargetWeightStr}
                unit="kg"
                placeholder="65"
                min={30}
                max={300}
              />
            </OnboardingStep>
          )}

          {/* Step 3: Goal & activity */}
          {step === 3 && (
            <OnboardingStep
              visible={step === 3}
              title="Your intention"
              subtitle="No judgement here — every goal is valid."
            >
              <DinText variant="label">What's your goal?</DinText>
              <View style={styles.goalRow}>
                {GOAL_OPTIONS.map((opt) => (
                  <GoalCard
                    key={opt.value}
                    emoji={opt.emoji}
                    label={opt.label}
                    selected={data.weightGoal === opt.value}
                    onPress={() => patch('weightGoal', opt.value)}
                  />
                ))}
              </View>

              <DinText variant="label" style={{ marginTop: Spacing.md }}>Activity level</DinText>
              {ACTIVITY_OPTIONS.map((opt) => (
                <ActivityRow
                  key={opt.value}
                  label={opt.label}
                  desc={opt.desc}
                  selected={data.activityLevel === opt.value}
                  onPress={() => patch('activityLevel', opt.value)}
                />
              ))}
            </OnboardingStep>
          )}

          {/* Step 4: Dietary */}
          {step === 4 && (
            <OnboardingStep
              visible={step === 4}
              title="Any food rules?"
              subtitle="Select everything that applies. You can always update this later in Settings."
            >
              <DinText variant="label">Dietary preferences</DinText>
              <ChipSelector
                options={DIETARY_OPTIONS}
                selected={data.dietaryRestrictions}
                onToggle={toggleDietary}
              />
              <DinText variant="label" style={{ marginTop: Spacing.md }}>Allergies</DinText>
              <AllergyInput
                value={data.allergies}
                onChange={(v) => patch('allergies', v)}
              />
            </OnboardingStep>
          )}
        </ScrollView>

        {/* Error */}
        {error ? (
          <View style={styles.errorBanner}>
            <DinText variant="caption" color={Colors.error}>{error}</DinText>
          </View>
        ) : null}

        {/* Footer CTA */}
        <View style={styles.footer}>
          <DinButton
            label={step === TOTAL_STEPS - 1 ? "Let’s start cooking" : 'Continue'}
            onPress={handleNext}
            disabled={!canAdvance()}
            loading={saving}
          />
          {step === 4 && (
            <TouchableOpacity onPress={handleFinish} style={{ marginTop: 12, alignSelf: 'center' }}>
              <DinText variant="caption" color={Colors.textMuted}>Skip for now</DinText>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────

import { TextInput } from 'react-native';

function NameTextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Your name"
      placeholderTextColor={Colors.textMuted}
      autoFocus
      style={{
        fontFamily: FontFamily.fraunces,
        fontSize: 28,
        color: Colors.deepGreen,
        borderBottomWidth: 2,
        borderBottomColor: Colors.gold,
        paddingVertical: 8,
        marginTop: 8,
      }}
    />
  );
}

function DateInputSimple({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={Colors.textMuted}
      keyboardType="numeric"
      style={{
        fontFamily: FontFamily.sora,
        fontSize: 16,
        color: Colors.deepGreen,
        backgroundColor: Colors.paleGoldMedium,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        marginTop: 6,
      }}
    />
  );
}

function GoalCard({
  emoji, label, selected, onPress,
}: {
  emoji: string; label: string; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.goalCard,
        selected && styles.goalCardSelected,
      ]}
    >
      <DinText style={styles.goalEmoji}>{emoji}</DinText>
      <DinText
        variant="caption"
        style={[styles.goalLabel, selected && styles.goalLabelSelected]}
      >
        {label}
      </DinText>
    </TouchableOpacity>
  );
}

function ActivityRow({
  label, desc, selected, onPress,
}: {
  label: string; desc: string; selected: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.activityRow, selected && styles.activityRowSelected]}
    >
      <View style={styles.activityDot}>
        {selected && <View style={styles.activityDotInner} />}
      </View>
      <View style={{ flex: 1 }}>
        <DinText variant="body" style={selected ? { color: Colors.deepGreen, fontFamily: FontFamily.soraSemibold } : {}}>
          {label}
        </DinText>
        <DinText variant="caption">{desc}</DinText>
      </View>
    </TouchableOpacity>
  );
}

function AllergyInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function addAllergy() {
    const trimmed = draft.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setDraft('');
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.allergyInputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="e.g. Peanuts, Shellfish…"
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={addAllergy}
          returnKeyType="done"
          style={{
            flex: 1,
            fontFamily: FontFamily.sora,
            fontSize: 15,
            color: Colors.deepGreen,
          }}
        />
        <TouchableOpacity onPress={addAllergy} style={styles.addBtn}>
          <DinText style={{ color: Colors.paleGoldLight, fontFamily: FontFamily.soraSemibold }}>Add</DinText>
        </TouchableOpacity>
      </View>
      {value.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {value.map((allergy) => (
            <TouchableOpacity
              key={allergy}
              onPress={() => onChange(value.filter((a) => a !== allergy))}
              style={styles.allergyChip}
            >
              <DinText variant="caption" color={Colors.deepGreen}>{allergy} ×</DinText>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.deepGreen },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  errorBanner: {
    marginHorizontal: Spacing.lg,
    marginBottom: 8,
    padding: Spacing.sm,
    backgroundColor: '#FDECEA',
    borderRadius: BorderRadius.sm,
  },
  textInputWrap: { gap: Spacing.sm },
  bigInput: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: Colors.paleGoldMedium,
  },
  bigInputCursor: {
    fontFamily: FontFamily.fraunces,
    fontSize: 28,
    color: Colors.deepGreen,
    minHeight: 38,
  },
  dobRow: { gap: 4, marginTop: Spacing.md },
  goalRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 8,
  },
  goalCard: {
    flex: 1,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalCardSelected: {
    borderColor: Colors.deepGreen,
    backgroundColor: Colors.paleGoldLight,
  },
  goalEmoji: { fontSize: 28 },
  goalLabel: { textAlign: 'center', color: Colors.textSecondary },
  goalLabelSelected: { color: Colors.deepGreen, fontFamily: FontFamily.soraSemibold },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.paleGoldMedium,
    marginBottom: 6,
  },
  activityRowSelected: {
    backgroundColor: Colors.paleGoldLight,
    borderWidth: 1.5,
    borderColor: Colors.deepGreen,
  },
  activityDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.deepGreen,
  },
  allergyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  addBtn: {
    backgroundColor: Colors.deepGreen,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  allergyChip: {
    backgroundColor: Colors.paleGoldMedium,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
});
