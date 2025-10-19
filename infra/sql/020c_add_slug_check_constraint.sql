-- 020c_add_slug_check_constraint.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'novels_slug_format_ck'
      AND conrelid = 'public.novels'::regclass
  ) THEN
    ALTER TABLE public.novels
      DROP CONSTRAINT novels_slug_format_ck;
  END IF;

  ALTER TABLE public.novels
    ADD CONSTRAINT novels_slug_format_ck
    CHECK (slug ~ '^[a-z0-9-]+$' AND slug = lower(slug));
END$$;
