import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { format, addDays } from 'date-fns';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { InventoryItemInsert } from '@db/database';

const CATEGORIES = [
  { value: 'produce',    icon: '🥦', label: 'Produce' },
  { value: 'dairy',      icon: '🥛', label: 'Dairy' },
  { value: 'meat',       icon: '🥩', label: 'Meat' },
  { value: 'seafood',    icon: '🐟', label: 'Seafood' },
  { value: 'grains',     icon: '🌾', label: 'Grains' },
  { value: 'condiments', icon: '🫙', label: 'Condiments' },
  { value: 'beverages',  icon: '🧃', label: 'Beverages' },
  { value: 'frozen',     icon: '❄️', label: 'Frozen' },
  { value: 'other',      icon: '📦', label: 'Other' },
];

// Default expiry offsets (days) per category
const DEFAULT_EXPIRY: Record<string, number> = {
  produce: 5, dairy: 7, meat: 3, seafood: 2,
  grains: 180, condiments: 90, beverages: 14, frozen: 90, other: 14,
};

interface AddItemSheetProps {
  visible: boolean;
  coupleId: string;
  userId: string;
  onAdd: (item: InventoryItemInsert) => Promise<void>;
  onClose: () => void;
}

const BLANK = {
  name: '',
  category: 'produce',
  quantity: '',
  unit: '',
  notes: '',
};

export function AddItemSheet({ visible, coupleId, userId, onAdd, onClose }: AddItemSheetProps) {
  const [form, setForm]     = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const translateY = useSharedValue(500);
  const backdropOp = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOp.value = withTiming(1, { duration: 240 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 200 });
    } else {
      backdropOp.value = withTiming(0, { duration: 200 });
      translateY.value = withSpring(500, { damping: 20 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOp.value }));
  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  function patch(key: keyof typeof BLANK, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleAdd() {
    if (!form.name.trim()) return;
    setSaving(true);
    const expiryDays = DEFAULT_EXPIRY[form.category] ?? 14;
    const insert: InventoryItemInsert = {
      couple_id:        coupleId,
      added_by_user_id: userId,
      name:             form.name.trim(),
      category:         form.category,
      quantity:         parseFloat(form.quantity) || null,
      unit:             form.unit.trim() || null,
      purchase_date:    format(new Date(), 'yyyy-MM-dd'),
      expiry_date:      format(addDays(new Date(), expiryDays), 'yyyy-MM-dd'),
      low_stock_threshold: null,
      photo_url:        null,
      notes:            form.notes.trim() || null,
    };
    try {
      await onAdd(insert);
      setForm(BLANK);
      onClose();
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
          <DinText variant="subheading" style={styles.title}>Add item</DinText>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <DinText variant="label" style={styles.fieldLabel}>Item name</DinText>
            <TextInput
              value={form.name}
              onChangeText={(v) => patch('name', v)}
              placeholder="e.g. Greek yogurt"
              placeholderTextColor={Colors.textMuted}
              autoFocus={visible}
              style={styles.input}
              returnKeyType="next"
            />

            {/* Category chips */}
            <DinText variant="label" style={styles.fieldLabel}>Category</DinText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  onPress={() => patch('category', cat.value)}
                  style={[styles.catChip, form.category === cat.value && styles.catChipActive]}
                >
                  <DinText style={styles.catIcon}>{cat.icon}</DinText>
                  <DinText
                    variant="caption"
                    color={form.category === cat.value ? Colors.paleGoldLight : Colors.textSecondary}
                  >
                    {cat.label}
                  </DinText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Quantity + unit */}
            <View style={styles.qtyRow}>
              <View style={styles.qtyField}>
                <DinText variant="label" style={styles.fieldLabel}>Qty</DinText>
                <TextInput
                  value={form.quantity}
                  onChangeText={(v) => patch('quantity', v)}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                />
              </View>
              <View style={styles.unitField}>
                <DinText variant="label" style={styles.fieldLabel}>Unit</DinText>
                <TextInput
                  value={form.unit}
                  onChangeText={(v) => patch('unit', v)}
                  placeholder="kg, ml, pcs…"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Notes */}
            <DinText variant="label" style={styles.fieldLabel}>Notes (optional)</DinText>
            <TextInput
              value={form.notes}
              onChangeText={(v) => patch('notes', v)}
              placeholder="Brand, variety…"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, { marginBottom: Spacing.xl }]}
            />

            <DinButton
              label="Add to fridge"
              onPress={handleAdd}
              loading={saving}
              disabled={!form.name.trim() || saving}
            />
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(45,58,31,0.4)',
    zIndex: 30,
  },
  avoidWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 31,
  },
  sheet: {
    backgroundColor: Colors.paleGoldLight,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 52,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.paleGoldMedium,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  title: { textAlign: 'center', marginBottom: Spacing.md },
  fieldLabel: { marginBottom: 6, marginTop: Spacing.md },
  input: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontFamily: FontFamily.sora,
    fontSize: 15,
    color: Colors.deepGreen,
  },
  catScroll: { marginBottom: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 7,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  catChipActive: {
    backgroundColor: Colors.deepGreen,
    borderColor: Colors.deepGreen,
  },
  catIcon: { fontSize: 15 },
  qtyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  qtyField: { flex: 1 },
  unitField: { flex: 2 },
});
