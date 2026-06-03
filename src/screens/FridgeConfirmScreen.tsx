import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@context/AuthContext';
import { bulkAddFromFridgeScan } from '@services/inventory';
import { IngredientsList } from '@components/camera/IngredientsList';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { FridgeScanResult, FridgeIngredient } from '@services/aiVision';

interface FridgeConfirmScreenProps {
  imageUri: string;
  result: FridgeScanResult;
  coupleId: string | null;
  onSaved: (addedCount: number) => void;
  onCancel: () => void;
}

export function FridgeConfirmScreen({
  imageUri,
  result,
  coupleId,
  onSaved,
  onCancel,
}: FridgeConfirmScreenProps) {
  const { user } = useAuth();
  const [ingredients, setIngredients] = useState<FridgeIngredient[]>(result.ingredients);
  const [selected, setSelected] = useState<Set<number>>(
    new Set(result.ingredients.map((_, i) => i)),  // all selected by default
  );
  const [saving, setSaving] = useState(false);

  function toggleItem(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function editItem(index: number, updated: FridgeIngredient) {
    setIngredients((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(ingredients.map((_, i) => i)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function handleSave() {
    if (!user || !coupleId) {
      Alert.alert('No couple linked', 'Link with your partner first to sync inventory.');
      return;
    }
    if (selected.size === 0) {
      Alert.alert('Nothing selected', 'Select at least one item to add.');
      return;
    }

    setSaving(true);
    try {
      const selectedIngredients = ingredients.filter((_, i) => selected.has(i));
      const { added, skipped } = await bulkAddFromFridgeScan({
        coupleId,
        userId: user.id,
        ingredients: selectedIngredients,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(added);
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Please try again.');
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
        <DinText variant="subheading">Fridge scan</DinText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Scanned photo thumbnail */}
        <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />

        {/* Selection controls */}
        <View style={styles.selectionBar}>
          <DinText variant="caption" color={Colors.textSecondary}>
            {selected.size} of {ingredients.length} selected
          </DinText>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={selectAll}>
              <DinText variant="caption" color={Colors.deepGreen}>All</DinText>
            </TouchableOpacity>
            <DinText variant="caption" color={Colors.textMuted}> · </DinText>
            <TouchableOpacity onPress={deselectAll}>
              <DinText variant="caption" color={Colors.textSecondary}>None</DinText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ingredients + recipe suggestions */}
        <IngredientsList
          ingredients={ingredients}
          selected={selected}
          onToggle={toggleItem}
          onEdit={editItem}
          recipeSuggestions={result.recipeSuggestions}
        />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <DinText variant="caption" color={Colors.textSecondary} style={styles.footerHint}>
          Selected items will be added to your shared inventory with estimated expiry dates.
          Long-press any item to edit its details.
        </DinText>
        <DinButton
          label={`Add ${selected.size} item${selected.size !== 1 ? 's' : ''} to fridge`}
          onPress={handleSave}
          loading={saving}
          disabled={saving || selected.size === 0}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.deepGreen },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  photo: {
    height: 160,
    borderRadius: BorderRadius.lg,
    width: '100%',
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  footerHint: {
    lineHeight: 18,
    textAlign: 'center',
  },
});
