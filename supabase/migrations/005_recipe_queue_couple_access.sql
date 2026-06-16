-- Couple-shared recipe folder.
-- recipe_queue isn't tracked in supabase/schema.sql (it was created ad hoc),
-- so these migrations are additive/defensive: they check pg_policies before
-- creating anything, rather than assuming the current policy shape.
--
-- Before/after running, you can spot-check existing policies with:
--   select * from pg_policies where tablename = 'recipe_queue';

ALTER TABLE public.recipe_queue ENABLE ROW LEVEL SECURITY;

-- If no policies exist yet, RLS would block all access — grant the owner
-- full access to their own rows as a baseline.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'recipe_queue'
  ) THEN
    CREATE POLICY "recipe_queue_own_all" ON public.recipe_queue FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Let both partners in an active couple read each other's saved recipes,
-- mirroring the weight_logs_select own+partner pattern.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'recipe_queue' AND policyname = 'recipe_queue_couple_select'
  ) THEN
    CREATE POLICY "recipe_queue_couple_select" ON public.recipe_queue FOR SELECT
      USING (
        user_id = auth.uid() OR user_id IN (
          SELECT CASE WHEN user_a_id = auth.uid() THEN user_b_id ELSE user_a_id END
          FROM public.couples WHERE (user_a_id = auth.uid() OR user_b_id = auth.uid()) AND status = 'active'
        )
      );
  END IF;
END $$;
