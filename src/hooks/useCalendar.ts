import { useState, useEffect, useCallback } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import type { CalendarDay, CalendarMonth, DailySummary, MealLog, WeightLog } from '@db/database';

export function useCalendar(initialDate?: Date) {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(initialDate ?? new Date());
  const [calendarData, setCalendarData] = useState<CalendarMonth>({});
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [expandedDayData, setExpandedDayData] = useState<{
    mealLogs: MealLog[];
    userWeightLogs: WeightLog[];
    partnerWeightLogs: WeightLog[];
  } | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const fetchMonth = useCallback(async (date: Date) => {
    if (!user) return;
    setLoading(true);

    const monthStart = format(startOfMonth(date), 'yyyy-MM-dd');
    const monthEnd   = format(endOfMonth(date), 'yyyy-MM-dd');

    // Get daily summaries for the current user in this month
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: summaries } = await (supabase as any)
      .from('daily_summaries')
      .select('*')
      .eq('user_id', user.id)
      .gte('summary_date', monthStart)
      .lte('summary_date', monthEnd) as { data: DailySummary[] | null };

    // Build calendar grid — every day of the month
    const allDays = eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) });
    const newCalendar: CalendarMonth = {};

    const summaryMap = new Map(
      (summaries ?? []).map((s) => [s.summary_date, s])
    );

    for (const day of allDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const summary = summaryMap.get(dateStr);

      newCalendar[dateStr] = {
        date: dateStr,
        hasData: !!summary && summary.meal_count > 0,
        thumbnailUrl: summary?.thumbnail_url ?? null,
        mealCount: summary?.meal_count ?? 0,
        hasWeightLog: summary?.has_weight_log ?? false,
        hasFridgePhoto: summary?.has_fridge_photo ?? false,
        streakActive: summary?.streak_active ?? false,
      };
    }

    setCalendarData(newCalendar);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchMonth(currentMonth);
  }, [currentMonth, fetchMonth]);

  async function selectDay(dateStr: string) {
    const day = calendarData[dateStr];
    if (!day?.hasData) return;

    setSelectedDay(dateStr);
    setExpandedLoading(true);

    try {
      const [mealRes, weightRes, partnerWeightRes] = await Promise.all([
        // Meal logs for the day (own + shared partner)
        supabase
          .from('meal_logs')
          .select('*')
          .eq('user_id', user!.id)
          .gte('logged_at', `${dateStr}T00:00:00`)
          .lte('logged_at', `${dateStr}T23:59:59`)
          .order('logged_at'),

        // Own weight log
        supabase
          .from('weight_logs')
          .select('*')
          .eq('user_id', user!.id)
          .gte('logged_at', `${dateStr}T00:00:00`)
          .lte('logged_at', `${dateStr}T23:59:59`),

        // Partner weight log via couple
        supabase.rpc('my_couple_id').then(async ({ data: coupleId }) => {
          if (!coupleId) return { data: [] };
          return supabase
            .from('weight_logs')
            .select('*, profiles(id, display_name, avatar_url)')
            .neq('user_id', user!.id)
            .gte('logged_at', `${dateStr}T00:00:00`)
            .lte('logged_at', `${dateStr}T23:59:59`);
        }),
      ]);

      const partnerData = await partnerWeightRes;
      setExpandedDayData({
        mealLogs: mealRes.data ?? [],
        userWeightLogs: weightRes.data ?? [],
        partnerWeightLogs: (partnerData as { data: WeightLog[] | null }).data ?? [],
      });
    } finally {
      setExpandedLoading(false);
    }
  }

  function closeDay() {
    setSelectedDay(null);
    setExpandedDayData(null);
  }

  function goToPrevMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    closeDay();
  }

  function goToNextMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    closeDay();
  }

  return {
    currentMonth,
    calendarData,
    loading,
    selectedDay,
    expandedDayData,
    expandedLoading,
    selectDay,
    closeDay,
    goToPrevMonth,
    goToNextMonth,
    refresh: () => fetchMonth(currentMonth),
  };
}
