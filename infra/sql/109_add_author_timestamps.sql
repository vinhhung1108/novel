BEGIN;

-- Thêm cột nếu chưa tồn tại
ALTER TABLE public.authors
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Đảm bảo slug NOT NULL + UNIQUE (nếu chưa có)
ALTER TABLE public.authors
  ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_authors_slug'
  ) THEN
    CREATE UNIQUE INDEX uq_authors_slug ON public.authors (slug);
  END IF;
END $$;

COMMIT;