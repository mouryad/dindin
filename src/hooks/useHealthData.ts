import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';

export const ACTIVITY_TYPES = [
  { id: 'walk',    label: 'Walk',   icon: '🚶', met: 3.5 },
  { id: 'run',     label: 'Run',    icon: '🏃', met: 8.0 },
  { id: 'swim',    label: 'Swim',   icon: '🏊', met: 6.0 },
  { id: 'cycle',   label: 'Cycle',  icon: '🚴', met: 6.8 },
  { id: 'gym',     label: 'Gym',    icon: '🏋️', met: 5.0 },
  { id: 'yoga',    label: 'Yoga',   icon: '🧘', met: 3.0 },
  { id: 'hiit',    label: 'HIIT',   icon: '🔥', met: 9.0 },
  { id: 'dance',   label: 'Dance',  icon: '💃', met: 4.8 },
  { id: 'other',   label: 'Other',  icon: '⚡', met: 4.0 },
] as const;

export type ActivityId = typeof ACTIVITY_TYPES[number]['id'];

export interface WorkoutEntry {
  type: ActivityId;
  durationMin: number;
  calories: number;
  loggedAt: string;
}

export function estimateCalories(activityId: ActivityId, durationMin: number, weightKg: number): number {
  const activity = ACTIVITY_TYPES.find((a) => a.id === activityId);
  const met = activity?.met ?? 4.0;
  return Math.round(met * 3.5 * weightKg / 200 * durationMin);
}

export function useHealthData() {
  const { user, profile } = useAuth();
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchToday = useCallback(async () => {
    if (!user?.id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('health_data')
      .select('active_calories_burned, raw_data')
      .eq('user_id', user.id)
      .eq('data_date', today)
      .eq('source', 'manual')
      .maybeSingle();

    if (data) {
      setCaloriesBurned(data.active_calories_burned ?? 0);
      const stored = (data.raw_data as { workouts?: WorkoutEntry[] })?.workouts ?? [];
      setWorkouts(stored);
    } else {
      setCaloriesBurned(0);
      setWorkouts([]);
    }
  }, [user?.id, today]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  async function logWorkout(activityId: ActivityId, durationMin: number): Promise<void> {
    if (!user?.id) return;
    setSaving(true);
    try {
      const weightKg = profile?.current_weight_kg ?? 70;
      const calories = estimateCalories(activityId, durationMin, weightKg);
      const entry: WorkoutEntry = {
        type: activityId,
        durationMin,
        calories,
        loggedAt: new Date().toISOString(),
      };

      const newWorkouts = [...workouts, entry];
      const newTotal = newWorkouts.reduce((sum, w) => sum + w.calories, 0);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('health_data')
        .upsert({
          user_id: user.id,
          data_date: today,
          source: 'manual',
          active_calories_burned: newTotal,
          active_minutes: newWorkouts.reduce((sum, w) => sum + w.durationMin, 0),
          raw_data: { workouts: newWorkouts },
        }, { onConflict: 'user_id,data_date,source' });

      if (error) throw error;
      setCaloriesBurned(newTotal);
      setWorkouts(newWorkouts);
    } finally {
      setSaving(false);
    }
  }

  return { caloriesBurned, workouts, logWorkout, saving, refresh: fetchToday };
}
