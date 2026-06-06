-- Allow solo users (no partner linked) to use inventory.
-- couple_id becomes nullable; when NULL the item belongs to the individual user.

ALTER TABLE public.inventory_items
  ALTER COLUMN couple_id DROP NOT NULL;

-- Update RLS: couple items keyed by couple_id, solo items keyed by added_by_user_id
DROP POLICY IF EXISTS "inventory_couple_access" ON public.inventory_items;

CREATE POLICY "inventory_access" ON public.inventory_items FOR ALL
  USING (
    (couple_id IS NOT NULL AND couple_id = public.my_couple_id())
    OR
    (couple_id IS NULL AND added_by_user_id = auth.uid())
  );
