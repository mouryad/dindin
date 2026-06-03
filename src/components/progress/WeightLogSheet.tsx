import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';

interface WeightLogSheetProps {
  visible: boolean;
  lastWeightKg: number | null;
  saving: boolean;
  onSave: (weightKg: number, notes?: string) => Promise<void>;
  onClose: () => void;
}

export function WeightLogSheet({ visible, lastWeightKg, saving, onSave, onClose }: WeightLogSheetProps) {
  const [weightStr, setWeightStr] = useState(lastWeightKg?.toFixed(1) ?? '');
  const [notes, setNotes] = useState('');

  const translateY = useSharedValue(400);
  const backdropOp = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOp.value = withTiming(1, { duration: 260 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
      if (lastWeightKg) setWeightStr(lastWeightKg.toFixed(1));
    } else {
      backdropOp.value = withTiming(0, { duration: 200 });
      translateY.value = withSpring(400, { damping: 20 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOp.value }));
  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  async function handleSave() {
    const kg = parseFloat(weightStr);
    if (!kg || kg < 20 || kg > 500) return;
    await onSave(kg, notes.trim() || undefined);
    setNotes('');
    onClose();
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

          <DinText variant="subheading" style={styles.title}>Log your weight</DinText>

          {/* Weight input — large, centered */}
          <View style={styles.weightRow}>
            <TextInput
              value={weightStr}
              onChangeText={setWeightStr}
              keyboardType="decimal-pad"
              style={styles.weightInput}
              placeholder="70.0"
              placeholderTextColor={Colors.textMuted}
              autoFocus={visible}
              selectTextOnFocus
            />
            <DinText style={styles.kgUnit}>kg</DinText>
          </View>

          {/* Quick adjust buttons */}
          <View style={styles.adjustRow}>
            {[-0.5, -0.1, +0.1, +0.5].map((delta) => (
              <TouchableOpacity
                key={delta}
                onPress={() => setWeightStr((prev) => {
                  const next = (parseFloat(prev) || 0) + delta;
                  return next.toFixed(1);
                })}
                style={styles.adjustBtn}
              >
                <DinText style={styles.adjustBtnLabel}>
                  {delta > 0 ? `+${delta}` : `${delta}`}
                </DinText>
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional notes */}
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Optional note (e.g. post-workout)"
            placeholderTextColor={Colors.textMuted}
            style={styles.notesInput}
            returnKeyType="done"
          />

          <DinButton
            label="Save weight"
            onPress={handleSave}
            loading={saving}
            disabled={!parseFloat(weightStr) || saving}
            style={styles.saveBtn}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(45,58,31,0.4)',
    zIndex: 20,
  },
  avoidWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 21,
  },
  sheet: {
    backgroundColor: Colors.paleGoldLight,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 48,
    gap: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.paleGoldMedium,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  title: { textAlign: 'center' },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  weightInput: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 64,
    color: Colors.deepGreen,
    textAlign: 'center',
    minWidth: 160,
  },
  kgUnit: {
    fontFamily: FontFamily.sora,
    fontSize: 22,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  adjustRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  adjustBtn: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  adjustBtnLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 14,
    color: Colors.deepGreen,
  },
  notesInput: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontFamily: FontFamily.sora,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  saveBtn: {
    marginTop: 4,
  },
});
