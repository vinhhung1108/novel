-- infra/sql/104b_migrate_novel_views_partition.sql
DO $$
DECLARE
  exists_tbl      boolean;
  is_partitioned  boolean;
  has_created     boolean;
  min_date        date;
  max_date        date;
  start_month     date;
  end_month       date;
  cur_month       date;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace AND relname='novel_views'
  ) INTO exists_tbl;

  IF NOT exists_tbl THEN
    -- (1) Chưa có bảng: tạo parent partitioned
    EXECUTE $sql$
      CREATE TABLE public.novel_views (
        id BIGSERIAL NOT NULL,
        novel_id UUID NOT NULL,
        view_date DATE NOT NULL,
        views INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT novel_views_pkey PRIMARY KEY (id, view_date)
      ) PARTITION BY RANGE (view_date)
    $sql$;

    -- tạo 24 tháng tới
    start_month := date_trunc('month', current_date)::date;
    end_month   := (start_month + INTERVAL '24 months')::date;

    cur_month := start_month;
    WHILE cur_month < end_month LOOP
      EXECUTE format($f$
        CREATE TABLE IF NOT EXISTS public.novel_views_%s
        PARTITION OF public.novel_views
        FOR VALUES FROM (%L) TO (%L)
      $f$, to_char(cur_month, 'YYYYMM'), cur_month, (cur_month + INTERVAL '1 month')::date);
      cur_month := (cur_month + INTERVAL '1 month')::date;
    END LOOP;

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_novel_views_novel_date ON public.novel_views (novel_id, view_date)';
    RAISE NOTICE 'Created partitioned novel_views with future monthly partitions.';
    RETURN;
  END IF;

  -- Tồn tại bảng 'novel_views' -> kiểm tra đã partitioned chưa
  SELECT EXISTS (
    SELECT 1 FROM pg_partitioned_table WHERE partrelid='public.novel_views'::regclass
  ) INTO is_partitioned;

  IF NOT is_partitioned THEN
    -- (2) Đang là bảng thường: migrate sang partitioned

    -- Dải ngày hiện có
    EXECUTE 'SELECT COALESCE(min(view_date), current_date), COALESCE(max(view_date), current_date)
             FROM public.novel_views'
      INTO min_date, max_date;

    start_month := date_trunc('month', min_date)::date;
    end_month   := (date_trunc('month', max_date)::date + INTERVAL '2 months')::date;

    -- Tạo parent mới
    EXECUTE $sql$
      CREATE TABLE public.novel_views_new (
        id BIGSERIAL NOT NULL,
        novel_id UUID NOT NULL,
        view_date DATE NOT NULL,
        views INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT novel_views_new_pkey PRIMARY KEY (id, view_date)
      ) PARTITION BY RANGE (view_date)
    $sql$;

    -- Partitions bao trùm dải dữ liệu
    cur_month := start_month;
    WHILE cur_month < end_month LOOP
      EXECUTE format($f$
        CREATE TABLE IF NOT EXISTS public.novel_views_%s
        PARTITION OF public.novel_views_new
        FOR VALUES FROM (%L) TO (%L)
      $f$, to_char(cur_month, 'YYYYMM'), cur_month, (cur_month + INTERVAL '1 month')::date);
      cur_month := (cur_month + INTERVAL '1 month')::date;
    END LOOP;

    -- Bảng cũ có created_at không?
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='novel_views' AND column_name='created_at'
    ) INTO has_created;

    -- 🔁 COPY DỮ LIỆU — KHÔNG COPY ID, để BIGSERIAL tự sinh
    IF has_created THEN
      EXECUTE $sql$
        INSERT INTO public.novel_views_new (novel_id, view_date, views, created_at)
        SELECT o.novel_id, o.view_date, o.views, o.created_at
        FROM public.novel_views o
      $sql$;
    ELSE
      EXECUTE $sql$
        INSERT INTO public.novel_views_new (novel_id, view_date, views, created_at)
        SELECT o.novel_id, o.view_date, o.views, now()
        FROM public.novel_views o
      $sql$;
    END IF;

    -- Swap
    EXECUTE 'ALTER TABLE public.novel_views RENAME TO novel_views_old';
    EXECUTE 'ALTER TABLE public.novel_views_new RENAME TO novel_views';

    -- Index
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_novel_views_novel_date ON public.novel_views (novel_id, view_date)';

    RAISE NOTICE 'Migrated novel_views to partitioned table (range by month).';

    -- (tuỳ chọn) xoá bảng cũ
    -- EXECUTE 'DROP TABLE IF EXISTS public.novel_views_old';

  ELSE
    -- (3) Đã partitioned: bổ sung partitions 24 tháng tới
    start_month := date_trunc('month', current_date)::date;
    end_month   := (start_month + INTERVAL '24 months')::date;

    cur_month := start_month;
    WHILE cur_month < end_month LOOP
      EXECUTE format($f$
        CREATE TABLE IF NOT EXISTS public.novel_views_%s
        PARTITION OF public.novel_views
        FOR VALUES FROM (%L) TO (%L)
      $f$, to_char(cur_month, 'YYYYMM'), cur_month, (cur_month + INTERVAL '1 month')::date);
      cur_month := (cur_month + INTERVAL '1 month')::date;
    END LOOP;

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_novel_views_novel_date ON public.novel_views (novel_id, view_date)';
    RAISE NOTICE 'Added future monthly partitions for existing partitioned novel_views.';
  END IF;
END$$;
