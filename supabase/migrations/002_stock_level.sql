-- Add stock level tracking to inventory items.
-- abundant = plenty in stock (green)
-- low      = running low (yellow)
-- out      = need to buy (red)

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS stock_level TEXT
  CHECK (stock_level IN ('abundant', 'low', 'out'))
  DEFAULT 'abundant';
