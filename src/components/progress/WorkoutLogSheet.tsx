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
import * as Haptics from 'expo-haptics';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import { ACTIVITY_TYPES, estimateCalories, type ActivityId } from '@hooks/useHealthData';

interface WorkoutLogSheetProps {
  visible: boolean;
  weightKg: number;
  saving: boolean;
  onSave: (activityId: ActivityId, durationMin: number) => Promise<void>;
  onClose: () => void;
}

const QUICK_DURATIONS = [15, 30, 45, 60, 90];

export function WorkoutLogSheet({ visible, weightKg, saving, onSave, onClose }: WorkoutLogSheetProps) {
  const [selectedActivity, setSelectedActivity] = useState<ActivityId>('walk');
  const [durationStr, setDurationStr] = useState('30');

  const translateY = useSharedValue(500);
  const backdropOp = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOp.value = withTiming(1, { duration: 260 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
    } else {
      backdropOp.value = withTiming(0, { duration: 200 });
      translateY.value = withSpring(500, { damping: 20 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOp.value }));
  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const durationMin = parseInt(durationStr, 10) || 0;
  const estimatedCal = durationMin > 0
    ? estimateCalories(selectedActivity, durationMin, weightKg)
    : 0;

  async function handleSave() {
    if (durationMin < 1) return;
    await onSave(selectedActivity, durationMin);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDurationStr('30');
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
          <DinText variant="subheading" style={styles.title}>Log activity</DinText>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Activity type */}
            <DinText variant="label" style={styles.fieldLabel}>Activity type</DinText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.activityScroll}>
              {ACTIVITY_TYPES.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => setSelectedActivity(a.id)}
                  style={[
                    styles.activityChip,
                    selectedActivity === a.id && styles.activityChipActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <DinText style={styles.activityIcon}>{a.icon}</DinText>
                  <DinText
                    style={[
                      styles.activityLabel,
                      selectedActivity === a.id && styles.activityLabelActive,
                    ]}
                  >
                    {a.label}
                  </DinText>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Duration */}
            <DinText variant="label" style={styles.fieldLabel}>Duration</DinText>
            <View style={styles.durationRow}>
              <TextInput
                value={durationStr}
                onChangeText={setDurationStr}
                keyboardType="number-pad"
                style={styles.durationInput}
                selectTextOnFocus
              />
              <DinText style={styles.durationUnit}>min</DinText>
            </View>

            {/* Quick duration pills */}
            <View style={styles.quickRow}>
              {QUICK_DURATIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDurationStr(String(d))}
                  style={[
                    styles.quickPill,
                    durationMin === d && styles.quickPillActive,
                  ]}
                  activeOpacity={0.75}
                >
                  <DinText
                    style={[
                      styles.quickPillLabel,
                      durationMin === d && styles.quickPillLabelActive,
                    ]}
                  >
                    {d}m
                  </DinText>
                </TouchableOpacity>
              ))}
            </View>

            {/* Estimated calories */}
            {estimatedCal > 0 && (
              <View style={styles.estimateRow}>
                <DinText variant="caption" color={Colors.textSecondary}>
                  Estimated burn
                </DinText>
                <DinText style={styles.estimateCal}>
                  {`~${estimatedCal} kcal`}
                </DinText>
              </View>
            )}

            <DinButton
              label="Save activity"
              onPress={handleSave}
              loading={saving}
              disabled={durationMin < 1 || saving}
              style={styles.saveBtn}
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
  title: { textAlign: 'center', marginBottom: Spacing.sm },
  fieldLabel: { marginBottom: 8, marginTop: Spacing.md },
  activityScroll: { marginBottom: 4 },
  activityChip: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minWidth: 64,
  },
  activityChipActive: {
    backgroundColor: Colors.deepGreen,
    borderColor: Colors.deepGreen,
  },
  activityIcon: { fontSize: 22 },
  activityLabel: {
    fontFamily: FontFamily.sora,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  activityLabelActive: {
    color: Colors.paleGoldLight,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  durationInput: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 56,
    color: Colors.deepGreen,
    textAlign: 'center',
    minWidth: 120,
  },
  durationUnit: {
    fontFamily: FontFamily.sora,
    fontSize: 20,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  quickPill: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickPillActive: {
    backgroundColor: Colors.deepGreen,
  },
  quickPillLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  quickPillLabelActive: {
    color: Colors.paleGoldLight,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginBottom: Spacing.md,
  },
  estimateCal: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 20,
    color: Colors.deepGreen,
  },
  saveBtn: { marginTop: 4 },
});
