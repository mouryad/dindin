import React, { useState } from 'react';
import {
  View,
  Image,
  ScrollView,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useWasteLog } from '@hooks/useWasteLog';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { WasteScanResult } from '@services/aiVision';
import type { WasteItem } from '@db/database';

interface WasteConfirmScreenProps {
  imageUri: string;
  result: WasteScanResult;
  onSaved: (totalWeightG: number, totalCalories: number) => void;
  onCancel: () => void;
}

export function WasteConfirmScreen({ imageUri, result, onSaved, onCancel }: WasteConfirmScreenProps) {
  const { saveWasteLog } = useWasteLog();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Success animation
  const savedScale = useSharedValue(1);
  const savedStyle = useAnimatedStyle(() => ({ transform: [{ scale: savedScale.value }] }));

  async function handleSave() {
    setSaving(true);
    try {
      const items: WasteItem[] = result.waste_items.map((i) => ({
        name: i.name,
        qty: i.qty,
        unit: i.unit,
        calories: i.calories,
      }));
      await saveWasteLog({
        waste_items: items,
        estimated_weight_g: result.estimated_weight_g,
        estimated_calories: result.estimated_calories,
        notes: notes.trim() || undefined,
      });
      savedScale.value = withSequence(
        withSpring(1.18, { damping: 8 }),
        withSpring(1, { damping: 14 }),
      );
      onSaved(result.estimated_weight_g, result.estimated_calories);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save waste log');
    } finally {
      setSaving(false);
    }
  }

  const weightKg = (result.estimated_weight_g / 1000).toFixed(2);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
            <DinText style={styles.closeBtnText}>✕</DinText>
          </TouchableOpacity>
          <DinText variant="heading" style={styles.title}>Food waste</DinText>
          <View style={{ width: 36 }} />
        </View>

        {/* Photo */}
        <View style={styles.photoWrap}>
          <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
          <View style={styles.photoOverlay}>
            <DinText style={styles.photoOverlayText}>🗑️ AI analysis complete</DinText>
          </View>
        </View>

        {/* Summary totals */}
        <Animated.View style={[styles.summaryCard, savedStyle]}>
          <View style={styles.summaryRow}>
            <SummaryPill icon="⚖️" label="Weight" value={`${weightKg} kg`} />
            <SummaryPill icon="🔥" label="Wasted" value={`${result.estimated_calories} kcal`} />
            <SummaryPill icon="📦" label="Items" value={`${result.waste_items.length}`} />
          </View>
        </Animated.View>

        {/* Waste items list */}
        {result.waste_items.length > 0 && (
          <View style={styles.section}>
            <DinText variant="label">Detected items</DinText>
            {result.waste_items.map((item, i) => (
              <View key={i} style={styles.wasteItemRow}>
                <View style={styles.wasteItemDot} />
                <View style={{ flex: 1 }}>
                  <DinText variant="body">{item.name}</DinText>
                  <DinText variant="caption" color={Colors.textSecondary}>
                    {item.qty}{item.unit} · {item.calories} kcal
                  </DinText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Impact note */}
        <View style={styles.impactCard}>
          <DinText style={styles.impactEmoji}>💚</DinText>
          <DinText variant="caption" color={Colors.textSecondary} style={styles.impactText}>
            Tracking food waste helps you buy smarter and reduce your environmental footprint.
          </DinText>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <DinText variant="label">Notes (optional)</DinText>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. Forgot leftovers in fridge"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={3}
            style={styles.notesInput}
            textAlignVertical="top"
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <DinButton
            label={saving ? 'Saving…' : 'Log waste'}
            onPress={handleSave}
            loading={saving}
          />
          <TouchableOpacity onPress={onCancel} style={styles.cancelLink}>
            <DinText variant="caption" color={Colors.textMuted}>Discard</DinText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryPill({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.summaryPill}>
      <DinText style={styles.pillIcon}>{icon}</DinText>
      <DinText style={styles.pillValue}>{value}</DinText>
      <DinText variant="caption" color={Colors.textSecondary}>{label}</DinText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
  closeBtnText: { fontSize: 16, color: Colors.textSecondary },
  title: { fontSize: 22 },

  photoWrap: {
    height: 220,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.paleGoldMedium,
  },
  photo: { width: '100%', height: '100%' },
  photoOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(45,58,31,0.72)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  photoOverlayText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 12,
    color: Colors.paleGoldLight,
  },

  summaryCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryPill: { alignItems: 'center', gap: 4 },
  pillIcon: { fontSize: 22 },
  pillValue: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 20,
    color: Colors.deepGreen,
  },

  section: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  wasteItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  wasteItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C4874F',
    marginTop: 6,
  },

  impactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  impactEmoji: { fontSize: 24 },
  impactText: { flex: 1, lineHeight: 20 },

  notesInput: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontFamily: FontFamily.sora,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },

  actions: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  cancelLink: { alignSelf: 'center' },
});
