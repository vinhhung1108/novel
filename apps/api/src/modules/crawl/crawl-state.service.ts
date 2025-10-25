import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

type RunType = "category" | "series";

@Injectable()
export class CrawlStateService {
  private readonly logger = new Logger(CrawlStateService.name);
  private initPromise?: Promise<void>;

  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private ensureReady() {
    if (!this.initPromise) {
      this.initPromise = this.setup();
    }
    return this.initPromise;
  }

  private async setup() {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crawl_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL,
        source_identifier TEXT NOT NULL,
        source_name TEXT,
        run_type TEXT NOT NULL,
        context JSONB,
        status TEXT NOT NULL DEFAULT 'running',
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ,
        queued_series INTEGER NOT NULL DEFAULT 0,
        queued_chapters INTEGER NOT NULL DEFAULT 0,
        completed_series INTEGER NOT NULL DEFAULT 0,
        completed_chapters INTEGER NOT NULL DEFAULT 0,
        failed_jobs INTEGER NOT NULL DEFAULT 0
      );
    `);

    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_crawl_runs_started_at
        ON crawl_runs (started_at DESC);
    `);

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS crawl_series_state (
        source_id UUID NOT NULL,
        ext_series_id TEXT NOT NULL,
        last_chapter_index INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (source_id, ext_series_id)
      );
    `);
  }

  async createRun(params: {
    sourceId: string;
    sourceIdentifier: string;
    sourceName?: string | null;
    type: RunType;
    context?: any;
    queuedSeries?: number;
  }): Promise<{ id: string }> {
    await this.ensureReady();
    const rows = await this.db.query(
      `
      INSERT INTO crawl_runs (
        source_id,
        source_identifier,
        source_name,
        run_type,
        context,
        queued_series
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
    `,
      [
        params.sourceId,
        params.sourceIdentifier,
        params.sourceName ?? null,
        params.type,
        params.context ? JSON.stringify(params.context) : null,
        params.queuedSeries ?? 0,
      ]
    );
    return { id: rows?.[0]?.id };
  }

  async listRuns(limit = 20) {
    await this.ensureReady();
    const rows = await this.db.query(
      `
      SELECT id, source_id, source_identifier, source_name, run_type,
             status, started_at, finished_at,
             queued_series, completed_series,
             queued_chapters, completed_chapters,
             failed_jobs, context
        FROM crawl_runs
       ORDER BY started_at DESC
       LIMIT $1
    `,
      [Math.max(1, Math.min(100, limit))]
    );
    return rows;
  }

  async incrementQueuedSeries(runId: string, delta: number) {
    if (!runId || !delta) return;
    await this.ensureReady();
    await this.db.query(
      `
      UPDATE crawl_runs
         SET queued_series = queued_series + $2
       WHERE id = $1
    `,
      [runId, delta]
    );
  }

  async incrementQueuedChapters(runId: string, delta: number) {
    if (!runId || !delta) return;
    await this.ensureReady();
    await this.db.query(
      `
      UPDATE crawl_runs
         SET queued_chapters = queued_chapters + $2
       WHERE id = $1
    `,
      [runId, delta]
    );
  }

  async incrementCompletedSeries(runId: string, delta = 1) {
    if (!runId || !delta) return;
    await this.ensureReady();
    await this.db.query(
      `
      UPDATE crawl_runs
         SET completed_series = completed_series + $2
       WHERE id = $1
    `,
      [runId, delta]
    );
    await this.maybeComplete(runId);
  }

  async incrementCompletedChapters(runId: string, delta = 1) {
    if (!runId || !delta) return;
    await this.ensureReady();
    await this.db.query(
      `
      UPDATE crawl_runs
         SET completed_chapters = completed_chapters + $2
       WHERE id = $1
    `,
      [runId, delta]
    );
    await this.maybeComplete(runId);
  }

  async incrementFailedJobs(runId: string, delta = 1) {
    if (!runId || !delta) return;
    await this.ensureReady();
    await this.db.query(
      `
      UPDATE crawl_runs
         SET failed_jobs = failed_jobs + $2,
             status = 'failed',
             finished_at = COALESCE(finished_at, now())
       WHERE id = $1
    `,
      [runId, delta]
    );
  }

  private async maybeComplete(runId: string) {
    await this.db.query(
      `
      UPDATE crawl_runs
         SET status = 'completed',
             finished_at = COALESCE(finished_at, now())
       WHERE id = $1
         AND status = 'running'
         AND queued_series <= completed_series
         AND queued_chapters <= completed_chapters
    `,
      [runId]
    );
  }

  async getSeriesLastIndex(
    sourceId: string,
    extSeriesId: string
  ): Promise<number | null> {
    await this.ensureReady();
    const rows = await this.db.query(
      `
      SELECT last_chapter_index
        FROM crawl_series_state
       WHERE source_id = $1 AND ext_series_id = $2
      LIMIT 1
    `,
      [sourceId, extSeriesId]
    );
    const val = rows?.[0]?.last_chapter_index;
    return typeof val === "number" ? val : null;
  }

  async updateSeriesLastIndex(
    sourceId: string,
    extSeriesId: string,
    index: number
  ) {
    if (!Number.isFinite(index)) return;
    await this.ensureReady();
    await this.db.query(
      `
      INSERT INTO crawl_series_state (source_id, ext_series_id, last_chapter_index)
      VALUES ($1, $2, $3)
      ON CONFLICT (source_id, ext_series_id) DO UPDATE
        SET last_chapter_index = GREATEST(crawl_series_state.last_chapter_index, EXCLUDED.last_chapter_index),
            updated_at = now()
    `,
      [sourceId, extSeriesId, index]
    );
  }
}
