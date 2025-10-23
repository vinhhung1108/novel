import { MigrationInterface, QueryRunner } from "typeorm";

export class CrawlMapping1720000000000 implements MigrationInterface {
  name = "CrawlMapping1720000000000";

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS source (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ux_source_base UNIQUE (base_url)
      );
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS series_source_map (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL,
        ext_series_id TEXT NOT NULL,
        series_id UUID NOT NULL,
        ext_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ux_series_src UNIQUE (source_id, ext_series_id)
      );
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS chapter_source_map (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL,
        ext_chapter_id TEXT NOT NULL,
        chapter_id UUID NOT NULL,
        ext_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT ux_chapter_src UNIQUE (source_id, ext_chapter_id)
      );
    `);
    // Ghi chú: Tránh đặt FK vào chapter/novel ở đây để không đụng plural/singular.
    // Sau khi chốt schema, bạn có thể thêm ALTER TABLE ... ADD FOREIGN KEY ...
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS chapter_source_map`);
    await q.query(`DROP TABLE IF EXISTS series_source_map`);
    await q.query(`DROP TABLE IF EXISTS source`);
  }
}
