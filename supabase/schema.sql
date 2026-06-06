-- ============================================================
-- Dindin — Supabase Schema
-- ============================================================
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES (extends Supabase auth.users)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT NOT NULL DEFAULT '',
  avatar_url            TEXT,
  -- Dietary
  dietary_restrictions  TEXT[]  DEFAULT '{}',   -- e.g. ['vegetarian', 'gluten-free']
  allergies             TEXT[]  DEFAULT '{}',   -- e.g. ['nuts', 'dairy']
  -- Body metrics
  current_weight_kg     NUMERIC(5,2),
  target_weight_kg      NUMERIC(5,2),
  height_cm             NUMERIC(5,1),
  date_of_birth         DATE,
  gender                TEXT CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  activity_level        TEXT CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')) DEFAULT 'moderate',
  -- Goals
  weight_goal           TEXT CHECK (weight_goal IN ('lose','maintain','gain')) DEFAULT 'maintain',
  daily_calorie_target  INTEGER,
  daily_protein_g       NUMERIC(6,1),
  daily_carbs_g         NUMERIC(6,1),
  daily_fat_g           NUMERIC(6,1),
  -- Gamification
  cooking_streak        INTEGER DEFAULT 0,
  longest_streak        INTEGER DEFAULT 0,
  total_meals_logged    INTEGER DEFAULT 0,
  -- Onboarding
  onboarding_complete   BOOLEAN DEFAULT FALSE,
  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. COUPLES (links two user profiles)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.couples (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  couple_name   TEXT,
  invite_code   TEXT UNIQUE DEFAULT LEFT(MD5(RANDOM()::TEXT), 8),
  status        TEXT CHECK (status IN ('pending','active','paused')) DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_coupling CHECK (user_a_id <> user_b_id),
  CONSTRAINT unique_pair UNIQUE (user_a_id, user_b_id)
);

-- ────────────────────────────────────────────────────────────
-- 3. INVENTORY (shared fridge/pantry items)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.inventory_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id           UUID REFERENCES public.couples(id) ON DELETE CASCADE,  -- NULL for solo users
  added_by_user_id    UUID NOT NULL REFERENCES public.profiles(id),
  name                TEXT NOT NULL,
  category            TEXT,                     -- e.g. 'produce', 'dairy', 'meat'
  quantity            NUMERIC(8,2),
  unit                TEXT,                     -- e.g. 'kg', 'ml', 'pieces'
  purchase_date       DATE,
  expiry_date         DATE,
  low_stock_threshold NUMERIC(8,2),
  photo_url           TEXT,
  notes               TEXT,
  is_depleted         BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 4. MEAL LOGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.meal_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  couple_id       UUID REFERENCES public.couples(id),
  logged_at       TIMESTAMPTZ DEFAULT NOW(),
  meal_type       TEXT CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  meal_source     TEXT CHECK (meal_source IN ('home_cooked','restaurant','delivery','other')) DEFAULT 'home_cooked',
  dish_name       TEXT,
  description     TEXT,
  -- Photo & AI
  photo_url       TEXT,
  ai_raw_response JSONB,                        -- full AI model response for audit
  -- Macros (AI-estimated or manual)
  calories        NUMERIC(7,1),
  protein_g       NUMERIC(6,1),
  carbs_g         NUMERIC(6,1),
  fat_g           NUMERIC(6,1),
  fiber_g         NUMERIC(6,1),
  -- Portion
  serving_size    TEXT,
  num_servings    NUMERIC(4,1) DEFAULT 1,
  -- Flags
  is_shared       BOOLEAN DEFAULT TRUE,         -- visible to partner?
  is_verified     BOOLEAN DEFAULT FALSE,        -- user confirmed AI estimate?
  -- YouTube
  youtube_video_id TEXT,
  youtube_title    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 5. WEIGHT LOGS
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.weight_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_at   TIMESTAMPTZ DEFAULT NOW(),
  weight_kg   NUMERIC(5,2) NOT NULL,
  body_fat_pct NUMERIC(4,1),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 6. WASTE LOGS (daily leftover tracking)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.waste_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id             UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  logged_by_user_id     UUID NOT NULL REFERENCES public.profiles(id),
  logged_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  photo_url             TEXT,
  estimated_weight_g    NUMERIC(7,1),
  estimated_calories    NUMERIC(7,1),
  waste_items           JSONB,                  -- [{name, qty, unit, calories}]
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 7. SAVED PLAYLISTS (YouTube recipe collections)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.saved_playlists (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id     UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  added_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  youtube_playlist_id TEXT NOT NULL,
  title         TEXT,
  description   TEXT,
  thumbnail_url TEXT,
  video_count   INTEGER,
  tags          TEXT[]  DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 8. HEALTH DATA (wearable integration placeholder)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.health_data (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data_date             DATE NOT NULL,
  source                TEXT,                   -- 'apple_health', 'health_connect', 'manual'
  active_calories_burned NUMERIC(7,1),
  resting_calories      NUMERIC(7,1),
  steps                 INTEGER,
  active_minutes        INTEGER,
  sleep_hours           NUMERIC(4,1),
  heart_rate_avg        INTEGER,
  hrv_ms                NUMERIC(5,1),
  raw_data              JSONB,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, data_date, source)
);

