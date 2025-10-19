CREATE TABLE IF NOT EXISTS public.novel_views_rollup (
  novel_id UUID PRIMARY KEY,
  views_7d BIGINT NOT NULL DEFAULT 0,
  views_30d BIGINT NOT NULL DEFAULT 0,
  views_all BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Các câu lệnh UPDATE mẫu để cron (không chạy tự động ở đây)

-- 7 ngày
-- UPDATE public.novel_views_rollup r
-- SET views_7d = v.sum7, updated_at = now()
-- FROM (
--   SELECT novel_id, SUM(views) AS sum7
--   FROM public.novel_views
--   WHERE view_date >= (current_date - INTERVAL '6 days')
--   GROUP BY novel_id
-- ) v
-- WHERE r.novel_id = v.novel_id;

-- 30 ngày
-- UPDATE public.novel_views_rollup r
-- SET views_30d = v.sum30, updated_at = now()
-- FROM (
--   SELECT novel_id, SUM(views) AS sum30
--   FROM public.novel_views
--   WHERE view_date >= (current_date - INTERVAL '29 days')
--   GROUP BY novel_id
-- ) v
-- WHERE r.novel_id = v.novel_id;

-- all-time
-- UPDATE public.novel_views_rollup r
-- SET views_all = v.sumall, updated_at = now()
-- FROM (
--   SELECT novel_id, SUM(views) AS sumall
--   FROM public.novel_views
--   GROUP BY novel_id
-- ) v
-- WHERE r.novel_id = v.novel_id;

-- Upsert tiện dụng (đưa mới vào nếu chưa có)
-- INSERT INTO public.novel_views_rollup (novel_id, views_7d, views_30d, views_all)
-- SELECT novel_id, 0, 0, 0 FROM public.novels n
-- ON CONFLICT (novel_id) DO NOTHING;
