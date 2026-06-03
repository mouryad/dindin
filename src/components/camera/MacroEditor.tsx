import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { AiMealAnalysis, MealType } from '@db/database';

export interface EditableMacros {
  dishName: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fiberG: string;
  servingSize: string;
  mealType: MealType;
  numServings: string;
}

interface MacroEditorProps {
  analysis: AiMealAnalysis;
  onChange: (macros: EditableMacros) => void;
}

const MEAL_TYPES: Array<{ value: MealType; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

export function MacroEditor({ analysis, onChange }: MacroEditorProps) {
  const [macros, setMacros] = useState<EditableMacros>({
    dishName: analysis.dish_name ?? '',
    calories: String(Math.round(analysis.calories ?? 0)),
    proteinG: String(Math.round(analysis.protein_g ?? 0)),
    carbsG: String(Math.round(analysis.carbs_g ?? 0)),
    fatG: String(Math.round(analysis.fat_g ?? 0)),
    fiberG: String(Math.round(analysis.fiber_g ?? 0)),
    servingSize: analysis.serving_size ?? '1 serving',
    mealType: 'lunch',
    numServings: '1',
  });

  function update<K extends keyof EditableMacros>(key: K, value: EditableMacros[K]) {
    const next = { ...macros, [key]: value };
    setMacros(next);
    onChange(next);
  }

  const confidence = analysis.confidence ?? 0;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
      {/* Confidence badge */}
      {confidence > 0 && (
        <View style={[styles.confidenceBadge, { borderColor: confidenceColor(confidence) }]}>
          <DinText variant="caption" color={confidenceColor(confidence)}>
            AI confidence: {Math.round(confidence * 100)}%
            {confidence < 0.6 ? ' — please verify' : confidence > 0.85 ? ' — high accuracy' : ''}
          </DinText>
        </View>
      )}

      {/* Dish name */}
      <View style={styles.field}>
        <DinText variant="label">Dish name</DinText>
        <TextInput
          value={macros.dishName}
          onChangeText={(v) => update('dishName', v)}
          style={styles.textInput}
          placeholder="What did you eat?"
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Meal type picker */}
      <View style={styles.field}>
        <DinText variant="label">Meal type</DinText>
        <View style={styles.mealTypeRow}>
          {MEAL_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              onPress={() => update('mealType', t.value)}
              style={[styles.mealTypeChip, macros.mealType === t.value && styles.mealTypeChipActive]}
            >
              <DinText
                variant="caption"
                color={macros.mealType === t.value ? Colors.paleGoldLight : Colors.textSecondary}
              >
                {t.label}
              </DinText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Macro grid */}
      <View style={styles.macroGrid}>
        <MacroField
          label="Calories"
          value={macros.calories}
          unit="kcal"
          color="#2D3A1F"
          onChange={(v) => update('calories', v)}
        />
        <MacroField
          label="Protein"
          value={macros.proteinG}
          unit="g"
          color="#4A7C59"
          onChange={(v) => update('proteinG', v)}
        />
        <MacroField
          label="Carbs"
          value={macros.carbsG}
          unit="g"
          color="#B8A678"
          onChange={(v) => update('carbsG', v)}
        />
        <MacroField
          label="Fat"
          value={macros.fatG}
          unit="g"
          color="#C4874F"
          onChange={(v) => update('fatG', v)}
        />
      </View>

      {/* Servings */}
      <View style={styles.servingsRow}>
        <View style={[styles.field, { flex: 1 }]}>
          <DinText variant="label">Servings</DinText>
          <TextInput
            value={macros.numServings}
            onChangeText={(v) => update('numServings', v)}
            keyboardType="numeric"
            style={styles.textInput}
          />
        </View>
        <View style={[styles.field, { flex: 2 }]}>
          <DinText variant="label">Serving size</DinText>
          <TextInput
            value={macros.servingSize}
            onChangeText={(v) => update('servingSize', v)}
            style={styles.textInput}
            placeholder="e.g. 1 bowl (300g)"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function MacroField({
  label, value, unit, color, onChange,
}: {
  label: string; value: string; unit: string; color: string; onChange: (v: string) => void;
}) {
  return (
    <View style={[styles.macroField, { borderColor: color }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        style={[styles.macroValue, { color }]}
      />
      <DinText variant="caption" color={Colors.textMuted}>{unit}</DinText>
      <DinText variant="label" color={Colors.textSecondary} style={styles.macroLabel}>{label}</DinText>
    </View>
  );
}

function confidenceColor(confidence: number): string {
  if (confidence > 0.8) return Colors.success ?? '#27AE60';
  if (confidence > 0.6) return Colors.gold;
  return Colors.error ?? '#C0392B';
}

const Colors_ = Colors as typeof Colors & { success?: string; error?: string };

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  confidenceBadge: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  field: {
    gap: 6,
    marginBottom: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontFamily: FontFamily.sora,
    fontSize: 15,
    color: Colors.deepGreen,
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  mealTypeChip: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  mealTypeChipActive: {
    backgroundColor: Colors.deepGreen,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  macroField: {
    width: '47.5%',
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    gap: 2,
    alignItems: 'center',
  },
  macroValue: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 26,
    textAlign: 'center',
    width: '100%',
  },
  macroLabel: {
    marginTop: 2,
  },
  servingsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
