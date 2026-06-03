import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import type { Couple, Profile } from '@db/database';

export interface CoupleWithPartner extends Couple {
  partner: Profile | null;
}

export function useCouple() {
  const { user } = useAuth();
  const [couple, setCouple] = useState<CoupleWithPartner | null>(null);
  const [loading, setLoading]   = useState(true);
  const [joining, setJoining]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetchCouple = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: coupleRow } = await (supabase as any)
      .from('couples')
      .select('*')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .eq('status', 'active')
      .single() as { data: Couple | null };

    if (!coupleRow) { setCouple(null); setLoading(false); return; }

    const partnerId = coupleRow.user_a_id === user.id
      ? coupleRow.user_b_id
      : coupleRow.user_a_id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: partnerProfile } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('id', partnerId)
      .single() as { data: Profile | null };

    setCouple({ ...coupleRow, partner: partnerProfile });
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchCouple(); }, [fetchCouple]);

  /** Create an invite — inserts a pending couple with this user as user_a */
  async function createInvite(): Promise<string> {
    if (!user) throw new Error('Not logged in');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from('couples')
      .insert({ user_a_id: user.id, status: 'pending' })
      .select('invite_code')
      .single() as { data: { invite_code: string } | null; error: unknown };

    if (err || !data) throw new Error('Could not create invite');
    return data.invite_code;
  }

  /** Join a couple via 6-char invite code */
  async function joinByCode(code: string): Promise<void> {
    if (!user) throw new Error('Not logged in');
    setJoining(true);
    setError(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pending } = await (supabase as any)
        .from('couples')
        .select('*')
        .eq('invite_code', code.trim().toLowerCase())
        .eq('status', 'pending')
        .single() as { data: Couple | null };

      if (!pending) throw new Error('Invite code not found or already used');
      if (pending.user_a_id === user.id) throw new Error("That's your own invite code!");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updErr } = await (supabase as any)
        .from('couples')
        .update({ user_b_id: user.id, status: 'active' })
        .eq('id', pending.id);

      if (updErr) throw updErr;
      await fetchCouple();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join');
    } finally {
      setJoining(false);
    }
  }

  async function updateCoupleName(name: string): Promise<void> {
    if (!couple?.id) return;
    const { error: updErr } = await (supabase as any)
      .from('couples')
      .update({ couple_name: name.trim() || null })
      .eq('id', couple.id);
    if (updErr) throw new Error(updErr.message);
    await fetchCouple();
  }

  async function leaveCouple(): Promise<void> {
    if (!couple?.id) return;
    const { error: updErr } = await (supabase as any)
      .from('couples')
      .update({ status: 'paused' })
      .eq('id', couple.id);
    if (updErr) throw new Error(updErr.message);
    setCouple(null);
  }

  return {
    couple,
    loading,
    joining,
    error,
    refresh: fetchCouple,
    createInvite,
    joinByCode,
    updateCoupleName,
    leaveCouple,
  };
}
