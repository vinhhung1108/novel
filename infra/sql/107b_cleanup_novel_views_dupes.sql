-- DEDUPE + tạo unique index cho novel_views (partitioned theo month)
DO $$
BEGIN
  -- 1) Khóa bảng để tránh ghi chèn khi dọn
  LOCK TABLE public.novel_views IN EXCLUSIVE MODE;

  -- 2) Gom trùng (giữ tổng views) vào bảng tạm
  CREATE TEMP TABLE nv_dedup AS
  SELECT
    novel_id,
    view_date,
    SUM(views)::int AS views,
    MIN(created_at) AS created_at
  FROM public.novel_views
  GROUP BY novel_id, view_date;

  -- 3) Xoá sạch rồi nạp lại bản đã dedupe
  TRUNCATE TABLE public.novel_views;

  INSERT INTO public.novel_views (novel_id, view_date, views, created_at)
  SELECT novel_id, view_date, views, created_at
  FROM nv_dedup;

  -- 4) Tạo unique index (chỉ tạo nếu chưa tồn tại)
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
