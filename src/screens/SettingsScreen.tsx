import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { useCouple } from '@hooks/useCouple';
import { clearMealPlanCache } from '@hooks/useMealPlan';
import { calculateDailyTargets } from '@lib/macroCalculator';
import { ChipSelector } from '@components/onboarding/ChipSelector';
import { NumberInput } from '@components/onboarding/NumberInput';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { DietaryRestriction, ActivityLevel, WeightGoal } from '@db/database';

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

interface SettingsScreenProps {
  onClose: () => void;
}

export function SettingsScreen({ onClose }: SettingsScreenProps) {
  const { profile, user, refreshProfile, signOut } = useAuth();
  const { couple, updateCoupleName, leaveCouple } = useCouple();

  // ── Profile state (lazy-initialized from profile on mount) ──
  const [displayName, setDisplayName]             = useState(() => profile?.display_name ?? '');
  const [dietaryRestrictions, setDietaryRest]     = useState<DietaryRestriction[]>(() => profile?.dietary_restrictions ?? []);
  const [allergies, setAllergies]                 = useState<string[]>(() => profile?.allergies ?? []);

  // ── Goals state ──
  const [weightGoal, setWeightGoal]               = useState<WeightGoal>(() => profile?.weight_goal ?? 'maintain');
  const [activityLevel, setActivityLevel]         = useState<ActivityLevel>(() => profile?.activity_level ?? 'moderate');
  const [targetWeightStr, setTargetWeightStr]     = useState(() => profile?.target_weight_kg?.toString() ?? '');

  // ── Couple state ──
  const [coupleName, setCoupleName]               = useState(() => couple?.couple_name ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // Preview recalculated calorie target
  const previewTargets = React.useMemo(() => {
    if (!profile?.gender || !profile?.date_of_birth || !profile?.height_cm || !profile?.current_weight_kg) return null;
    const targetKg = parseFloat(targetWeightStr) || profile.target_weight_kg || profile.current_weight_kg;
    try {
      return calculateDailyTargets({
        weightKg: profile.current_weight_kg,
        targetWeightKg: targetKg,
        heightCm: profile.height_cm,
        dateOfBirth: profile.date_of_birth,
        gender: profile.gender,
        activityLevel,
        weightGoal,
      });
    } catch {
      return null;
    }
  }, [profile, activityLevel, weightGoal, targetWeightStr]);

  function toggleDietary(value: DietaryRestriction) {
    setDietaryRest((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function handleSave() {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    try {
      const targetKg = parseFloat(targetWeightStr) || profile?.target_weight_kg || null;

      const update: Record<string, unknown> = {
        display_name: displayName.trim() || profile?.display_name,
        dietary_restrictions: dietaryRestrictions,
        allergies,
        weight_goal: weightGoal,
        activity_level: activityLevel,
        target_weight_kg: targetKg,
      };

      if (previewTargets) {
        update.daily_calorie_target = previewTargets.calories;
        update.daily_protein_g      = previewTargets.protein_g;
        update.daily_carbs_g        = previewTargets.carbs_g;
        update.daily_fat_g          = previewTargets.fat_g;
      }

      const { error: dbErr } = await (supabase as any)
        .from('profiles')
        .update(update)
        .eq('id', user.id);
      if (dbErr) throw new Error(dbErr.message);

      // Save couple name only if changed
      if (couple && coupleName !== (couple.couple_name ?? '')) {
        await updateCoupleName(coupleName);
      }

      await refreshProfile();
      // Invalidate meal plan cache so it regenerates with new dietary preferences
      if (user?.id) await clearMealPlanCache(user.id).catch(() => {});
      Alert.alert('Saved', 'Your settings have been updated. Your meal plan will refresh with your new preferences.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          onClose();
          await signOut();
        },
      },
    ]);
  }

  function handleLeaveCouple() {
    const partnerName = couple?.partner?.display_name ?? 'your partner';
    Alert.alert(
      'Leave couple',
      `This will disconnect you and ${partnerName}. Your shared inventory and history will remain, but you won't be able to add to it. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await leaveCouple();
            Alert.alert('Done', "You've left the couple. You can link again anytime from the Fridge tab.");
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <DinText variant="heading" style={styles.headerTitle}>Settings</DinText>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <DinText style={styles.closeBtnText}>✕</DinText>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── PROFILE CARD ─────────────────────────────────── */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          {user?.user_metadata?.avatar_url ? (
            <Image
              source={{ uri: user.user_metadata.avatar_url as string }}
              style={styles.profileAvatar}
            />
          ) : (
            <View style={styles.profileAvatarFallback}>
              <DinText style={styles.profileAvatarInitial}>
                {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
              </DinText>
            </View>
          )}
          <View style={styles.profileInfo}>
            <DinText style={styles.profileName}>
              {profile?.display_name ?? 'Your profile'}
            </DinText>
            <DinText variant="caption" color={Colors.textSecondary}>
              {user?.email ?? ''}
            </DinText>
            {/* Auth provider badge */}
            <View style={styles.providerBadge}>
              {user?.app_metadata?.provider === 'google'
                ? <DinText style={styles.providerText}>G  Google account</DinText>
                : <DinText style={styles.providerText}>✉  Email account</DinText>
              }
            </View>
          </View>
        </View>

        {/* ── SIGN OUT ─────────────────────────────────────── */}
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn} activeOpacity={0.85}>
          <DinText style={styles.signOutLabel}>Sign out</DinText>
        </TouchableOpacity>

        {/* ── SECTION: YOUR PROFILE ────────────────────────── */}
        <SectionHeader label="Your profile" />

        <View style={styles.card}>
          {/* Display name */}
          <View style={styles.fieldRow}>
            <DinText variant="label">Display name</DinText>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={profile?.display_name ?? 'Your name'}
              placeholderTextColor={Colors.textMuted}
              style={styles.nameInput}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <Divider />

          {/* Dietary restrictions */}
          <View style={styles.fieldRow}>
            <DinText variant="label">Dietary preferences</DinText>
            <ChipSelector
              options={DIETARY_OPTIONS}
              selected={dietaryRestrictions}
              onToggle={toggleDietary}
            />
          </View>

          <Divider />

          {/* Allergies */}
          <View style={styles.fieldRow}>
            <DinText variant="label">Allergies</DinText>
            <AllergyEditor value={allergies} onChange={setAllergies} />
          </View>
        </View>

        {/* ── SECTION: YOUR GOALS ──────────────────────────── */}
        <SectionHeader label="Your goals" />

        <View style={styles.card}>
          {/* Weight goal */}
          <DinText variant="label">Goal</DinText>
          <View style={styles.goalRow}>
            {GOAL_OPTIONS.map((opt) => (
              <GoalCard
                key={opt.value}
                emoji={opt.emoji}
                label={opt.label}
                selected={weightGoal === opt.value}
                onPress={() => setWeightGoal(opt.value)}
              />
            ))}
          </View>

          <Divider />

          {/* Activity level */}
          <DinText variant="label">Activity level</DinText>
          <View style={styles.activityList}>
            {ACTIVITY_OPTIONS.map((opt) => (
              <ActivityRow
                key={opt.value}
                label={opt.label}
                desc={opt.desc}
                selected={activityLevel === opt.value}
                onPress={() => setActivityLevel(opt.value)}
              />
            ))}
          </View>

          <Divider />

          {/* Target weight */}
          <NumberInput
            label="Target weight"
            value={targetWeightStr}
            onChangeText={setTargetWeightStr}
            unit="kg"
            placeholder={profile?.target_weight_kg?.toString() ?? '70'}
            min={30}
            max={300}
          />

          {/* Preview calorie target */}
          {previewTargets && (
            <View style={styles.targetPreview}>
              <DinText variant="caption" color={Colors.textSecondary}>
                New daily target:{'  '}
              </DinText>
              <DinText style={styles.targetValue}>{previewTargets.calories} kcal</DinText>
              <DinText variant="caption" color={Colors.textMuted}>
                {'  '}P {previewTargets.protein_g}g · C {previewTargets.carbs_g}g · F {previewTargets.fat_g}g
              </DinText>
            </View>
          )}
        </View>

        {/* ── SECTION: YOUR COUPLE ─────────────────────────── */}
        <SectionHeader label="Your couple" />

        {couple ? (
          <View style={styles.card}>
            {/* Couple name */}
            <View style={styles.fieldRow}>
              <DinText variant="label">Couple name</DinText>
              <TextInput
                value={coupleName}
                onChangeText={setCoupleName}
                placeholder="e.g. Team Patel"
                placeholderTextColor={Colors.textMuted}
                style={styles.nameInput}
                autoCorrect={false}
              />
            </View>

            <Divider />

            {/* Partner card */}
            {couple.partner ? (
              <View style={styles.fieldRow}>
                <DinText variant="label">Partner</DinText>
                <View style={styles.partnerCard}>
                  <View style={styles.partnerAvatar}>
                    <DinText style={styles.partnerAvatarText}>
                      {couple.partner.display_name?.[0]?.toUpperCase() ?? '?'}
                    </DinText>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <DinText variant="body">{couple.partner.display_name}</DinText>
                    {couple.partner.dietary_restrictions?.length > 0 && (
                      <View style={styles.partnerChips}>
                        {couple.partner.dietary_restrictions.slice(0, 3).map((r) => (
                          <View key={r} style={styles.partnerChip}>
                            <DinText style={styles.partnerChipText}>
                              {r.replace(/-/g, ' ')}
                            </DinText>
                          </View>
                        ))}
                        {couple.partner.dietary_restrictions.length > 3 && (
                          <DinText variant="caption" color={Colors.textMuted}>
                            +{couple.partner.dietary_restrictions.length - 3} more
                          </DinText>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.fieldRow}>
                <DinText variant="caption" color={Colors.textSecondary}>
                  Partner hasn't set up their profile yet.
                </DinText>
              </View>
            )}

            <Divider />

            {/* Leave couple */}
            <TouchableOpacity onPress={handleLeaveCouple} style={styles.dangerBtn} activeOpacity={0.8}>
              <DinText style={styles.dangerBtnText}>Leave couple</DinText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.card, styles.noPartnerCard]}>
            <DinText style={styles.noPartnerEmoji}>💔</DinText>
            <DinText variant="body" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
              No partner linked yet. Visit the Fridge tab to send or enter an invite code.
            </DinText>
          </View>
        )}

        {/* ── SECTION: ACCOUNT ─────────────────────────────── */}
        <SectionHeader label="Account" />

        <View style={styles.card}>
          {/* Email — read-only */}
          <View style={styles.accountRow}>
            <DinText variant="caption" color={Colors.textSecondary}>Email</DinText>
            <DinText variant="body" color={Colors.textMuted} style={styles.emailText}>
              {user?.email ?? '—'}
            </DinText>
          </View>

          <Divider />

          <TouchableOpacity onPress={handleSignOut} style={styles.dangerBtn} activeOpacity={0.8}>
            <DinText style={styles.dangerBtnText}>Sign out</DinText>
          </TouchableOpacity>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <DinText variant="caption" color={Colors.error}>{error}</DinText>
          </View>
        )}

        {/* Save button */}
        <View style={styles.saveWrap}>
          <DinButton
            label="Save changes"
            onPress={handleSave}
            loading={saving}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <DinText style={styles.sectionHeader}>{label.toUpperCase()}</DinText>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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
      style={[styles.goalCard, selected && styles.goalCardSelected]}
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
        {selected && <View style={styles.activityDotFill} />}
      </View>
      <View style={{ flex: 1 }}>
        <DinText
          variant="body"
          style={selected ? { fontFamily: FontFamily.soraSemibold, color: Colors.deepGreen } : {}}
        >
          {label}
        </DinText>
        <DinText variant="caption" color={Colors.textSecondary}>{desc}</DinText>
      </View>
    </TouchableOpacity>
  );
}

function AllergyEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const t = draft.trim();
    if (t && !value.includes(t)) { onChange([...value, t]); setDraft(''); }
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.allergyInputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="e.g. Peanuts"
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={add}
          returnKeyType="done"
          style={styles.allergyTextInput}
        />
        <TouchableOpacity onPress={add} style={styles.allergyAddBtn}>
          <DinText style={styles.allergyAddBtnText}>Add</DinText>
        </TouchableOpacity>
      </View>
      {value.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {value.map((a) => (
            <TouchableOpacity
              key={a}
              onPress={() => onChange(value.filter((x) => x !== a))}
              style={styles.allergyChip}
            >
              <DinText variant="caption" color={Colors.deepGreen}>{a} ×</DinText>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.paleGoldLight },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 60, gap: Spacing.sm },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.paleGoldMedium,
  },
  headerTitle: { fontSize: 24 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 15, color: Colors.textSecondary },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.paleGoldMedium,
  },
  profileAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarInitial: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 28,
    color: Colors.gold,
  },
  profileInfo: { flex: 1, gap: 3 },
  profileName: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 20,
    color: Colors.deepGreen,
    lineHeight: 24,
  },
  providerBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.paleGoldLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  providerText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // Sign out
  signOutBtn: {
    height: 50,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 15,
    color: Colors.error,
  },

  sectionHeader: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginTop: Spacing.md,
    marginBottom: 2,
    paddingHorizontal: 2,
  },

  card: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.paleGoldLight,
  },

  fieldRow: { gap: 8 },

  nameInput: {
    fontFamily: FontFamily.sora,
    fontSize: 16,
    color: Colors.deepGreen,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.gold,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },

  // Goals
  goalRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  goalCard: {
    flex: 1,
    backgroundColor: Colors.paleGoldLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalCardSelected: {
    borderColor: Colors.deepGreen,
    backgroundColor: Colors.white,
  },
  goalEmoji: { fontSize: 24 },
  goalLabel: {
    fontFamily: FontFamily.sora,
    fontSize: 11,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
  goalLabelSelected: {
    fontFamily: FontFamily.soraSemibold,
    color: Colors.deepGreen,
  },

  // Activity
  activityList: { gap: 6, marginTop: 4 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.paleGoldLight,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  activityRowSelected: {
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
  activityDotFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.deepGreen,
  },

  // Target preview
  targetPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: Colors.paleGoldLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  targetValue: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 16,
    color: Colors.deepGreen,
  },

  // Partner
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.paleGoldLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  partnerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  partnerAvatarText: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 20,
    color: Colors.gold,
  },
  partnerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  partnerChip: {
    backgroundColor: Colors.paleGoldMedium,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  partnerChipText: {
    fontFamily: FontFamily.sora,
    fontSize: 11,
    color: Colors.textSecondary,
  },

  // No partner
  noPartnerCard: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  noPartnerEmoji: { fontSize: 36 },

  // Account
  accountRow: { gap: 4 },
  emailText: { fontSize: 15 },

  // Danger actions
  dangerBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dangerBtnText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 15,
    color: Colors.error,
  },

  // Allergies
  allergyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.paleGoldLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  allergyTextInput: {
    flex: 1,
    fontFamily: FontFamily.sora,
    fontSize: 15,
    color: Colors.deepGreen,
  },
  allergyAddBtn: {
    backgroundColor: Colors.deepGreen,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
  },
  allergyAddBtnText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 13,
    color: Colors.paleGoldLight,
  },
  allergyChip: {
    backgroundColor: Colors.paleGoldLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.gold,
  },

  // Error + save
  errorBanner: {
    padding: Spacing.sm,
    backgroundColor: '#FDECEA',
    borderRadius: BorderRadius.sm,
  },
  saveWrap: {
    marginTop: Spacing.md,
  },
});
