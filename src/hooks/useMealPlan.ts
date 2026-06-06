import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { useInventory } from '@hooks/useInventory';
import { useCouple } from '@hooks/useCouple';
import { useRecipeQueue } from '@hooks/useRecipeQueue';
import { generateMealPlan, type MealPlan, type SuggestedMeal } from '@services/mealPlanner';

export const CUISINES = [
  { id: 'any',           label: 'Any',          emoji: '🌍' },
  { id: 'indian',        label: 'Indian',        emoji: '🇮🇳' },
  { id: 'italian',       label: 'Italian',       emoji: '🍝' },
  { id: 'asian',         label: 'Asian',         emoji: '🥢' },
  { id: 'mexican',       label: 'Mexican',       emoji: '🌮' },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🥙' },
  { id: 'japanese',      label: 'Japanese',      emoji: '🍣' },
  { id: 'thai',          label: 'Thai',          emoji: '🌶️' },
  { id: 'middle-eastern',label: 'Middle Eastern',emoji: '🫕' },
  { id: 'american',      label: 'American',      emoji: '🍔' },
] as const;

export type CuisineId = typeof CUISINES[number]['id'];

const CUISINE_PREF_KEY = 'meal_plan_cuisine_pref';

// ─── Notification bus (solo mode) ────────────────────────────
const cacheUpdateListeners = new Set<() => void>();
export function notifyMealPlanCacheUpdated(): void {
  cacheUpdateListeners.forEach((fn) => fn());
}

export async function clearMealPlanCache(userId: string): Promise<void> {
  const date = format(new Date(), 'yyyy-MM-dd');
  for (const c of CUISINES) {
    await AsyncStorage.removeItem(`meal_plan_${userId}_${date}_${c.id}`).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────

export function useMealPlan() {
  const { user, profile } = useAuth();
  const { couple } = useCouple();
  const { items: inventory } = useInventory(couple?.id ?? null);
  const { recipes } = useRecipeQueue();

  const [plan, setPlan]            = useState<MealPlan | null>(null);
  const [loading, setLoading]      = useState(false);
  const [error, setError]          = useState<string | null>(null);
  const [cuisine, setCuisineState] = useState<CuisineId>('any');

  const partnerProfile = couple?.partner ?? null;
  const isCouple       = !!couple?.id;

  useEffect(() => {
    AsyncStorage.getItem(CUISINE_PREF_KEY)
      .then((v) => { if (v) setCuisineState(v as CuisineId); })
      .catch(() => {});
  }, []);

  const localCacheKey = `meal_plan_${user?.id}_${format(new Date(), 'yyyy-MM-dd')}_${cuisine}`;

  // ── Persist plan (AsyncStorage + Supabase for couples) ───────
  const persistPlan = useCallback(async (p: MealPlan) => {
    await AsyncStorage.setItem(localCacheKey, JSON.stringify(p)).catch(() => {});
    if (isCouple && couple?.id && user?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('couple_meal_plans')
        .upsert({
          couple_id:  couple.id,
          plan_date:  format(new Date(), 'yyyy-MM-dd'),
          cuisine_id: cuisine,
          plan:       p,
          updated_by: user.id,
        }, { onConflict: 'couple_id,plan_date,cuisine_id' });
    }
  }, [localCacheKey, isCouple, couple?.id, user?.id, cuisine]);

  // ── Generate / load plan ─────────────────────────────────────
  const generate = useCallback(async (force = false) => {
    if (!profile || !user) return;

    if (!force) {
      // 1. Try local cache first (fast)
      try {
        const cached = await AsyncStorage.getItem(localCacheKey);
        if (cached) { setPlan(JSON.parse(cached) as MealPlan); return; }
      } catch {}
      // 2. For couples, try Supabase
      if (isCouple && couple?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('couple_meal_plans')
          .select('plan')
          .eq('couple_id', couple.id)
          .eq('plan_date', format(new Date(), 'yyyy-MM-dd'))
          .eq('cuisine_id', cuisine)
          .maybeSingle() as { data: { plan: MealPlan } | null };
        if (data?.plan) {
          setPlan(data.plan);
          await AsyncStorage.setItem(localCacheKey, JSON.stringify(data.plan)).catch(() => {});
          return;
        }
      }
    }

    setLoading(true);
    setError(null);
    try {
      let likedMeals: string[] = [];
      try {
        const raw = await AsyncStorage.getItem('liked_meals_v1');
        if (raw) likedMeals = JSON.parse(raw) as string[];
      } catch {}

      const newPlan = await generateMealPlan({
        profile,
        partnerProfile,
        inventory,
        recipes,
        cuisine,
        likedMeals,
      });
      setPlan(newPlan);
      await persistPlan(newPlan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  }, [profile, user, partnerProfile, inventory, recipes, localCacheKey, cuisine, isCouple, couple?.id, persistPlan]);

  const generateRef = useRef(generate);
  useEffect(() => { generateRef.current = generate; }, [generate]);

  // ── Solo cache-update notification ───────────────────────────
  useEffect(() => {
    const onUpdate = () => { generateRef.current(false); };
    cacheUpdateListeners.add(onUpdate);
    return () => { cacheUpdateListeners.delete(onUpdate); };
  }, []);

  // ── Couple real-time subscription ─────────────────────────────
  useEffect(() => {
    if (!isCouple || !couple?.id || !user?.id) return;

    const channel = supabase
      .channel(`couple_meal_plan:${couple.id}_${cuisine}`)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        'postgres_changes' as any,
        {
          event:  '*',
          schema: 'public',
          table:  'couple_meal_plans',
          filter: `couple_id=eq.${couple.id}`,
        },
        (payload: any) => {
          const row = payload.new as { plan: MealPlan; updated_by: string; cuisine_id: string } | null;
          // Only update if the change came from the partner and matches current cuisine
          if (row && row.updated_by !== user.id && row.cuisine_id === cuisine) {
            setPlan(row.plan);
            AsyncStorage.setItem(localCacheKey, JSON.stringify(row.plan)).catch(() => {});
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isCouple, couple?.id, user?.id, cuisine, localCacheKey]);

  useEffect(() => { generate(false); }, [generate]);

  async function selectCuisine(id: CuisineId) {
    setCuisineState(id);
    await AsyncStorage.setItem(CUISINE_PREF_KEY, id).catch(() => {});
  }

  // ── Replace a single meal card (persisted + synced to partner) ─
  async function replaceMealInPlan(dayIdx: number, mealIdx: number, newMeal: SuggestedMeal) {
    if (!plan) return;
    const updatedDays = plan.days.map((day, dI) =>
      dI !== dayIdx ? day : {
        ...day,
        meals: day.meals.map((m, mI) => mI === mealIdx ? newMeal : m),
      },
    );
    const updated = { ...plan, days: updatedDays };
    setPlan(updated);
    await persistPlan(updated);
  }

  return {
    plan, loading, error,
    cuisine, selectCuisine,
    inventory,
    isCouple,
    partnerProfile,
    refresh: () => generate(true),
    replaceMealInPlan,
  };
}
