-- infra/sql/101_backfill_chapter_bodies.sql
-- Di trú nội dung từ chapters.content -> chapter_bodies.content_html
-- An toàn: kiểm tra cột tồn tại trước khi sử dụng.

DO $$
DECLARE
  has_content  boolean;
  has_created  boolean;
  has_updated  boolean;
  created_expr text;
  updated_expr text;
  sql_insert   text;
BEGIN
  -- Có cột content không?
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='chapters'
      AND column_name='content'
  ) INTO has_content;

  IF NOT has_content THEN
    RAISE NOTICE 'Skip: public.chapters không có cột content, không cần backfill.';
    RETURN;
  END IF;

  -- Chương có cột created_at / updated_at không?
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

  -- Lưu ý: phải dùng alias c. cho các cột của chapters
  sql_insert := format($f$
    INSERT INTO public.chapter_bodies
      (chapter_id, novel_id, content_html, created_at, updated_at)
    SELECT
      c.id,
      c.novel_id,
      COALESCE(c.content, ''),
      %s,
      %s
    FROM public.chapters c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.chapter_bodies b
      WHERE b.chapter_id = c.id
    );
  $f$, created_expr, updated_expr);

  EXECUTE sql_insert;
  RAISE NOTICE 'Backfill chapter_bodies done.';
END$$;
