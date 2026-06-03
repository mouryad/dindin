import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { FridgeIngredient } from '@services/aiVision';

const CATEGORY_ICONS: Record<string, string> = {
  produce: '🥦',
  dairy: '🥛',
  meat: '🥩',
  seafood: '🐟',
  grains: '🌾',
  condiments: '🫙',
  beverages: '🧃',
  frozen: '❄️',
  other: '📦',
};

interface IngredientsListProps {
  ingredients: FridgeIngredient[];
  selected: Set<number>;
  onToggle: (index: number) => void;
  onEdit: (index: number, ingredient: FridgeIngredient) => void;
  recipeSuggestions: string[];
}

export function IngredientsList({
  ingredients,
  selected,
  onToggle,
  onEdit,
  recipeSuggestions,
}: IngredientsListProps) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
      <DinText variant="label" style={styles.sectionLabel}>
        {ingredients.length} items detected
      </DinText>
      <DinText variant="caption" color={Colors.textSecondary} style={styles.hint}>
        Tap to select items to add to your shared inventory.
      </DinText>

      <View style={styles.list}>
        {ingredients.map((ing, i) => (
          <IngredientRow
            key={i}
            ingredient={ing}
            selected={selected.has(i)}
            onToggle={() => onToggle(i)}
            onEdit={(updated) => onEdit(i, updated)}
          />
        ))}
      </View>

      {recipeSuggestions.length > 0 && (
        <View style={styles.recipesSection}>
          <DinText variant="label" style={styles.sectionLabel}>Recipe ideas</DinText>
          {recipeSuggestions.map((r, i) => (
            <View key={i} style={styles.recipeChip}>
              <DinText style={styles.recipeNum}>{i + 1}</DinText>
              <DinText variant="body">{r}</DinText>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function IngredientRow({
  ingredient, selected, onToggle, onEdit,
}: {
  ingredient: FridgeIngredient;
  selected: boolean;
  onToggle: () => void;
  onEdit: (updated: FridgeIngredient) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ingredient);

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handleToggle() {
    scale.value = withSpring(0.95, { damping: 12 }, () => {
      scale.value = withSpring(1);
    });
    onToggle();
  }

  function commitEdit() {
    onEdit(draft);
    setEditing(false);
  }

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        onPress={handleToggle}
        onLongPress={() => setEditing(true)}
        activeOpacity={0.85}
        style={[styles.row, selected && styles.rowSelected]}
      >
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <DinText style={styles.checkmark}>✓</DinText>}
        </View>
        <DinText style={styles.categoryIcon}>
          {CATEGORY_ICONS[ingredient.category] ?? CATEGORY_ICONS.other}
        </DinText>
        <View style={styles.rowBody}>
          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                value={draft.name}
                onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
                style={styles.editInput}
                autoFocus
                onBlur={commitEdit}
                returnKeyType="done"
                onSubmitEditing={commitEdit}
              />
              <TextInput
                value={draft.quantity}
                onChangeText={(v) => setDraft((d) => ({ ...d, quantity: v }))}
                style={[styles.editInput, { width: 60 }]}
                keyboardType="numeric"
              />
              <TextInput
                value={draft.unit}
                onChangeText={(v) => setDraft((d) => ({ ...d, unit: v }))}
                style={[styles.editInput, { width: 50 }]}
              />
            </View>
          ) : (
            <>
              <DinText variant="body">{ingredient.name}</DinText>
              <DinText variant="caption" color={Colors.textMuted}>
                {ingredient.quantity} {ingredient.unit} · {ingredient.category}
              </DinText>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  sectionLabel: { marginBottom: 4 },
  hint: { marginBottom: Spacing.md },
  list: { gap: 6, marginBottom: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowSelected: {
    borderColor: Colors.deepGreen,
    backgroundColor: Colors.paleGoldLight,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.deepGreen,
    borderColor: Colors.deepGreen,
  },
  checkmark: {
    fontSize: 13,
    color: Colors.paleGoldLight,
    lineHeight: 16,
  },
  categoryIcon: { fontSize: 20 },
  rowBody: { flex: 1, gap: 2 },
  editRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  editInput: {
    flex: 1,
    fontFamily: FontFamily.sora,
    fontSize: 14,
    color: Colors.deepGreen,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gold,
    paddingVertical: 2,
  },
  recipesSection: { gap: Spacing.sm },
  recipeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  recipeNum: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 22,
    color: Colors.gold,
    width: 28,
  },
});
