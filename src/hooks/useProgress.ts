import { useMemo } from 'react';
import { useAuth } from '@context/AuthContext';
import { useTodayMeals } from '@hooks/useMealLog';
import { useWeightLog } from '@hooks/useWeightLog';

export interface Milestone {
  id: string;
  icon: string;
  title: string;
  description: string;
  achieved: boolean;
  achievedAt?: string;
}

function buildMilestones(params: {
  streak: number;
  totalMeals: number;
  weightProgressPct: number | null;
  goal: string;
}): Milestone[] {
  const { streak, totalMeals, weightProgressPct, goal } = params;

  return [
    {
      id: 'first_meal',
      icon: '🍽',
      title: 'First bite',
      description: 'Log your first meal',
      achieved: totalMeals >= 1,
    },
    {
      id: 'week_streak',
      icon: '🔥',
      title: '7-day streak',
      description: 'Cook or log 7 days in a row',
      achieved: streak >= 7,
    },
    {
      id: 'month_streak',
      icon: '🌟',
      title: '30-day streak',
      description: 'A full month of consistent logging',
      achieved: streak >= 30,
    },
    {
      id: 'ten_meals',
      icon: '🎯',
      title: '10 meals logged',
      description: 'You\'re building the habit',
      achieved: totalMeals >= 10,
    },
    {
      id: 'fifty_meals',
      icon: '👑',
      title: '50 meals logged',
      description: 'Logging legend',
      achieved: totalMeals >= 50,
    },
    {
      id: 'halfway_goal',
      icon: goal === 'lose' ? '📉' : goal === 'gain' ? '📈' : '⚖️',
      title: 'Halfway there',
      description: '50% progress toward your weight goal',
      achieved: (weightProgressPct ?? 0) >= 50,
    },
    {
      id: 'goal_reached',
      icon: '🏆',
      title: 'Goal reached!',
      description: 'You hit your target weight',
      achieved: (weightProgressPct ?? 0) >= 100,
    },
  ];
}

export function useProgress() {
  const { profile } = useAuth();
  const { macroProgress, refresh: refreshMeals } = useTodayMeals();
  const { trend, logWeight, saving: weightSaving, refresh: refreshWeight } = useWeightLog(90);

  const milestones = useMemo(() =>
    buildMilestones({
      streak: profile?.cooking_streak ?? 0,
      totalMeals: profile?.total_meals_logged ?? 0,
      weightProgressPct: trend.progressPct,
      goal: profile?.weight_goal ?? 'maintain',
    }),
    [profile, trend.progressPct],
  );

  const achievedCount = milestones.filter((m) => m.achieved).length;

  function refresh() {
    refreshMeals();
    refreshWeight();
  }

  return {
    profile,
    macroProgress,
    weightTrend: trend,
    milestones,
    achievedCount,
    totalMilestones: milestones.length,
    logWeight,
    weightSaving,
    refresh,
  };
}
