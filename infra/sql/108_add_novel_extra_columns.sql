BEGIN;

ALTER TABLE public.novels
  ADD COLUMN IF NOT EXISTS original_title   text,
  ADD COLUMN IF NOT EXISTS alt_titles       text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS language_code    varchar(10),
  ADD COLUMN IF NOT EXISTS is_featured      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mature           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority         integer NOT NULL DEFAULT 0;

COMMIT;