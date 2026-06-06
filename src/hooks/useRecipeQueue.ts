import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';

export interface RecipeQueueItem {
  id: string;
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
  const [recipes, setRecipes] = useState<RecipeQueueItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('recipe_queue')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }) as { data: RecipeQueueItem[] | null };
    setRecipes(data ?? []);
    setLoading(false);
  }, [user]);

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
