-- infra/sql/102_migrate_chapters_to_partition.sql
-- Migrate chapters -> partitioned (HASH by novel_id)
-- - PK (id, novel_id) để đáp ứng yêu cầu partitioned unique.
-- - Copy dữ liệu an toàn, tự phát hiện có/không có created_at/updated_at ở bảng nguồn.
-- - Update lại FK của chapter_bodies sang (chapter_id, novel_id).

DO $main$
DECLARE
  has_created  boolean;
  has_updated  boolean;
  created_expr text;
  updated_expr text;
  sql_insert   text;
BEGIN
  -- Bỏ qua nếu chapters đã là partitioned
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname='chapters' AND relkind='r')
     AND NOT EXISTS (SELECT 1 FROM pg_partitioned_table WHERE partrelid='chapters'::regclass) THEN

    -- Xoá tàn dư lần trước (nếu có)
    EXECUTE 'DROP TABLE IF EXISTS public.chapters_new CASCADE';

    -- 1) Tạo bảng partitioned mới
    EXECUTE $sql$
      CREATE TABLE public.chapters_new (
        id UUID NOT NULL,
        novel_id UUID NOT NULL,
        index_no INTEGER NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        slug TEXT NULL,
        checksum TEXT NULL,
        words_count INTEGER NOT NULL DEFAULT 0,
        views BIGINT NOT NULL DEFAULT 0,
        published_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chapters_new_pkey PRIMARY KEY (id, novel_id),
        CONSTRAINT chapters_new_novel_index_uk UNIQUE (novel_id, index_no)
      ) PARTITION BY HASH (novel_id)
    $sql$;

    -- 2) Tạo 32 partitions
    DO $p$
    DECLARE i int;
    BEGIN
      FOR i IN 0..31 LOOP
        EXECUTE format('
          CREATE TABLE IF NOT EXISTS public.chapters_new_p%1$s
          PARTITION OF public.chapters_new
          FOR VALUES WITH (MODULUS 32, REMAINDER %1$s);', i);
      END LOOP;
    END
    $p$;

    -- 3) Tự dò cột created_at / updated_at ở bảng nguồn public.chapters
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='chapters' AND column_name='created_at'
    ) INTO has_created;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='chapters' AND column_name='updated_at'
    ) INTO has_updated;

    created_expr := CASE WHEN has_created THEN 'COALESCE(c.created_at, now())' ELSE 'now()' END;
    updated_expr := CASE WHEN has_updated THEN 'COALESCE(c.updated_at, now())' ELSE 'now()' END;

    -- 4) Copy data từ bảng nguồn (định danh alias c. cho chắc)
    sql_insert := format($f$
      INSERT INTO public.chapters_new
        (id, novel_id, index_no, title, slug, checksum, words_count, views, published_at, created_at, updated_at)
      SELECT
        c.id,
        c.novel_id,
        c.index_no,
        c.title,
        c.slug,
        c.checksum,
        c.words_count,
        c.views,
        c.published_at,
        %s,
        %s
      FROM public.chapters c
    $f$, created_expr, updated_expr);

    EXECUTE sql_insert;

    -- 5) Swap tên
    EXECUTE 'ALTER TABLE public.chapters RENAME TO chapters_old';
    EXECUTE 'ALTER TABLE public.chapters_new RENAME TO chapters';

    -- 6) Indexes trên parent
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chapters_novel_index ON public.chapters (novel_id, index_no)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chapters_updated_at ON public.chapters (updated_at DESC, id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_chapters_id ON public.chapters (id)';

    -- 7) Cập nhật FK chapter_bodies -> chapters (composite)
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema='public' AND table_name='chapter_bodies'
        AND constraint_type='FOREIGN KEY'
        AND constraint_name='fk_chapter_bodies_chapter'
    ) THEN
      EXECUTE 'ALTER TABLE public.chapter_bodies DROP CONSTRAINT fk_chapter_bodies_chapter';
    END IF;

    EXECUTE $fk$
      ALTER TABLE public.chapter_bodies
      ADD CONSTRAINT fk_chapter_bodies_chapter
      FOREIGN KEY (chapter_id, novel_id)
      REFERENCES public.chapters(id, novel_id)
      ON DELETE CASCADE
    $fk$;

    RAISE NOTICE 'Chapters migrated to partitioned table. FK updated.';
  ELSE
    RAISE NOTICE 'Skip: chapters is already partitioned or not a regular table.';
  END IF;
END
$main$;
