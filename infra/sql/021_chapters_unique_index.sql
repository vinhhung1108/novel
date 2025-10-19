-- 021_chapters_unique_index.sql
-- Mục tiêu: Mỗi chương trong một truyện có index_no duy nhất.

-- Nếu chưa có khóa ngoại, (tùy) bạn có thể bật:
-- DO $$
-- BEGIN
--   IF NOT EXISTS (
--     SELECT 1 FROM pg_constraint
--     WHERE conname = 'chapters_novel_id_fkey'
--   ) THEN
--     ALTER TABLE public.chapters
--       ADD CONSTRAINT chapters_novel_id_fkey
--       FOREIGN KEY (novel_id) REFERENCES public.novels(id) ON DELETE CASCADE;
--   END IF;
-- END$$;

-- Unique index theo (novel_id, index_no) — dùng CONCURRENTLY để an toàn khi bảng lớn
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_chapters_novel_index_unique
  ON public.chapters (novel_id, index_no);

-- (Tùy chọn) Convert index → constraint (không bắt buộc)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chapters_novel_index_unique'
      AND conrelid = 'public.chapters'::regclass
  ) THEN
    ALTER TABLE public.chapters
      ADD CONSTRAINT chapters_novel_index_unique
      UNIQUE USING INDEX idx_chapters_novel_index_unique;
  END IF;
END$$;

-- Tham khảo: tìm trùng lặp (nếu có)
-- SELECT novel_id, index_no, COUNT(*)
-- FROM public.chapters
-- GROUP BY novel_id, index_no
-- HAVING COUNT(*) > 1;
