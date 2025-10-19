BEGIN;

-- 1) Bảng categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tên duy nhất (khuyến khích thêm unique tuỳ bạn)
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_name ON public.categories (lower(name));

-- 2) Bảng nối novel_categories (many-to-many)
CREATE TABLE IF NOT EXISTS public.novel_categories (
  novel_id UUID NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (novel_id, category_id)
);

-- Index phụ trợ
CREATE INDEX IF NOT EXISTS idx_novel_categories_category ON public.novel_categories (category_id);

COMMIT;
