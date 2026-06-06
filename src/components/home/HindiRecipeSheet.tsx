import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Speech from 'expo-speech';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import { translateMealToHindi, type HindiRecipe } from '@services/hindiTranslation';
import type { SuggestedMeal } from '@services/mealPlanner';

interface Props {
  meal: SuggestedMeal | null;
  onClose: () => void;
}

export function HindiRecipeSheet({ meal, onClose }: Props) {
  const [recipe,    setRecipe]    = useState<HindiRecipe | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [speaking,  setSpeaking]  = useState(false);
  const [showHindi, setShowHindi] = useState(false); // English first by default

  const translateY = useSharedValue(600);
  const backdropOp = useSharedValue(0);
  const visible = meal !== null;

  useEffect(() => {
    if (visible) {
      backdropOp.value = withTiming(1, { duration: 260 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
      setShowHindi(false);
      loadTranslation(meal!);
    } else {
      backdropOp.value = withTiming(0, { duration: 200 });
      translateY.value = withSpring(600, { damping: 20 });
      Speech.stop();
      setRecipe(null);
      setSpeaking(false);
      setError(null);
    }
  }, [visible]);

  async function loadTranslation(m: SuggestedMeal) {
    setLoading(true);
    setError(null);
    try {
      setRecipe(await translateMealToHindi(m));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed');
    } finally {
      setLoading(false);
    }
  }

  async function toggleSpeak() {
    if (speaking) { await Speech.stop(); setSpeaking(false); return; }
    if (!recipe) return;

    const steps = showHindi ? recipe.steps : recipe.stepsEnglish;
    const intro = showHindi
      ? `${recipe.nameHindi} बनाने की विधि`
      : `How to make ${meal?.name}`;
    const text = [intro, ...steps.map((s, i) => `Step ${i + 1}. ${s}`)].join('. ');

    setSpeaking(true);
    Speech.speak(text, {
      language: showHindi ? 'hi-IN' : 'en-IN',
      rate: 0.85,
      onDone:  () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }

  function buildWhatsAppMessage(hindi: boolean): string {
    if (!recipe || !meal) return '';
    const lines: string[] = [];

    if (hindi) {
      lines.push(`👨‍🍳 *${recipe.nameHindi}* (${meal.name})`, '');
      lines.push('*सामग्री:*');
      recipe.ingredientsHindi.forEach((ing, i) => lines.push(`${i + 1}. ${ing}`));
      lines.push('', '*बनाने की विधि:*');
      recipe.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    } else {
      lines.push(`👨‍🍳 *${meal.name}*`, '');
      lines.push('*Ingredients:*');
      [...meal.have, ...meal.missing].forEach((ing) => lines.push(`• ${ing}`));
      lines.push('', '*How to make:*');
      recipe.stepsEnglish.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }

    if (meal.prepNote) {
      lines.push('', `⚠️ *Advance prep:* ${meal.prepNote}`);
    }
    lines.push('', '_Sent via Dindin 🍽_');
    return lines.join('\n');
  }

  function sendToWhatsApp(hindi: boolean) {
    const text = buildWhatsAppMessage(hindi);
    if (!text) return;
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`)
      .catch(() => {});
  }

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOp.value }));
  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!visible) return null;

  const displaySteps = showHindi ? (recipe?.steps ?? []) : (recipe?.stepsEnglish ?? []);
  const displayIngredients = showHindi
    ? (recipe?.ingredientsHindi ?? [])
    : [...(meal?.have ?? []), ...(meal?.missing ?? [])];

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <DinText style={styles.headerMeta}>Recipe · Instructions</DinText>
            <DinText style={styles.mealName}>{meal?.name}</DinText>
            {showHindi && recipe && (
              <DinText style={styles.nameHindi}>{recipe.nameHindi}</DinText>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <DinText style={styles.closeBtnText}>✕</DinText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.deepGreen} size="large" />
            <DinText variant="caption" color={Colors.textSecondary}>
              Preparing recipe…
            </DinText>
          </View>
        ) : error ? (
          <View style={styles.errorWrap}>
            <DinText style={{ color: Colors.error, textAlign: 'center' }}>{error}</DinText>
            {meal && (
              <TouchableOpacity onPress={() => loadTranslation(meal)} style={styles.retryBtn}>
                <DinText style={styles.retryLabel}>Try again</DinText>
              </TouchableOpacity>
            )}
          </View>
        ) : recipe ? (
          <>
            {/* Language + action bar */}
            <View style={styles.actionBar}>
              {/* Language toggle */}
              <View style={styles.langToggle}>
                <TouchableOpacity
                  onPress={() => { setShowHindi(false); Speech.stop(); setSpeaking(false); }}
                  style={[styles.langBtn, !showHindi && styles.langBtnActive]}
                >
                  <DinText style={[styles.langLabel, !showHindi && styles.langLabelActive]}>EN</DinText>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setShowHindi(true); Speech.stop(); setSpeaking(false); }}
                  style={[styles.langBtn, showHindi && styles.langBtnActive]}
                >
                  <DinText style={[styles.langLabel, showHindi && styles.langLabelActive]}>🇮🇳 HI</DinText>
                </TouchableOpacity>
              </View>

              {/* Voice button */}
              <TouchableOpacity
                onPress={toggleSpeak}
                style={[styles.iconBtn, speaking && styles.iconBtnActive]}
              >
                <DinText style={styles.iconBtnText}>{speaking ? '⏹' : '🔊'}</DinText>
              </TouchableOpacity>
            </View>

            {/* Recipe content */}
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <DinText style={styles.sectionTitle}>
                {showHindi ? '🧂 सामग्री' : '🧂 Ingredients'}
              </DinText>
              <View style={styles.ingredientList}>
                {displayIngredients.map((ing, i) => (
                  <View key={i} style={styles.ingredientRow}>
                    <View style={styles.dot} />
                    <DinText style={styles.ingredientText}>{ing}</DinText>
                  </View>
                ))}
              </View>

              <DinText style={styles.sectionTitle}>
                {showHindi ? '📋 बनाने की विधि' : '📋 How to make'}
              </DinText>
              {displaySteps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <DinText style={styles.stepNumText}>{i + 1}</DinText>
                  </View>
                  <DinText style={styles.stepText}>{step}</DinText>
                </View>
              ))}

              {meal?.prepNote ? (
                <View style={styles.prepNote}>
                  <DinText style={styles.prepNoteTitle}>⚠️ Advance prep</DinText>
                  <DinText style={styles.prepNoteText}>{meal.prepNote}</DinText>
                </View>
              ) : null}

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Send buttons */}
            <View style={styles.sendRow}>
              <TouchableOpacity
                style={styles.sendBtnEn}
                onPress={() => sendToWhatsApp(false)}
                activeOpacity={0.85}
              >
                <DinText style={styles.sendBtnLabel}>📲  Send in English</DinText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendBtnHi}
                onPress={() => sendToWhatsApp(true)}
                activeOpacity={0.85}
              >
                <DinText style={styles.sendBtnLabel}>📲  हिंदी में भेजें</DinText>
              </TouchableOpacity>
            </View>
          </>
        ) : null}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(45,58,31,0.5)', zIndex: 40 },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 41,
    backgroundColor: Colors.paleGoldLight,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '88%', paddingHorizontal: Spacing.lg,
    paddingBottom: 0,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.paleGoldMedium,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: Spacing.sm, marginBottom: Spacing.md,
  },
  headerMeta: {
    fontFamily: FontFamily.sora, fontSize: 11,
    color: Colors.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  mealName: {
    fontFamily: FontFamily.frauncesBold, fontSize: 20,
    color: Colors.deepGreen, lineHeight: 26,
  },
  nameHindi: {
    fontFamily: FontFamily.sora, fontSize: 15,
    color: Colors.textSecondary, marginTop: 2,
  },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  closeBtnText: { fontSize: 12, color: Colors.textSecondary },

  // Action bar: language + voice
  actionBar: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: Spacing.md,
  },
  langToggle: {
    flex: 1, flexDirection: 'row', backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full, padding: 3, gap: 3,
  },
  langBtn: {
    flex: 1, paddingVertical: 7, borderRadius: BorderRadius.full, alignItems: 'center',
  },
  langBtnActive: { backgroundColor: Colors.deepGreen },
  langLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 12, color: Colors.textSecondary },
  langLabelActive: { color: Colors.paleGoldLight },

  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: Colors.deepGreen },
  iconBtnText: { fontSize: 18 },

  scroll: { flex: 1 },
  sectionTitle: {
    fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.deepGreen,
    marginTop: Spacing.sm, marginBottom: 8,
  },
  ingredientList: { gap: 5, marginBottom: Spacing.sm },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold, flexShrink: 0 },
  ingredientText: { fontFamily: FontFamily.sora, fontSize: 13, color: Colors.textPrimary, flex: 1 },

  stepRow: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 7,
  },
  stepNum: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.deepGreen,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  stepNumText: { fontFamily: FontFamily.frauncesBold, fontSize: 11, color: Colors.gold },
  stepText: { fontFamily: FontFamily.sora, fontSize: 13, color: Colors.textPrimary, flex: 1, lineHeight: 20 },

  prepNote: {
    backgroundColor: '#FFF8E1', borderRadius: BorderRadius.md, padding: Spacing.md,
    borderLeftWidth: 3, borderLeftColor: '#C07C00', marginTop: Spacing.sm,
  },
  prepNoteTitle: { fontFamily: FontFamily.soraSemibold, fontSize: 12, color: '#7A4E00', marginBottom: 3 },
  prepNoteText: { fontFamily: FontFamily.sora, fontSize: 12, color: '#7A4E00', lineHeight: 18 },

  // Send buttons
  sendRow: {
    flexDirection: 'row', gap: 8,
    paddingVertical: Spacing.md,
    paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: Colors.paleGoldMedium,
  },
  sendBtnEn: {
    flex: 1, backgroundColor: '#25D366', borderRadius: BorderRadius.full,
    paddingVertical: 12, alignItems: 'center',
  },
  sendBtnHi: {
    flex: 1, backgroundColor: Colors.deepGreen, borderRadius: BorderRadius.full,
    paddingVertical: 12, alignItems: 'center',
  },
  sendBtnLabel: {
    fontFamily: FontFamily.soraSemibold, fontSize: 13, color: '#fff',
  },

  loadingWrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  errorWrap: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.lg },
  retryBtn: {
    backgroundColor: Colors.deepGreen, paddingHorizontal: Spacing.lg,
    paddingVertical: 10, borderRadius: BorderRadius.full,
  },
  retryLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 14, color: Colors.paleGoldLight },
});
