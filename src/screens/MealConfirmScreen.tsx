import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Linking,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { MacroEditor, type EditableMacros } from '@components/camera/MacroEditor';
import { RecipeVideoPicker } from '@components/camera/RecipeVideoPicker';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import { searchRecipeVideos, formatWhatsAppMessage, type YouTubeVideo } from '@services/youtube';
import type { AiMealAnalysis, MealSource } from '@db/database';

interface MealConfirmScreenProps {
  imageUri: string;
  analysis: AiMealAnalysis;
  onSaved: () => void;
  onCancel: () => void;
}

const MEAL_SOURCES: Array<{ value: MealSource; label: string; icon: string }> = [
  { value: 'home_cooked', label: 'Home cooked', icon: '🏠' },
  { value: 'restaurant', label: 'Restaurant', icon: '🍴' },
  { value: 'delivery', label: 'Delivery', icon: '🛵' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export function MealConfirmScreen({ imageUri, analysis, onSaved, onCancel }: MealConfirmScreenProps) {
  const { user } = useAuth();

  const [macros, setMacros] = useState<EditableMacros | null>(null);
  const [mealSource, setMealSource] = useState<MealSource>('home_cooked');
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [saving, setSaving] = useState(false);

  // Success animation
  const checkScale = useSharedValue(0);
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const effectiveMacros = macros ?? {
    dishName: analysis.dish_name ?? '',
    calories: String(Math.round(analysis.calories ?? 0)),
    proteinG: String(Math.round(analysis.protein_g ?? 0)),
    carbsG: String(Math.round(analysis.carbs_g ?? 0)),
    fatG: String(Math.round(analysis.fat_g ?? 0)),
    fiberG: String(Math.round(analysis.fiber_g ?? 0)),
    servingSize: analysis.serving_size ?? '1 serving',
    mealType: 'lunch' as const,
    numServings: '1',
  };

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    try {
      // Upload image to Supabase Storage if configured
      // (Placeholder — in production, upload to storage bucket first)
      const photoUrl = imageUri; // use local URI as placeholder

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('meal_logs').insert({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        meal_type: effectiveMacros.mealType,
        meal_source: mealSource,
        dish_name: effectiveMacros.dishName || null,
        photo_url: photoUrl,
        ai_raw_response: analysis,
        calories: parseFloat(effectiveMacros.calories) || null,
        protein_g: parseFloat(effectiveMacros.proteinG) || null,
        carbs_g: parseFloat(effectiveMacros.carbsG) || null,
        fat_g: parseFloat(effectiveMacros.fatG) || null,
        fiber_g: parseFloat(effectiveMacros.fiberG) || null,
        serving_size: effectiveMacros.servingSize || null,
        num_servings: parseFloat(effectiveMacros.numServings) || 1,
        is_shared: true,
        is_verified: true,
        youtube_video_id: selectedVideo?.videoId ?? null,
        youtube_title: selectedVideo?.title ?? null,
      });

      if (error) throw error;

      // Update daily summary
      await upsertDailySummary(user.id, {
        calories: parseFloat(effectiveMacros.calories) || 0,
        protein_g: parseFloat(effectiveMacros.proteinG) || 0,
        carbs_g: parseFloat(effectiveMacros.carbsG) || 0,
        fat_g: parseFloat(effectiveMacros.fatG) || 0,
        thumbnailUrl: photoUrl,
      });

      // Animate success
      checkScale.value = withSpring(1, { damping: 12, stiffness: 180 });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise((r) => setTimeout(r, 800));
      onSaved();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleShareWhatsApp() {
    if (!selectedVideo) {
      Alert.alert('Select a recipe video first to share via WhatsApp.');
      return;
    }
    const msg = formatWhatsAppMessage({
      dishName: effectiveMacros.dishName,
      calories: parseFloat(effectiveMacros.calories) || 0,
      proteinG: parseFloat(effectiveMacros.proteinG) || 0,
      carbsG: parseFloat(effectiveMacros.carbsG) || 0,
      fatG: parseFloat(effectiveMacros.fatG) || 0,
      youtubeVideoId: selectedVideo.videoId,
      youtubeTitle: selectedVideo.title,
    });
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not installed', 'Please install WhatsApp to share.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <DinText style={styles.backArrow}>←</DinText>
        </TouchableOpacity>
        <DinText variant="subheading">Confirm meal</DinText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Photo */}
        <View style={styles.photoWrap}>
          <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
          {/* Success overlay */}
          <Animated.View style={[styles.successOverlay, checkStyle]}>
            <DinText style={styles.checkEmoji}>✓</DinText>
          </Animated.View>
        </View>

        {/* Meal source */}
        <View style={styles.section}>
          <DinText variant="label">Where did you eat?</DinText>
          <View style={styles.sourceRow}>
            {MEAL_SOURCES.map((s) => (
              <TouchableOpacity
                key={s.value}
                onPress={() => setMealSource(s.value)}
                style={[styles.sourceChip, mealSource === s.value && styles.sourceChipActive]}
              >
                <DinText style={styles.sourceIcon}>{s.icon}</DinText>
                <DinText
                  variant="caption"
                  color={mealSource === s.value ? Colors.paleGoldLight : Colors.textSecondary}
                >
                  {s.label}
                </DinText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Macro editor */}
        <View style={styles.section}>
          <DinText variant="label" style={styles.sectionTitle}>Nutrition details</DinText>
          <MacroEditor analysis={analysis} onChange={setMacros} />
        </View>

        {/* YouTube recipe picker */}
        {effectiveMacros.dishName.length > 2 && (
          <View style={styles.section}>
            <RecipeVideoPicker
              dishName={effectiveMacros.dishName}
              selectedVideoId={selectedVideo?.videoId ?? null}
              onSelect={setSelectedVideo}
            />
          </View>
        )}

        {/* WhatsApp share */}
        {selectedVideo && (
          <TouchableOpacity onPress={handleShareWhatsApp} style={styles.waBtn}>
            <DinText style={styles.waBtnText}>📲 Share recipe via WhatsApp</DinText>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <DinButton
          label="Log this meal"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

async function upsertDailySummary(userId: string, data: {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  thumbnailUrl: string;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('daily_summaries')
    .select('*')
    .eq('user_id', userId)
    .eq('summary_date', today)
    .single() as { data: { total_calories_eaten: number; total_protein_g: number; total_carbs_g: number; total_fat_g: number; meal_count: number } | null };

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('daily_summaries').update({
      total_calories_eaten: (existing.total_calories_eaten || 0) + data.calories,
      total_protein_g: (existing.total_protein_g || 0) + data.protein_g,
      total_carbs_g: (existing.total_carbs_g || 0) + data.carbs_g,
      total_fat_g: (existing.total_fat_g || 0) + data.fat_g,
      meal_count: (existing.meal_count || 0) + 1,
      thumbnail_url: data.thumbnailUrl,
    }).eq('user_id', userId).eq('summary_date', today);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('daily_summaries').insert({
      user_id: userId,
      summary_date: today,
      total_calories_eaten: data.calories,
      total_protein_g: data.protein_g,
      total_carbs_g: data.carbs_g,
      total_fat_g: data.fat_g,
      meal_count: 1,
      thumbnail_url: data.thumbnailUrl,
      has_weight_log: false,
      has_fridge_photo: false,
      streak_active: false,
    });
  }
}

// ─── Styles ──────────────────────────────────────────────────

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
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100, gap: Spacing.lg },
  photoWrap: {
    height: 220,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: { width: '100%', height: '100%' },
  successOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(45,58,31,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkEmoji: {
    fontSize: 60,
    color: Colors.paleGoldLight,
  },
  section: { gap: Spacing.sm },
  sectionTitle: { marginBottom: 4 },
  sourceRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  sourceChipActive: {
    backgroundColor: Colors.deepGreen,
    borderColor: Colors.deepGreen,
  },
  sourceIcon: { fontSize: 16 },
  waBtn: {
    backgroundColor: '#25D366',
    borderRadius: BorderRadius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  waBtnText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 15,
    color: '#fff',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
});
