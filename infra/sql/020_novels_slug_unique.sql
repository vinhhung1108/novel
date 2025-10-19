-- 020_novels_slug_unique.sql
-- Mục tiêu:
--  1) Chuẩn hóa: slug về lowercase và NOT NULL
--  2) Unique theo slug
--  3) Check format slug: ^[a-z0-9-]+$ và slug = lower(slug)

-- (A) CHUẨN HÓA DỮ LIỆU HIỆN CÓ
-- Lưu ý: nếu đang có duplicate slug, bước (C) sẽ lỗi.
UPDATE public.novels SET slug = lower(slug) WHERE slug IS NOT NULL;

-- Bắt buộc cột slug phải có giá trị
ALTER TABLE public.novels
  ALTER COLUMN slug SET NOT NULL;

-- (B) UNIQUE INDEX (CONCURRENTLY) — KHÔNG ĐƯỢC đặt trong transaction
-- Tạo unique index nếu chưa có (an toàn khi chạy lại)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_novels_slug_unique
  ON public.novels (slug);

-- (C) GẮN UNIQUE CONSTRAINT SỬ DỤNG INDEX (an toàn khi chạy lại)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'novels_slug_unique'
      AND conrelid = 'public.novels'::regclass
  ) THEN
    ALTER TABLE public.novels
      ADD CONSTRAINT novels_slug_unique UNIQUE USING INDEX idx_novels_slug_unique;
  END IF;
END$$;

-- (D) CHECK CONSTRAINT ĐỊNH DẠNG SLUG (lowercase + chỉ a-z0-9-)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'novels_slug_format_ck'
      AND conrelid = 'public.novels'::regclass
  ) THEN
    ALTER TABLE public.novels
      ADD CONSTRAINT novels_slug_format_ck
      CHECK (slug ~ '^[a-z0-9-]+$' AND slug = lower(slug));
  END IF;
END$$;

-- THAM KHẢO: kiểm tra duplicate trước khi chạy (nếu cần)
-- SELECT slug, COUNT(*) FROM public.novels GROUP BY slug HAVING COUNT(*) > 1;
