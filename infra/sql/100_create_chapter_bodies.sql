-- infra/sql/100_create_chapter_bodies.sql
-- Tách nội dung chương ra bảng riêng, partition HASH theo novel_id
-- Lần chạy trước lỗi -> không có bảng; file này idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'chapter_bodies') THEN
    CREATE TABLE public.chapter_bodies (
      chapter_id   UUID NOT NULL,
      novel_id     UUID NOT NULL,
      content_html TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      -- PK phải chứa cột partition key (novel_id)
      CONSTRAINT chapter_bodies_pkey PRIMARY KEY (chapter_id, novel_id),
      CONSTRAINT fk_chapter_bodies_chapter
        FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE
    ) PARTITION BY HASH (novel_id);
  END IF;
END$$;

-- Tạo 32 partitions
DO $$
DECLARE i int;
BEGIN
  FOR i IN 0..31 LOOP
    EXECUTE format('
      CREATE TABLE IF NOT EXISTS public.chapter_bodies_p%1$s
      PARTITION OF public.chapter_bodies
      FOR VALUES WITH (MODULUS 32, REMAINDER %1$s);', i);
  END LOOP;
END$$;

-- Index phụ (non-unique) để tra cứu theo chapter_id nhanh
CREATE INDEX IF NOT EXISTS idx_chapter_bodies_chapter ON public.chapter_bodies (chapter_id);

-- Index theo novel_id (truy vấn theo truyện)
CREATE INDEX IF NOT EXISTS idx_chapter_bodies_novel ON public.chapter_bodies (novel_id);