-- ────────────────────────────────────────────────────────────
-- 9. DAILY SUMMARIES (precomputed per-day rollup for calendar)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.daily_summaries (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  couple_id             UUID REFERENCES public.couples(id),
  summary_date          DATE NOT NULL,
  -- Calorie balance
  total_calories_eaten  NUMERIC(7,1) DEFAULT 0,
  total_protein_g       NUMERIC(6,1) DEFAULT 0,
  total_carbs_g         NUMERIC(6,1) DEFAULT 0,
  total_fat_g           NUMERIC(6,1) DEFAULT 0,
  calories_burned       NUMERIC(7,1) DEFAULT 0,
  calorie_deficit       NUMERIC(7,1) GENERATED ALWAYS AS (calories_burned - total_calories_eaten) STORED,
  -- Calendar thumbnail
  thumbnail_url         TEXT,                   -- best photo of the day
  meal_count            INTEGER DEFAULT 0,
  has_weight_log        BOOLEAN DEFAULT FALSE,
  has_fridge_photo      BOOLEAN DEFAULT FALSE,
  -- Streaks
  streak_active         BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, summary_date)
);

-- ────────────────────────────────────────────────────────────
-- 10. NOTIFICATIONS / NUDGES (scheduled push records)
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.nudges (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id       UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  nudge_type      TEXT CHECK (nudge_type IN ('blinkit_restock','waste_prompt','streak_reminder','milestone')),
  scheduled_for   TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  payload         JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_playlists   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_data       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudges            ENABLE ROW LEVEL SECURITY;

-- Helper function: returns the couple_id for the current user
CREATE OR REPLACE FUNCTION public.my_couple_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.couples
  WHERE (user_a_id = auth.uid() OR user_b_id = auth.uid())
    AND status = 'active'
  LIMIT 1;
$$;

-- Profiles: own row + partner's row
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR id IN (
    SELECT CASE WHEN user_a_id = auth.uid() THEN user_b_id ELSE user_a_id END
    FROM public.couples WHERE (user_a_id = auth.uid() OR user_b_id = auth.uid()) AND status = 'active'
  ));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Couples: members only
CREATE POLICY "couples_select" ON public.couples FOR SELECT
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());
CREATE POLICY "couples_insert" ON public.couples FOR INSERT
  WITH CHECK (user_a_id = auth.uid() OR user_b_id = auth.uid());
CREATE POLICY "couples_update" ON public.couples FOR UPDATE
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- Shared couple tables (waste, playlists, nudges)
-- Inventory: couple items OR personal solo items
CREATE POLICY "inventory_access" ON public.inventory_items FOR ALL
  USING (
    (couple_id IS NOT NULL AND couple_id = public.my_couple_id())
    OR
    (couple_id IS NULL AND added_by_user_id = auth.uid())
  );
CREATE POLICY "waste_couple_access" ON public.waste_logs FOR ALL
  USING (couple_id = public.my_couple_id());
CREATE POLICY "playlists_couple_access" ON public.saved_playlists FOR ALL
  USING (couple_id = public.my_couple_id());
CREATE POLICY "nudges_couple_access" ON public.nudges FOR ALL
  USING (couple_id = public.my_couple_id());

-- Individual tables (meal_logs, weight_logs, health_data, daily_summaries)
-- Own row + partner's shared rows
CREATE POLICY "meal_logs_select" ON public.meal_logs FOR SELECT
  USING (user_id = auth.uid() OR (couple_id = public.my_couple_id() AND is_shared = TRUE));
CREATE POLICY "meal_logs_insert" ON public.meal_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "meal_logs_update" ON public.meal_logs FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "meal_logs_delete" ON public.meal_logs FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "weight_logs_select" ON public.weight_logs FOR SELECT
  USING (user_id = auth.uid() OR user_id IN (
    SELECT CASE WHEN user_a_id = auth.uid() THEN user_b_id ELSE user_a_id END
    FROM public.couples WHERE (user_a_id = auth.uid() OR user_b_id = auth.uid()) AND status = 'active'
  ));
CREATE POLICY "weight_logs_insert" ON public.weight_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "weight_logs_update" ON public.weight_logs FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "health_data_own" ON public.health_data FOR ALL USING (user_id = auth.uid());

CREATE POLICY "daily_summaries_select" ON public.daily_summaries FOR SELECT
  USING (user_id = auth.uid() OR couple_id = public.my_couple_id());
CREATE POLICY "daily_summaries_upsert" ON public.daily_summaries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "daily_summaries_update" ON public.daily_summaries FOR UPDATE USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- TRIGGERS (auto-update updated_at)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at    BEFORE UPDATE ON public.profiles    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER inventory_updated_at   BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER meal_logs_updated_at   BEFORE UPDATE ON public.meal_logs    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER daily_summaries_updated_at BEFORE UPDATE ON public.daily_summaries FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Auto-create profile on auth sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ════════════════════════════════════════════════════════════
-- INDEXES for common queries
-- ════════════════════════════════════════════════════════════

CREATE INDEX idx_meal_logs_user_date       ON public.meal_logs(user_id, logged_at DESC);
CREATE INDEX idx_meal_logs_couple          ON public.meal_logs(couple_id, logged_at DESC);
CREATE INDEX idx_weight_logs_user_date     ON public.weight_logs(user_id, logged_at DESC);
CREATE INDEX idx_inventory_couple          ON public.inventory_items(couple_id, expiry_date);
CREATE INDEX idx_daily_summaries_user_date ON public.daily_summaries(user_id, summary_date DESC);
CREATE INDEX idx_daily_summaries_couple    ON public.daily_summaries(couple_id, summary_date DESC);
CREATE INDEX idx_health_data_user_date     ON public.health_data(user_id, data_date DESC);
CREATE INDEX idx_waste_logs_couple_date    ON public.waste_logs(couple_id, logged_date DESC);

-- Realtime subscriptions (enable for shared tables)
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_summaries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waste_logs;
