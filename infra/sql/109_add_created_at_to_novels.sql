BEGIN;

ALTER TABLE public.novels
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- đảm bảo cũng có updated_at nếu entity có trường này
ALTER TABLE public.novels
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMIT;