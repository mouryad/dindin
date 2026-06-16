-- Shared cuisine preference for couples.
-- Cuisine selection becomes a couple-level setting so both partners
-- always reference the same meal plan row, fixing realtime swipe-sync.

ALTER TABLE public.couples ADD COLUMN IF NOT EXISTS cuisine_pref TEXT NOT NULL DEFAULT 'any';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'couples'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.couples;
  END IF;
END $$;
