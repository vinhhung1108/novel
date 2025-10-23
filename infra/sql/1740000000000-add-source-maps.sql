-- ========= series_source_map =========
CREATE TABLE IF NOT EXISTS series_source_map (
  source_id      uuid NOT NULL,
  ext_series_id  text NOT NULL,
  novel_id       uuid NOT NULL,
  url            text NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_series_source_map_src_ext UNIQUE (source_id, ext_series_id)
);

-- ========= chapter_source_map =========
CREATE TABLE IF NOT EXISTS chapter_source_map (
  source_id       uuid NOT NULL,
  ext_chapter_id  text NOT NULL,
  chapter_id      uuid NOT NULL,
  novel_id        uuid NOT NULL,
  index_no        int  NOT NULL,
  url             text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_chapter_source_map_src_ext UNIQUE (source_id, ext_chapter_id)
);

-- ========= optional performance indexes =========
CREATE INDEX IF NOT EXISTS idx_chapters_novel ON chapters (novel_id);
CREATE INDEX IF NOT EXISTS idx_novels_author ON novels (author_id);
