import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import type { MealLog, MacroProgress } from '@db/database';

export function useTodayMeals() {
  const { user, profile } = useAuth();
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchToday() {
    if (!user) return;
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('meal_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('logged_at', `${today}T00:00:00`)
      .lte('logged_at', `${today}T23:59:59`)
      .order('logged_at') as { data: MealLog[] | null };

    setMeals(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchToday();
  }, [user]);

  const macroProgress: MacroProgress | null = profile?.daily_calorie_target
    ? computeProgress(meals, profile)
    : null;

  return { meals, loading, refresh: fetchToday, macroProgress };
}

function computeProgress(
  meals: MealLog[],
  profile: { daily_calorie_target?: number | null; daily_protein_g?: number | null; daily_carbs_g?: number | null; daily_fat_g?: number | null },
): MacroProgress {
  const targets = {
    calories: profile.daily_calorie_target ?? 2000,
    protein_g: profile.daily_protein_g ?? 150,
    carbs_g: profile.daily_carbs_g ?? 200,
    fat_g: profile.daily_fat_g ?? 67,
  };

  const consumed = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carbs_g: acc.carbs_g + (m.carbs_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  const remaining = {
    calories: Math.max(0, targets.calories - consumed.calories),
    protein_g: Math.max(0, targets.protein_g - consumed.protein_g),
    carbs_g: Math.max(0, targets.carbs_g - consumed.carbs_g),
    fat_g: Math.max(0, targets.fat_g - consumed.fat_g),
  };

  const pct = (a: number, b: number) => Math.min(100, Math.round((a / (b || 1)) * 100));

  return {
    targets,
    consumed,
    remaining,
    percentages: {
      calories: pct(consumed.calories, targets.calories),
      protein: pct(consumed.protein_g, targets.protein_g),
      carbs: pct(consumed.carbs_g, targets.carbs_g),
      fat: pct(consumed.fat_g, targets.fat_g),
    },
  };
}
