import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { useCouple } from '@hooks/useCouple';
import type { WasteLog, WasteLogInsert, WasteItem } from '@db/database';

export interface WasteWeekSummary {
  logs: WasteLog[];
  totalWeightG: number;
  totalCalories: number;
}

interface UseWasteLogReturn {
  thisWeek: WasteWeekSummary;
  lastWeek: WasteWeekSummary;
  loading: boolean;
  saveWasteLog: (data: {
    waste_items: WasteItem[];
    estimated_weight_g: number;
    estimated_calories: number;
    notes?: string;
  }) => Promise<void>;
  refresh: () => Promise<void>;
}

function summarize(logs: WasteLog[] | null): WasteWeekSummary {
  const l = logs ?? [];
  return {
    logs: l,
    totalWeightG: l.reduce((s, x) => s + (x.estimated_weight_g ?? 0), 0),
    totalCalories: l.reduce((s, x) => s + (x.estimated_calories ?? 0), 0),
  };
}

export function useWasteLog(): UseWasteLogReturn {
  const { user } = useAuth();
  const { couple } = useCouple();

  const [thisWeek, setThisWeek] = useState<WasteWeekSummary>({ logs: [], totalWeightG: 0, totalCalories: 0 });
  const [lastWeek, setLastWeek] = useState<WasteWeekSummary>({ logs: [], totalWeightG: 0, totalCalories: 0 });
  const [loading, setLoading] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!couple?.id) return;
    setLoading(true);
    try {
      const now = new Date();
      const opts = { weekStartsOn: 1 as const };
      const thisStart = format(startOfWeek(now, opts), 'yyyy-MM-dd');
      const thisEnd   = format(endOfWeek(now, opts), 'yyyy-MM-dd');
      const lastStart = format(startOfWeek(subWeeks(now, 1), opts), 'yyyy-MM-dd');
      const lastEnd   = format(endOfWeek(subWeeks(now, 1), opts), 'yyyy-MM-dd');

      const [resThis, resLast] = await Promise.all([
        (supabase as any)
          .from('waste_logs')
          .select('*')
          .eq('couple_id', couple.id)
          .gte('logged_date', thisStart)
          .lte('logged_date', thisEnd) as { data: WasteLog[] | null },
        (supabase as any)
          .from('waste_logs')
          .select('*')
          .eq('couple_id', couple.id)
          .gte('logged_date', lastStart)
          .lte('logged_date', lastEnd) as { data: WasteLog[] | null },
      ]);

      setThisWeek(summarize(resThis.data));
      setLastWeek(summarize(resLast.data));
    } finally {
      setLoading(false);
    }
  }, [couple?.id]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const saveWasteLog = useCallback(async (data: {
    waste_items: WasteItem[];
    estimated_weight_g: number;
    estimated_calories: number;
    notes?: string;
  }) => {
    if (!user?.id || !couple?.id) throw new Error('Not linked to a couple');

    const insert: WasteLogInsert = {
      couple_id: couple.id,
      logged_by_user_id: user.id,
      logged_date: format(new Date(), 'yyyy-MM-dd'),
      photo_url: null,
      estimated_weight_g: data.estimated_weight_g,
      estimated_calories: data.estimated_calories,
      waste_items: data.waste_items,
      notes: data.notes ?? null,
    };

    const { error } = await (supabase as any).from('waste_logs').insert(insert);
    if (error) throw new Error(error.message);
    await fetchLogs();
  }, [user?.id, couple?.id, fetchLogs]);

  return { thisWeek, lastWeek, loading, saveWasteLog, refresh: fetchLogs };
}
