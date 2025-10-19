-- Bảng lượt xem theo ngày, partition theo tháng
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'novel_views') THEN
    CREATE TABLE public.novel_views (
      id BIGSERIAL PRIMARY KEY,
      novel_id UUID NOT NULL,
      view_date DATE NOT NULL,
      views INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    ) PARTITION BY RANGE (view_date);
  END IF;
END$$;

-- Tạo partition cho 24 tháng tới (có thể điều chỉnh)
DO $$
DECLARE y int := EXTRACT(YEAR FROM now());
DECLARE m int := EXTRACT(MONTH FROM now());
DECLARE i int;
DECLARE d1 date;
DECLARE d2 date;
DECLARE pname text;
BEGIN
  FOR i IN 0..23 LOOP
    d1 := make_date(y, m, 1) + (i || ' months')::interval;
    d2 := (d1 + INTERVAL '1 month')::date;
    pname := 'novel_views_' || to_char(d1, 'YYYYMM');
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS public.%I
      PARTITION OF public.novel_views
      FOR VALUES FROM (%L) TO (%L);', pname, d1::date, d2::date);
  END LOOP;
END$$;

CREATE INDEX IF NOT EXISTS idx_novel_views_novel_date ON public.novel_views (novel_id, view_date);
