import type { DataSource } from "typeorm";

let ensurePromise: Promise<void> | null = null;

export async function ensureCrawlSchema(ds: DataSource): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      // Create source table
      await ds.query(`
        CREATE TABLE IF NOT EXISTS source (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          base_url TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await ds.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ux_source_base ON source(base_url)`
      );

      // Mapping table for series
      await ds.query(`
        CREATE TABLE IF NOT EXISTS series_source_map (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_id UUID NOT NULL REFERENCES source(id) ON DELETE CASCADE,
          ext_series_id TEXT NOT NULL,
          series_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
          ext_url TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (source_id, ext_series_id)
        )
      `);

      // Mapping table for chapters
      await ds.query(`
        CREATE TABLE IF NOT EXISTS chapter_source_map (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_id UUID NOT NULL REFERENCES source(id) ON DELETE CASCADE,
          ext_chapter_id TEXT NOT NULL,
          chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
          ext_url TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (source_id, ext_chapter_id)
        )
      `);
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}
