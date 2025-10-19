-- infra/sql/104c_reset_novel_views_partition.sql
-- Reset sạch bảng novel_views và tạo lại dạng RANGE PARTITION theo tháng (view_date)

DO $$
DECLARE
  start_month date;
  end_month   date;
  cur_month   date;
BEGIN
  -- Xoá bảng cũ (và các bản cũ nếu có) — CẨN THẬN: MẤT DỮ LIỆU
  EXECUTE 'DROP TABLE IF EXISTS public.novel_views_old CASCADE';
  EXECUTE 'DROP TABLE IF EXISTS public.novel_views CASCADE';

  -- Tạo parent partitioned
  EXECUTE $sql$
    CREATE TABLE public.novel_views (
      id BIGSERIAL NOT NULL,
      novel_id UUID NOT NULL,
      view_date DATE NOT NULL,
      views INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- PRIMARY KEY phải bao gồm cột partition key (view_date)
      CONSTRAINT novel_views_pkey PRIMARY KEY (id, view_date)
    ) PARTITION BY RANGE (view_date)
  $sql$;

  -- Tạo partitions theo tháng: từ đầu tháng hiện tại - 1 tháng đến + 24 tháng
  start_month := (date_trunc('month', current_date)::date - INTERVAL '1 month')::date;
  end_month   := (date_trunc('month', current_date)::date + INTERVAL '24 months')::date;

  cur_month := start_month;
  WHILE cur_month < end_month LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS public.novel_views_%s
      PARTITION OF public.novel_views
      FOR VALUES FROM (%L) TO (%L)
    $f$, to_char(cur_month, 'YYYYMM'), cur_month, (cur_month + INTERVAL '1 month')::date);
    cur_month := (cur_month + INTERVAL '1 month')::date;
  END LOOP;

  -- Index phục vụ truy vấn series & top
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_novel_views_novel_date ON public.novel_views (novel_id, view_date)';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_novel_views_date ON public.novel_views (view_date)';

  RAISE NOTICE 'Reset novel_views hoàn tất (partitioned by month).';
END$$;
