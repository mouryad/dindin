import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import type { WeightLog, WeightLogInsert } from '@db/database';

export interface WeightTrend {
  logs: WeightLog[];
  latestKg: number | null;
  startKg: number | null;          // oldest in window
  changeKg: number | null;         // positive = gained, negative = lost
  progressPct: number | null;      // 0–100 toward target
  onTrack: boolean | null;
}

export function useWeightLog(windowDays = 30) {
  const { user, profile } = useAuth();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('logged_at', since.toISOString())
      .order('logged_at', { ascending: true }) as { data: WeightLog[] | null };

    setLogs(data ?? []);
    setLoading(false);
  }, [user, windowDays]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function logWeight(weightKg: number, notes?: string): Promise<void> {
    if (!user) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('weight_logs').insert({
        user_id: user.id,
        logged_at: new Date().toISOString(),
        weight_kg: weightKg,
        notes: notes ?? null,
      } as WeightLogInsert);
      await fetchLogs();
    } finally {
      setSaving(false);
    }
  }

  const trend = computeTrend(logs, profile);

  return { logs, loading, saving, logWeight, refresh: fetchLogs, trend };
}

function computeTrend(
  logs: WeightLog[],
  profile: { current_weight_kg?: number | null; target_weight_kg?: number | null; weight_goal?: string | null } | null,
): WeightTrend {
  if (logs.length === 0) {
    return { logs, latestKg: null, startKg: null, changeKg: null, progressPct: null, onTrack: null };
  }

  const latestKg = logs[logs.length - 1].weight_kg;
  const startKg  = logs[0].weight_kg;
  const changeKg = latestKg - startKg;

  const targetKg = profile?.target_weight_kg ?? null;
  const goal     = profile?.weight_goal ?? 'maintain';

  let progressPct: number | null = null;
  let onTrack: boolean | null = null;

  if (targetKg !== null && startKg !== null) {
    const totalNeeded = Math.abs(targetKg - startKg);
    const achieved    = goal === 'lose'
      ? startKg - latestKg
      : goal === 'gain'
      ? latestKg - startKg
      : 0;
    progressPct = totalNeeded > 0
      ? Math.min(100, Math.max(0, Math.round((achieved / totalNeeded) * 100)))
      : 100;

    onTrack = goal === 'lose' ? changeKg <= 0
            : goal === 'gain' ? changeKg >= 0
            : Math.abs(changeKg) < 1;
  }

  return { logs, latestKg, startKg, changeKg, progressPct, onTrack };
}
