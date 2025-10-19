CREATE EXTENSION IF NOT EXISTS pg_trgm;


CREATE TABLE IF NOT EXISTS authors (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name text NOT NULL,
slug text UNIQUE NOT NULL,
description text
);


CREATE TABLE IF NOT EXISTS tags (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
name text NOT NULL,
slug text UNIQUE NOT NULL,
type text NOT NULL DEFAULT 'tag'
);


CREATE TABLE IF NOT EXISTS novels (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
title text NOT NULL,
slug text UNIQUE NOT NULL,
description text,
cover_image_key text,
status text NOT NULL DEFAULT 'ongoing',
source text NOT NULL DEFAULT 'local',
source_url text,
author_id uuid REFERENCES authors(id),
rating_avg real NOT NULL DEFAULT 0,
rating_count int NOT NULL DEFAULT 0,
views bigint NOT NULL DEFAULT 0,
words_count bigint NOT NULL DEFAULT 0,
published_at timestamptz,
updated_at timestamptz DEFAULT now()
);


CREATE TABLE IF NOT EXISTS novel_tags (
novel_id uuid REFERENCES novels(id) ON DELETE CASCADE,
tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
PRIMARY KEY(novel_id, tag_id)
);


CREATE TABLE IF NOT EXISTS chapters (
id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
novel_id uuid REFERENCES novels(id) ON DELETE CASCADE,
index_no int NOT NULL CHECK (index_no >= 1),
title text NOT NULL,
slug text,
content text,
words_count int NOT NULL DEFAULT 0,
views bigint NOT NULL DEFAULT 0,
checksum text UNIQUE,
published_at timestamptz,
updated_at timestamptz DEFAULT now(),
UNIQUE(novel_id, index_no)
);


CREATE INDEX IF NOT EXISTS idx_chapters_novel_slug ON chapters(novel_id, slug);
CREATE INDEX IF NOT EXISTS idx_novels_popular ON novels(rating_avg DESC, rating_count DESC, views DESC);