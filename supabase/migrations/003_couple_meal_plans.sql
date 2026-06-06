-- Shared meal plan storage for couples.
-- When one partner refreshes a card, the change is persisted here
-- and the other partner receives it via Supabase real-time.

CREATE TABLE public.couple_meal_plans (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id   UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  plan_date   DATE NOT NULL,
  cuisine_id  TEXT DEFAULT 'any',
  plan        JSONB NOT NULL,
  updated_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(couple_id, plan_date, cuisine_id)
);

ALTER TABLE public.couple_meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "couple_plan_access" ON public.couple_meal_plans FOR ALL
  USING (couple_id = public.my_couple_id());

ALTER PUBLICATION supabase_realtime ADD TABLE public.couple_meal_plans;
