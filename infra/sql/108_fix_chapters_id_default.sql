DO $$
BEGIN
  -- đảm bảo có extension để dùng gen_random_uuid()
  PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
  IF NOT FOUND THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;

  -- đặt DEFAULT cho cột id trên bảng partitioned parent
  EXECUTE $DDL$
    ALTER TABLE public.chapters
    ALTER COLUMN id SET DEFAULT gen_random_uuid()
  $DDL$;
END
$$;
