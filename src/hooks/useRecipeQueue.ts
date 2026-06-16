import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { useCouple } from '@hooks/useCouple';

export interface RecipeQueueItem {
  id: string;
  user_id: string;
  url: string;
  title: string;
  thumbnail_url: string | null;
  platform: string;
  meal_category: string;
  notes: string | null;
  created_at: string;
}

export function useRecipeQueue() {
  const { user } = useAuth();
  const { couple } = useCouple();
  const [recipes, setRecipes] = useState<RecipeQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  const partnerId = couple?.partner?.id ?? null;

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('recipe_queue')
      .select('*')
      .order('created_at', { ascending: false });
    query = partnerId
      ? query.in('user_id', [user.id, partnerId])
      : query.eq('user_id', user.id);
    const { data } = await query as { data: RecipeQueueItem[] | null };
    setRecipes(data ?? []);
    setLoading(false);
  }, [user, partnerId]);

  useEffect(() => { fetch(); }, [fetch]);

  async function addRecipe(item: Omit<RecipeQueueItem, 'id' | 'created_at'>) {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('recipe_queue').insert({ ...item, user_id: user.id });
    await fetch();
  }

  async function removeRecipe(id: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('recipe_queue').delete().eq('id', id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }

  return { recipes, loading, addRecipe, removeRecipe, refresh: fetch };
}
