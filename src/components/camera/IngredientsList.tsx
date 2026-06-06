import React, { useState, useRef } from 'react';
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
        Tap to select · double-tap to edit name or quantity
      </DinText>

      <View style={styles.list}>
        {ingredients.map((ing, i) => (
          <IngredientRow
            key={`${ing.name}-${i}`}
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
  const qtyRef = useRef<TextInput>(null);
  const unitRef = useRef<TextInput>(null);

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handleToggle() {
    scale.value = withSpring(0.95, { damping: 12 }, () => { scale.value = withSpring(1); });
    onToggle();
  }

  function startEditing() {
    setDraft(ingredient);
    setEditing(true);
  }

  function commitEdit() {
    onEdit(draft);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(ingredient);
    setEditing(false);
  }

  return (
    <Animated.View style={animStyle}>
      {editing ? (
        <View style={[styles.row, styles.rowSelected, styles.editingRow]}>
          {/* Name row */}
          <TextInput
            value={draft.name}
            onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
            style={styles.editInputFull}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => qtyRef.current?.focus()}
            placeholder="Item name"
            placeholderTextColor={Colors.textMuted}
          />
          {/* Qty + unit + actions row */}
          <View style={styles.editSecondRow}>
            <TextInput
              ref={qtyRef}
              value={draft.quantity}
              onChangeText={(v) => setDraft((d) => ({ ...d, quantity: v }))}
              style={styles.editInputQty}
              keyboardType="numeric"
              returnKeyType="next"
              onSubmitEditing={() => unitRef.current?.focus()}
              placeholder="Qty"
              placeholderTextColor={Colors.textMuted}
            />
            <TextInput
              ref={unitRef}
              value={draft.unit}
              onChangeText={(v) => setDraft((d) => ({ ...d, unit: v }))}
              style={styles.editInputUnit}
              returnKeyType="done"
              onSubmitEditing={commitEdit}
              placeholder="Unit"
              placeholderTextColor={Colors.textMuted}
            />
            <TouchableOpacity onPress={cancelEdit} style={styles.editActionBtn}>
              <DinText style={styles.editCancel}>✕</DinText>
            </TouchableOpacity>
            <TouchableOpacity onPress={commitEdit} style={[styles.editActionBtn, styles.editConfirmBtn]}>
              <DinText style={styles.editConfirm}>✓</DinText>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleToggle}
          onLongPress={startEditing}
          delayLongPress={300}
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
            <DinText variant="body">{ingredient.name}</DinText>
            {/* Tap quantity area to edit just the quantity */}
            <TouchableOpacity onPress={startEditing} hitSlop={{ top: 6, bottom: 6, left: 0, right: 40 }}>
              <DinText variant="caption" color={Colors.textMuted}>
                {ingredient.quantity} {ingredient.unit} · {ingredient.category}
              </DinText>
            </TouchableOpacity>
          </View>
          <DinText style={styles.editHint}>✎</DinText>
        </TouchableOpacity>
      )}
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
  editingRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
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
  editHint: {
    fontSize: 14,
    color: Colors.textMuted,
    opacity: 0.6,
  },
  // Editing state
  editInputFull: {
    fontFamily: FontFamily.sora,
    fontSize: 15,
    color: Colors.deepGreen,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.gold,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  editSecondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editInputQty: {
    width: 64,
    fontFamily: FontFamily.sora,
    fontSize: 14,
    color: Colors.deepGreen,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.gold,
    paddingVertical: 4,
    paddingHorizontal: 2,
    textAlign: 'center',
  },
  editInputUnit: {
    flex: 1,
    fontFamily: FontFamily.sora,
    fontSize: 14,
    color: Colors.deepGreen,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.gold,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  editActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.paleGoldMedium,
  },
  editConfirmBtn: {
    backgroundColor: Colors.deepGreen,
  },
  editCancel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  editConfirm: {
    fontSize: 14,
    color: Colors.paleGoldLight,
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
