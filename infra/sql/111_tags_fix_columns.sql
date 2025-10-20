BEGIN;

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.tags
  ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_tags_slug'
  ) THEN
    CREATE UNIQUE INDEX uq_tags_slug ON public.tags (slug);
  END IF;
END $$;

COMMIT;
