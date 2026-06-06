import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  FadeIn,
  FadeInDown,
  runOnJS,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@context/AuthContext';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import { CUISINES, type CuisineId } from '@hooks/useMealPlan';
import { refreshSingleMeal } from '@services/mealPlanner';
import type { MealPlan, DayPlan, SuggestedMeal } from '@services/mealPlanner';
import type { InventoryItem } from '@db/database';
import { HindiRecipeSheet } from '@components/home/HindiRecipeSheet';

const LIKED_KEY = 'liked_meals_v1';

const MEAL_COLORS = {
  breakfast: { bg: '#FFF8EE', accent: '#E8963A', label: 'Breakfast', time: '☀️' },
  lunch:     { bg: '#EFF7F2', accent: '#4A7C59', label: 'Lunch',     time: '🌤' },
  dinner:    { bg: '#F5F0FF', accent: '#7B6FA0', label: 'Dinner',    time: '🌙' },
  snack:     { bg: '#FFF0F5', accent: '#C0537A', label: 'Snack',     time: '🍎' },
} as const;

interface Props {
  plan: MealPlan | null;
  loading: boolean;
  error: string | null;
  cuisine: CuisineId;
  inventory: InventoryItem[];
  onCuisineChange: (id: CuisineId) => void;
  onRefresh: () => void;
  onUpdateMeal?: (dayIdx: number, mealIdx: number, newMeal: SuggestedMeal) => void;
}

