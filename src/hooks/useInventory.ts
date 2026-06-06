import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { scheduleDailyBlinkitNudge } from '@services/notifications';
import { differenceInDays, parseISO } from 'date-fns';
import type { InventoryItem, InventoryItemInsert } from '@db/database';

export type ExpiryStatus = 'expired' | 'critical' | 'soon' | 'ok' | 'unknown';

export interface InventoryItemRich extends InventoryItem {
  expiryStatus: ExpiryStatus;
  daysUntilExpiry: number | null;
}

function enrichItem(item: InventoryItem): InventoryItemRich {
  if (!item.expiry_date) {
    return { ...item, expiryStatus: 'unknown', daysUntilExpiry: null };
  }
  const days = differenceInDays(parseISO(item.expiry_date), new Date());
  let status: ExpiryStatus;
  if (days < 0)       status = 'expired';
  else if (days === 0) status = 'critical';
  else if (days <= 2)  status = 'critical';
  else if (days <= 5)  status = 'soon';
  else                status = 'ok';
  return { ...item, expiryStatus: status, daysUntilExpiry: days };
}

export function useInventory(coupleId: string | null) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<InventoryItemRich[]>([]);
  const [loading, setLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchItems = useCallback(async () => {
    if (!coupleId && !userId) { setItems([]); return; }
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('inventory_items')
      .select('*')
      .eq('is_depleted', false)
      .order('expiry_date', { ascending: true, nullsFirst: false });
    query = coupleId
      ? query.eq('couple_id', coupleId)
      : query.is('couple_id', null).eq('added_by_user_id', userId);
    const { data } = await query as { data: InventoryItem[] | null };

    const rich = (data ?? []).map(enrichItem);
    setItems(rich);
    setLoading(false);

    // Reschedule Blinkit nudge whenever inventory is refreshed
    scheduleDailyBlinkitNudge(data ?? []).catch(() => {});
  }, [coupleId, userId]);

  // Keep a stable ref so the subscription callback never goes stale
  const fetchItemsRef = useRef(fetchItems);
  useEffect(() => { fetchItemsRef.current = fetchItems; }, [fetchItems]);

  // Initial fetch
  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Realtime subscription — only re-subscribes when coupleId/userId changes,
  // not when fetchItems recreates (avoids "cannot add callbacks after subscribe" error)
  useEffect(() => {
    if (!coupleId && !userId) return;

    const channelKey = coupleId ? `inventory:${coupleId}` : `inventory:solo:${userId}`;
    const filter = coupleId
      ? `couple_id=eq.${coupleId}`
      : `added_by_user_id=eq.${userId}`;

    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items', filter },
        () => { fetchItemsRef.current(); },
      )
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [coupleId, userId, fetchItems]);

  async function addItem(insert: InventoryItemInsert): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('inventory_items')
      .insert(insert);
    if (error) throw error;
    // Realtime will trigger fetchItems — no need to call manually
  }

  async function updateItem(id: string, patch: Partial<InventoryItem>): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('inventory_items')
      .update(patch)
      .eq('id', id);
    if (error) throw error;
  }

  async function markDepleted(id: string): Promise<void> {
    await updateItem(id, { is_depleted: true });
  }

  async function deleteItem(id: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('inventory_items')
      .delete()
      .eq('id', id);
  }

  // Grouped by category for section list rendering
  const byCategory = items.reduce<Record<string, InventoryItemRich[]>>((acc, item) => {
    const cat = item.category ?? 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const expiringSoon  = items.filter((i) => i.expiryStatus === 'critical' || i.expiryStatus === 'soon');
  const expired       = items.filter((i) => i.expiryStatus === 'expired');

  return {
    items,
    byCategory,
    expiringSoon,
    expired,
    loading,
    refresh: fetchItems,
    addItem,
    updateItem,
    markDepleted,
    deleteItem,
  };
}
