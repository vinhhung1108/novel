DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='chapters' AND column_name='content'
  ) THEN
    ALTER TABLE public.chapters DROP COLUMN content;
  END IF;
END$$;
