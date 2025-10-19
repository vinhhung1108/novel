-- 020b_fix_bad_slugs.sql
-- Mục tiêu: Chuẩn hoá slug -> [a-z0-9-], lower-case, không trống, không trùng.
-- Nếu trùng sau khi chuẩn hoá, thêm hậu tố -1, -2, ...

WITH cleaned AS (
  SELECT
    id,
    slug,

    -- 1) lower-case + thay mọi ký tự không hợp lệ thành '-'
    regexp_replace(
      lower(coalesce(slug, '')),
      '[^a-z0-9-]+',
      '-',
      'g'
    ) AS s1
  FROM public.novels
),
collapse_dash AS (
  SELECT
    id,
    slug,
    -- 2) gộp nhiều '-' liên tiếp thành một '-'
    regexp_replace(s1, '-{2,}', '-', 'g') AS s2
  FROM cleaned
),
trim_dash AS (
  SELECT
    id,
    slug,
    -- 3) bỏ '-' ở đầu/cuối
    regexp_replace(s2, '(^-+)|(-+$)', '', 'g') AS base
  FROM collapse_dash
),
ensure_nonempty AS (
  SELECT
    id,
    slug,
    -- 4) nếu rỗng sau khi chuẩn hoá -> đặt mặc định theo id để luôn unique
    CASE
      WHEN base ~ '^[a-z0-9-]+$' AND base <> '' THEN base
      ELSE 'novel-' || substr(replace(id::text, '-', ''), 1, 8)
    END AS safe
  FROM trim_dash
),
dedup AS (
  SELECT
    id,
    safe,
    -- 5) đánh số nếu trùng
    row_number() OVER (PARTITION BY safe ORDER BY id) AS rn
  FROM ensure_nonempty
),
final AS (
  SELECT
    id,
    CASE
      WHEN rn = 1 THEN safe
      ELSE safe || '-' || (rn - 1)
    END AS new_slug
  FROM dedup
)
-- 6) Cập nhật slug nếu khác hiện tại
UPDATE public.novels n
SET slug = f.new_slug
FROM final f
WHERE n.id = f.id
  AND n.slug IS DISTINCT FROM f.new_slug;
