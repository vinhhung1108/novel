DO $$
BEGIN
  -- Unique phải gồm cột partition key (view_date)
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_novel_views_novel_date'
  ) THEN
    CREATE UNIQUE INDEX uq_novel_views_novel_date
      ON public.novel_views (novel_id, view_date);
  END IF;
END $$;
