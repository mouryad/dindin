import { supabase } from '@lib/supabase';
import type { InventoryItem, InventoryItemInsert } from '@db/database';
import type { FridgeIngredient } from './aiVision';
import { addDays, format } from 'date-fns';

// Default expiry estimates by category (days from purchase)
const CATEGORY_EXPIRY_DAYS: Record<string, number> = {
  produce: 5,
  dairy: 7,
  meat: 3,
  seafood: 2,
  grains: 180,
  condiments: 90,
  beverages: 14,
  frozen: 90,
  other: 14,
};

export async function bulkAddFromFridgeScan(params: {
  coupleId: string;
  userId: string;
  ingredients: FridgeIngredient[];
  fridgePhotoUrl?: string;
}): Promise<{ added: number; skipped: number }> {
  const { coupleId, userId, ingredients } = params;

  // Check existing items to avoid duplicates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('inventory_items')
    .select('name')
    .eq('couple_id', coupleId)
    .eq('is_depleted', false) as { data: Array<{ name: string }> | null };

  const existingNames = new Set((existing ?? []).map((e) => e.name.toLowerCase()));

  const toInsert: InventoryItemInsert[] = ingredients
    .filter((ing) => !existingNames.has(ing.name.toLowerCase()))
    .map((ing) => ({
      couple_id: coupleId,
      added_by_user_id: userId,
      name: ing.name,
      category: ing.category,
      quantity: parseFloat(ing.quantity) || null,
      unit: ing.unit || null,
      purchase_date: format(new Date(), 'yyyy-MM-dd'),
      expiry_date: format(
        addDays(new Date(), CATEGORY_EXPIRY_DAYS[ing.category] ?? 14),
        'yyyy-MM-dd',
      ),
      low_stock_threshold: null,
      photo_url: null,
      notes: 'Added via AI fridge scan',
    }));

  if (toInsert.length === 0) return { added: 0, skipped: ingredients.length };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('inventory_items')
    .insert(toInsert);

  if (error) throw error;
  return { added: toInsert.length, skipped: ingredients.length - toInsert.length };
}

export async function getExpiringItems(coupleId: string, withinDays = 3): Promise<InventoryItem[]> {
  const targetDate = format(addDays(new Date(), withinDays), 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('inventory_items')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('is_depleted', false)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', targetDate)
    .gte('expiry_date', today)
    .order('expiry_date') as { data: InventoryItem[] | null };

  return data ?? [];
}

export async function markItemDepleted(itemId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('inventory_items')
    .update({ is_depleted: true })
    .eq('id', itemId);
}

export async function getInventory(coupleId: string): Promise<InventoryItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('inventory_items')
    .select('*')
    .eq('couple_id', coupleId)
    .eq('is_depleted', false)
    .order('expiry_date', { ascending: true, nullsFirst: false }) as { data: InventoryItem[] | null };

  return data ?? [];
}