export function MealPlanSection({ plan, loading, error, cuisine, inventory, onCuisineChange, onRefresh, onUpdateMeal }: Props) {
  const [activeDay, setActiveDay] = useState(0);
  const [likedMeals, setLikedMeals] = useState<Set<string>>(new Set());

  useEffect(() => { if (plan) setActiveDay(0); }, [plan]);

  // Load liked meals from storage
  useEffect(() => {
    AsyncStorage.getItem(LIKED_KEY)
      .then((v) => { if (v) setLikedMeals(new Set(JSON.parse(v) as string[])); })
      .catch(() => {});
  }, []);

  async function toggleLike(mealName: string) {
    setLikedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(mealName)) next.delete(mealName);
      else next.add(mealName);
      AsyncStorage.setItem(LIKED_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }

  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <View>
          <DinText variant="label">3-Day Meal Plan</DinText>
          <DinText variant="caption" color={Colors.textMuted}>
            Personalised for your goals
          </DinText>
        </View>
        <TouchableOpacity
          onPress={onRefresh}
          disabled={loading}
          style={styles.refreshBtn}
          activeOpacity={0.75}
        >
          {loading
            ? <ActivityIndicator size="small" color={Colors.deepGreen} />
            : <DinText style={styles.refreshLabel}>✨ New ideas</DinText>
          }
        </TouchableOpacity>
      </View>

      {/* Cuisine chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cuisineRow}
      >
        {CUISINES.map((c) => (
          <TouchableOpacity
            key={c.id}
            onPress={() => onCuisineChange(c.id)}
            style={[styles.cuisineChip, cuisine === c.id && styles.cuisineChipActive]}
            activeOpacity={0.75}
          >
            <DinText style={styles.cuisineEmoji}>{c.emoji}</DinText>
            <DinText style={[styles.cuisineLabel, cuisine === c.id && styles.cuisineLabelActive]}>
              {c.label}
            </DinText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Day pill tabs */}
      {plan && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayTabs}>
          {plan.days.map((day, i) => (
            <TouchableOpacity
              key={day.date}
              onPress={() => setActiveDay(i)}
              style={[styles.dayTab, activeDay === i && styles.dayTabActive]}
              activeOpacity={0.8}
            >
              <DinText style={[styles.dayTabLabel, activeDay === i && styles.dayTabLabelActive]}>
                {day.label}
              </DinText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Content */}
      {loading && !plan && <SkeletonPlan />}
      {error && !plan && <ErrorState onRetry={onRefresh} />}
      {plan && (
        <DayMeals
          key={`${activeDay}-${cuisine}`}
          day={plan.days[activeDay]}
          dayIndex={activeDay}
          cuisine={cuisine}
          inventory={inventory}
          likedMeals={likedMeals}
          onToggleLike={toggleLike}
          onMealReplaced={(mealIdx, newMeal) => onUpdateMeal?.(activeDay, mealIdx, newMeal)}
        />
      )}
    </View>
  );
}

// ─── Day meals ───────────────────────────────────────────────

function DayMeals({
  day, dayIndex, cuisine, inventory, likedMeals, onToggleLike, onMealReplaced,
}: {
  day: DayPlan;
  dayIndex: number;
  cuisine: CuisineId;
  inventory: InventoryItem[];
  likedMeals: Set<string>;
  onToggleLike: (name: string) => void;
  onMealReplaced?: (mealIdx: number, newMeal: SuggestedMeal) => void;
}) {
  const { profile } = useAuth();

  // Local mutable copy of meals so replacements work without touching the cached plan
  const [meals,        setMeals]        = useState<SuggestedMeal[]>(day.meals);
  const [refreshingIdx, setRefreshingIdx] = useState<number | null>(null);
  const [hindiMeal,    setHindiMeal]    = useState<SuggestedMeal | null>(null);

  // Sync when day changes
  useEffect(() => { setMeals(day.meals); }, [day]);

  const replaceMeal = useCallback(async (idx: number) => {
    if (!profile) return;
    setRefreshingIdx(idx);
    try {
      const exclude = meals.map((m) => m.name);
      const newMeal = await refreshSingleMeal({
        profile,
        inventory,
        mealType: meals[idx].type,
        cuisine,
        exclude,
      });
      setMeals((prev) => {
        const next = [...prev];
        next[idx] = newMeal;
        return next;
      });
      // Persist + sync to partner
      onMealReplaced?.(idx, newMeal);
    } catch {
      Alert.alert('Could not refresh', 'Please try again.');
    } finally {
      setRefreshingIdx(null);
    }
  }, [profile, inventory, cuisine, meals]);

  // Meals that need day-before prep
  const prepMeals = meals.filter((m) => m.prepNote && m.prepNote.trim().length > 0);

  function sendPrepToWhatsApp() {
    const lines = [`📋 *${day.label}'s Prep — Send to Cook*`, ''];
    prepMeals.forEach((m) => {
      lines.push(`${MEAL_COLORS[m.type]?.time ?? '🍽'} *${m.name}:*`);
      lines.push(`   ${m.prepNote}`);
      lines.push('');
    });
    lines.push('Please prepare in advance. Thank you! 🙏');
    lines.push('_Sent via Dindin_');
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
    require('react-native').Linking.openURL(url).catch(() => {});
  }

  return (
    <>
      {/* Day-before prep banner */}
      {prepMeals.length > 0 && (
        <View style={styles.prepBanner}>
          <View style={{ flex: 1 }}>
            <DinText style={styles.prepBannerTitle}>⚠️ Advance prep needed</DinText>
            {prepMeals.map((m) => (
              <DinText key={m.name} style={styles.prepBannerItem}>
                {`• ${m.name}: ${m.prepNote}`}
              </DinText>
            ))}
          </View>
          <TouchableOpacity onPress={sendPrepToWhatsApp} style={styles.prepSendBtn}>
            <DinText style={styles.prepSendLabel}>📲 Send</DinText>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.mealList}>
        {meals.map((meal, i) => (
          <Animated.View key={`${meal.name}-${i}`} entering={FadeInDown.delay(i * 80).springify()}>
            <MealCard
              meal={meal}
              liked={likedMeals.has(meal.name)}
              refreshing={refreshingIdx === i}
              onLike={() => onToggleLike(meal.name)}
              onRefresh={() => replaceMeal(i)}
              onHindi={() => setHindiMeal(meal)}
            />
          </Animated.View>
        ))}
      </View>

      {/* Hindi recipe sheet */}
      <HindiRecipeSheet
        meal={hindiMeal}
        onClose={() => setHindiMeal(null)}
      />
    </>
  );
}

// ─── Meal card with swipe + heart ────────────────────────────

function MealCard({
  meal, liked, refreshing, onLike, onRefresh, onHindi,
}: {
  meal: SuggestedMeal;
  liked: boolean;
  refreshing: boolean;
  onLike: () => void;
  onRefresh: () => void;
  onHindi: () => void;
}) {
  const [expanded,      setExpanded]      = useState(false);
  const [localHave,     setLocalHave]     = useState<string[]>(meal.have);
  const [localMissing,  setLocalMissing]  = useState<string[]>(meal.missing);
  const [newlyMoved,    setNewlyMoved]    = useState<Set<string>>(new Set());
  const theme = MEAL_COLORS[meal.type] ?? MEAL_COLORS.dinner;

  const translateX  = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  // Animation + full reset when meal is replaced (↺)
  useEffect(() => {
    translateX.value = withSpring(0, { damping: 20 });
    cardOpacity.value = withSpring(1);
    setExpanded(false);
    setLocalHave(meal.have);
    setLocalMissing(meal.missing);
    setNewlyMoved(new Set());
  }, [meal.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Data sync when have/missing change without the meal name changing
  // (e.g. pantry stock update syncs back to the plan cache)
  useEffect(() => {
    setLocalHave(meal.have);
    setLocalMissing(meal.missing);
  }, [meal.have.join('|'), meal.missing.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  function moveToHave(ingredient: string) {
    setLocalMissing((prev) => prev.filter((i) => i !== ingredient));
    setLocalHave((prev) => [...prev, ingredient]);
    setNewlyMoved((prev) => new Set([...prev, ingredient]));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  function triggerRefresh() {
    onRefresh();
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -90) {
        // Swipe left → fly out, then refresh
        translateX.value = withTiming(-500, { duration: 220 });
        cardOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(triggerRefresh)();
      } else {
        translateX.value = withSpring(0, { damping: 20 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${translateX.value * 0.025}deg` },
    ],
    opacity: cardOpacity.value,
  }));

  // Behind-card swipe indicator
  const swipeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -translateX.value / 80)),
  }));

  if (refreshing) return <SkeletonMealCard accent={theme.accent} />;

  return (
    <View>
      {/* Swipe-left indicator shown behind the card */}
      <Animated.View style={[styles.swipeIndicator, swipeIndicatorStyle]}>
        <View style={styles.swipeIndicatorPill}>
          <DinText style={styles.swipeIndicatorIcon}>↺</DinText>
          <DinText style={styles.swipeIndicatorText}>Try another</DinText>
        </View>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, { backgroundColor: theme.bg }, cardStyle]}>
          {/* Top row */}
          <View style={styles.cardTopRow}>
            <View style={[styles.typeChip, { backgroundColor: theme.accent }]}>
              <DinText style={styles.typeChipText}>{`${theme.time} ${theme.label}`}</DinText>
            </View>
            <View style={styles.cardTopRight}>
              <DinText style={[styles.calorieBadge, { color: theme.accent }]}>
                {`~${meal.calories} kcal`}
              </DinText>
              {/* Heart button */}
              <TouchableOpacity onPress={onLike} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <DinText style={styles.heartIcon}>{liked ? '❤️' : '🤍'}</DinText>
              </TouchableOpacity>
              {/* WhatsApp quick-share → opens full recipe sheet */}
              <TouchableOpacity onPress={onHindi} style={styles.waQuickBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <DinText style={styles.waQuickBtnText}>W</DinText>
              </TouchableOpacity>
              {/* Refresh button */}
              <TouchableOpacity onPress={onRefresh} style={styles.cardRefreshBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <DinText style={styles.cardRefreshBtnIcon}>↺</DinText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Emoji + name */}
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setExpanded((v) => !v)}
            style={styles.cardBody}
          >
            <DinText style={styles.mealEmoji}>{meal.emoji}</DinText>
            <View style={styles.cardText}>
              <DinText style={styles.mealName}>{meal.name}</DinText>
              <DinText style={styles.mealTip} color={Colors.textSecondary}>{meal.tip}</DinText>
            </View>
          </TouchableOpacity>

          {/* Prep note inline */}
          {meal.prepNote ? (
            <View style={styles.prepInline}>
              <DinText style={styles.prepInlineText}>⚠️  {meal.prepNote}</DinText>
            </View>
          ) : (
            <View style={styles.swipeHintRow}>
              <DinText style={styles.swipeHint}>← swipe left or tap ↺ for a different idea</DinText>
            </View>
          )}

          {/* Missing ingredients teaser */}
          {localMissing.length > 0 && (
            <TouchableOpacity
              style={styles.missingTeaser}
              onPress={() => setExpanded((v) => !v)}
              activeOpacity={0.85}
            >
              <DinText style={styles.missingTeaserText}>
                {`🛒 ${localMissing.length} ingredient${localMissing.length > 1 ? 's' : ''} to buy`}
              </DinText>
              <DinText style={[styles.expandChevron, { color: theme.accent }]}>
                {expanded ? '▲' : '▼'}
              </DinText>
            </TouchableOpacity>
          )}

          {/* Expanded: have + missing */}
          {expanded && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.expandedSection}>
              <View style={styles.divider} />
              {localHave.length > 0 && (
                <View style={styles.ingredientRow}>
                  <DinText style={styles.ingredientGroupLabel}>✅ On hand</DinText>
                  <View style={styles.chipRow}>
                    {localHave.map((ing) => (
                      <HaveChip key={ing} name={ing} isNew={newlyMoved.has(ing)} />
                    ))}
                  </View>
                </View>
              )}
              {localMissing.length > 0 && (
                <View style={styles.ingredientRow}>
                  <View style={styles.ingredientLabelRow}>
                    <DinText style={styles.ingredientGroupLabel}>🛒 To buy</DinText>
                    <DinText style={styles.swipeUpHint}>swipe up ↑ once bought</DinText>
                  </View>
                  <View style={styles.chipRow}>
                    {localMissing.map((ing) => (
                      <MissingIngredientChip
                        key={ing}
                        name={ing}
                        color={theme.accent}
                        onMoveToHave={() => moveToHave(ing)}
                      />
                    ))}
                  </View>
                </View>
              )}
            </Animated.View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ─── Have chip (with flash animation when newly moved) ───────

function HaveChip({ name, isNew }: { name: string; isNew: boolean }) {
  const flash = useSharedValue(isNew ? 1 : 0);

  useEffect(() => {
    if (isNew) {
      flash.value = withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(0, { duration: 900 }),
      );
    }
  }, [isNew]);

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(flash.value, [0, 1], ['#E8F5EE', '#B8F0CC']),
  }));

  return (
    <Animated.View
      style={[styles.haveChip, chipStyle]}
      entering={isNew ? FadeInDown.springify().damping(11).stiffness(180) : undefined}
    >
      <DinText style={styles.haveChipText}>{name}</DinText>
      {isNew && <DinText style={styles.haveChipTick}> ✓</DinText>}
    </Animated.View>
  );
}

// ─── Missing chip (swipe up to move to On Hand) ───────────────

function MissingIngredientChip({
  name, color, onMoveToHave,
}: {
  name: string;
  color: string;
  onMoveToHave: () => void;
}) {
  const translateY = useSharedValue(0);
  const opacity    = useSharedValue(1);
  const scale      = useSharedValue(1);

  const gesture = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      if (e.translationY < 0) {
        translateY.value = e.translationY;
        opacity.value    = Math.max(0, 1 + e.translationY / 50);
        scale.value      = 1 + e.translationY * -0.004;
      }
    })
    .onEnd((e) => {
      if (e.translationY < -40) {
        translateY.value = withTiming(-130, { duration: 220 });
        opacity.value    = withTiming(0,    { duration: 180 });
        scale.value      = withTiming(0.4,  { duration: 200 });
        runOnJS(onMoveToHave)();
      } else {
        translateY.value = withSpring(0, { damping: 18 });
        opacity.value    = withSpring(1);
        scale.value      = withSpring(1);
      }
    });

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.missingChip, { borderColor: color }, chipStyle]}>
        <DinText style={[styles.missingChipText, { color }]}>{name}</DinText>
        <DinText style={[styles.chipUpArrow, { color }]}>↑</DinText>
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Skeleton ────────────────────────────────────────────────

function SkeletonMealCard({ accent = Colors.paleGoldLight }: { accent?: string }) {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 600 }), withTiming(0.4, { duration: 600 })),
      -1, true,
    );
  }, []);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.skeletonCard, { borderLeftColor: accent, borderLeftWidth: 3 }, pulse]}>
      <View style={styles.skeletonChip} />
      <View style={styles.skeletonRow}>
        <View style={styles.skeletonEmoji} />
        <View style={styles.skeletonLines}>
          <View style={styles.skeletonLine} />
          <View style={[styles.skeletonLine, { width: '55%' }]} />
        </View>
      </View>
    </Animated.View>
  );
}

function SkeletonPlan() {
  return (
    <View style={styles.mealList}>
      {[0, 1, 2].map((i) => <SkeletonMealCard key={i} />)}
    </View>
  );
}

// ─── Error state ──────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorWrap}>
      <DinText style={styles.errorEmoji}>🤔</DinText>
      <DinText variant="body" style={{ textAlign: 'center' }}>Couldn't generate your plan</DinText>
      <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
        <DinText style={styles.retryLabel}>Try again</DinText>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  refreshBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full, minWidth: 44, alignItems: 'center',
  },
  refreshLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 12, color: Colors.deepGreen },

  // Cuisine
  cuisineRow: { gap: 6, paddingVertical: 2 },
  cuisineChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: BorderRadius.full, backgroundColor: Colors.paleGoldMedium,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  cuisineChipActive: { backgroundColor: Colors.deepGreen, borderColor: Colors.deepGreen },
  cuisineEmoji: { fontSize: 14 },
  cuisineLabel: { fontFamily: FontFamily.sora, fontSize: 12, color: Colors.textSecondary },
  cuisineLabelActive: { fontFamily: FontFamily.soraSemibold, color: Colors.paleGoldLight },

  // Day tabs
  dayTabs: { gap: 8, paddingVertical: 2 },
  dayTab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.paleGoldMedium },
  dayTabActive: { backgroundColor: Colors.deepGreen },
  dayTabLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.textSecondary },
  dayTabLabelActive: { color: Colors.paleGoldLight },

  // Meal list
  mealList: { gap: 10 },

  // Behind-card swipe indicator
  swipeIndicator: {
    position: 'absolute', right: 12, top: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'flex-end',
  },
  swipeIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.deepGreen,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  swipeIndicatorIcon: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 16,
    color: Colors.gold,
    lineHeight: 20,
  },
  swipeIndicatorText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 12,
    color: Colors.paleGoldLight,
  },

  // Card
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 8 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  typeChipText: { fontFamily: FontFamily.soraSemibold, fontSize: 11, color: '#fff' },
  calorieBadge: { fontFamily: FontFamily.soraSemibold, fontSize: 12 },
  heartIcon: { fontSize: 18 },
  waQuickBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#25D366',
    alignItems: 'center', justifyContent: 'center',
  },
  waQuickBtnText: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 13, color: '#fff', lineHeight: 18,
  },

  prepInline: {
    backgroundColor: '#FFF8E1', borderRadius: BorderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 6,
    borderLeftWidth: 2, borderLeftColor: '#C07C00',
  },
  prepInlineText: {
    fontFamily: FontFamily.sora, fontSize: 11,
    color: '#7A4E00', lineHeight: 16,
  },

  // Prep banner above meal list
  prepBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF8E1', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 4,
    borderLeftWidth: 3, borderLeftColor: '#C07C00',
  },
  prepBannerTitle: {
    fontFamily: FontFamily.soraSemibold, fontSize: 13,
    color: '#7A4E00', marginBottom: 4,
  },
  prepBannerItem: {
    fontFamily: FontFamily.sora, fontSize: 12,
    color: '#7A4E00', lineHeight: 18,
  },
  prepSendBtn: {
    backgroundColor: '#25D366', borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start',
  },
  prepSendLabel: {
    fontFamily: FontFamily.soraSemibold, fontSize: 12, color: '#fff',
  },

  cardRefreshBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRefreshBtnIcon: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 16,
    color: Colors.deepGreen,
    lineHeight: 20,
  },

  cardBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  mealEmoji: { fontSize: 44 },
  cardText: { flex: 1, gap: 3 },
  mealName: { fontFamily: FontFamily.frauncesBold, fontSize: 17, color: Colors.deepGreen, lineHeight: 22 },
  mealTip: { fontFamily: FontFamily.sora, fontSize: 12, lineHeight: 17 },

  swipeHintRow: { alignItems: 'center' },
  swipeHint: { fontFamily: FontFamily.sora, fontSize: 10, color: Colors.textMuted, letterSpacing: 0.2 },

  missingTeaser: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: BorderRadius.sm,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  missingTeaserText: { fontFamily: FontFamily.sora, fontSize: 12, color: Colors.textSecondary },
  expandChevron: { fontSize: 10, fontFamily: FontFamily.soraSemibold },

  expandedSection: { gap: 10 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)' },
  ingredientRow: { gap: 6 },
  ingredientGroupLabel: {
    fontFamily: FontFamily.soraSemibold, fontSize: 11, color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ingredientLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  swipeUpHint: {
    fontFamily: FontFamily.sora,
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  haveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  haveChipText: { fontFamily: FontFamily.sora, fontSize: 12, color: '#2D7A50' },
  haveChipTick: { fontFamily: FontFamily.soraSemibold, fontSize: 12, color: '#27AE60' },
  missingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1.5,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  missingChipText: { fontFamily: FontFamily.soraSemibold, fontSize: 12 },
  chipUpArrow: { fontFamily: FontFamily.soraSemibold, fontSize: 11, opacity: 0.7 },

  // Skeleton
  skeletonCard: { backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 12 },
  skeletonChip: { width: 90, height: 22, borderRadius: BorderRadius.full, backgroundColor: Colors.paleGoldLight },
  skeletonRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  skeletonEmoji: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.paleGoldLight },
  skeletonLines: { flex: 1, gap: 8 },
  skeletonLine: { height: 14, borderRadius: 7, backgroundColor: Colors.paleGoldLight, width: '80%' },

  // Error
  errorWrap: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  errorEmoji: { fontSize: 40 },
  retryBtn: { backgroundColor: Colors.deepGreen, paddingHorizontal: Spacing.lg, paddingVertical: 10, borderRadius: BorderRadius.full },
  retryLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 14, color: Colors.paleGoldLight },
});
