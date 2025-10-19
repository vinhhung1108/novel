-- Bảng đếm lượt xem theo ngày
CREATE TABLE IF NOT EXISTS public.novel_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  view_date DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS novel_views_unique ON public.novel_views (novel_id, view_date);
CREATE INDEX IF NOT EXISTS novel_views_date_idx ON public.novel_views (view_date DESC);
