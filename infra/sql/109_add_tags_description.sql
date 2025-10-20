BEGIN;

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS description text;

COMMIT;