import type { MigrationInterface, QueryRunner } from "typeorm";

export class CrawlMapping1720000000000 implements MigrationInterface {
  name = "CrawlMapping1720000000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE source (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX ux_source_base ON source(base_url);

      CREATE TABLE series_source_map (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL REFERENCES source(id) ON DELETE CASCADE,
        ext_series_id TEXT NOT NULL,
        series_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
        ext_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (source_id, ext_series_id)
      );

      CREATE TABLE chapter_source_map (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL REFERENCES source(id) ON DELETE CASCADE,
        ext_chapter_id TEXT NOT NULL,
        chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
        ext_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (source_id, ext_chapter_id)
      );
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS chapter_source_map`);
    await q.query(`DROP TABLE IF EXISTS series_source_map`);
    await q.query(`DROP TABLE IF EXISTS source`);
  }
}
