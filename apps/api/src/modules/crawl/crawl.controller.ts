import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { DataSource } from "typeorm";
import { CrawlHttpService } from "./http.service";
import { resolveAdapter, AdapterResolveContext } from "./adapters";
import { CHAPTER_QUEUE, SERIES_QUEUE } from "./constants";
import { CrawlStateService } from "./crawl-state.service";

type SourceRecord = {
  id: string;
  name: string;
  base_url: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type QueueStats = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
};

@Controller("crawl")
export class CrawlController {
  constructor(
    @InjectQueue(SERIES_QUEUE) private readonly seriesQ: Queue,
    @InjectQueue(CHAPTER_QUEUE) private readonly chapterQ: Queue,
    private readonly http: CrawlHttpService,
    private readonly state: CrawlStateService,
    private readonly ds: DataSource
  ) {}

  private async resolveSource(identifier: string): Promise<SourceRecord> {
    const raw = identifier.trim();
    if (!raw) throw new BadRequestException("source_id required");
    let row: SourceRecord | undefined;

    if (UUID_RE.test(raw)) {
      const rows: SourceRecord[] = await this.ds.query(
        `
        SELECT id, name, base_url
        FROM source
        WHERE id = $1
        LIMIT 1
      `,
        [raw]
      );
      row = rows[0];
    }

    if (!row) {
      const lc = raw.toLowerCase();
      const like = `%${lc}%`;
      const rows: SourceRecord[] = await this.ds.query(
        `
        SELECT id, name, base_url
        FROM source
        WHERE lower(name) = $1
           OR lower(base_url) = $1
           OR lower(base_url) LIKE $2
        ORDER BY created_at DESC
        LIMIT 1
      `,
        [lc, like]
      );
      row = rows[0];
    }

    if (!row) {
      throw new BadRequestException(
        `source not found for identifier "${identifier}"`
      );
    }

    return row;
  }

  private makeAdapterContext(
    source: SourceRecord,
    identifier: string
  ): AdapterResolveContext {
    return {
      sourceId: source.id,
      sourceName: source.name,
      baseUrl: source.base_url,
      identifier,
    };
  }

  /** Seed từ 1 trang thể loại: gom link series & enqueue parse-series-page */
  @Post("seed-category")
  async seedCategory(
    @Body()
    body: {
      source_id: string;
      url: string;
      limit?: number; // mặc định 10, tối đa 50
    }
  ) {
    const { source_id: sourceInput, url } = body || {};
    const limit = Math.max(1, Math.min(50, Number(body?.limit ?? 10)));

    if (!sourceInput?.trim())
      throw new BadRequestException("source_id required");
    if (!url?.trim()) throw new BadRequestException("url required");

    const source = await this.resolveSource(sourceInput);
    const adapter = resolveAdapter(
      this.makeAdapterContext(source, sourceInput)
    );

    const html = await this.http.fetchHtml(url);
    const { seriesUrls } = adapter.extractCategory(html, url);

    const pick = seriesUrls.slice(0, limit);
    const run = await this.state.createRun({
      sourceId: source.id,
      sourceIdentifier: url,
      sourceName: source.name,
      type: "category",
      context: { url, limit },
      queuedSeries: pick.length,
    });

    for (const link of pick) {
      await this.seriesQ.add(
        "parse-series-page",
        {
          source_id: source.id,
          url: link,
          source_meta: { name: source.name, base_url: source.base_url },
          run_id: run.id,
        },
        { attempts: 2, backoff: { type: "exponential", delay: 1000 } }
      );
    }

    return {
      ok: true,
      enqueued: pick.length,
      found: seriesUrls.length,
      run_id: run.id,
    };
  }

  private async queueStats(queue: Queue): Promise<QueueStats> {
    const [waiting, active, delayed, failed, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      queue.getFailedCount(),
      queue.getCompletedCount(),
    ]);
    return { waiting, active, delayed, failed, completed };
  }

  /** (Tiện debug) Thống kê queue */
  @Get("queue-stats")
  async stats() {
    const [series, chapters] = await Promise.all([
      this.queueStats(this.seriesQ),
      this.queueStats(this.chapterQ),
    ]);
    const aggregate: QueueStats = {
      waiting: series.waiting + chapters.waiting,
      active: series.active + chapters.active,
      delayed: series.delayed + chapters.delayed,
      failed: series.failed + chapters.failed,
      completed: series.completed + chapters.completed,
    };
    return { ...aggregate, breakdown: { series, chapters } };
  }

  private serializeJob(job: Job) {
    return {
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      progress: typeof job.progress === "number" ? job.progress : null,
      failedReason: job.failedReason ?? null,
      stacktrace: job.stacktrace ?? [],
      data: job.data,
      returnValue: job.returnvalue ?? null,
      queue: job.queueName,
    };
  }

  private sortJobsByRecent(jobs: Job[]): Job[] {
    return [...jobs].sort((a, b) => {
      const timeA =
        a.finishedOn ?? a.processedOn ?? a.timestamp ?? 0;
      const timeB =
        b.finishedOn ?? b.processedOn ?? b.timestamp ?? 0;
      return timeB - timeA;
    });
  }

  /** (Tiện debug) Liệt kê job fail gần nhất */
  @Get("failed")
  async failed(@Query("take") takeQ?: string) {
    const take = Math.min(20, Math.max(1, Number(takeQ) || 10));
    const [seriesFailed, chapterFailed] = await Promise.all([
      this.seriesQ.getFailed(0, take - 1),
      this.chapterQ.getFailed(0, take - 1),
    ]);
    const combined = this.sortJobsByRecent([
      ...seriesFailed,
      ...chapterFailed,
    ]).slice(0, take);
    return combined.map((j) => ({
      id: j.id,
      name: j.name,
      attemptsMade: j.attemptsMade,
      failedReason: j.failedReason,
      stack: j.stacktrace?.[0],
      data: j.data,
      queue: j.queueName,
    }));
  }

  @Get("jobs")
  async jobs(@Query("limit") limitQ?: string) {
    const limit = Math.min(50, Math.max(1, Number(limitQ) || 10));
    const queues = [this.seriesQ, this.chapterQ];

    const bucket: Record<
      "waiting" | "active" | "delayed" | "failed" | "completed",
      Job[]
    > = {
      waiting: [],
      active: [],
      delayed: [],
      failed: [],
      completed: [],
    };

    await Promise.all(
      queues.map(async (queue) => {
        const [waiting, active, delayed, failed, completed] = await Promise.all(
          [
            queue.getWaiting(0, limit - 1),
            queue.getActive(0, limit - 1),
            queue.getDelayed(0, limit - 1),
            queue.getFailed(0, limit - 1),
            queue.getCompleted(0, limit - 1),
          ]
        );
        bucket.waiting.push(...waiting);
        bucket.active.push(...active);
        bucket.delayed.push(...delayed);
        bucket.failed.push(...failed);
        bucket.completed.push(...completed);
      })
    );

    const normalizeStatus = (status: keyof typeof bucket) => {
      const sorted = this.sortJobsByRecent(bucket[status]).slice(0, limit);
      return sorted.map((job) => this.serializeJob(job));
    };

    return {
      limit,
      waiting: normalizeStatus("waiting"),
      active: normalizeStatus("active"),
      delayed: normalizeStatus("delayed"),
      failed: normalizeStatus("failed"),
      completed: normalizeStatus("completed"),
    };
  }

  @Get("runs")
  async runs(@Query("limit") limitQ?: string) {
    const limit = Math.min(50, Math.max(1, Number(limitQ) || 20));
    const rows = await this.state.listRuns(limit);
    return rows;
  }

  private pickQueues(target: "series" | "chapters" | "all") {
    if (target === "series") return [this.seriesQ];
    if (target === "chapters") return [this.chapterQ];
    return [this.seriesQ, this.chapterQ];
  }

  @Post("pause")
  async pauseQueues(@Body() body: { queue?: "series" | "chapters" | "all" }) {
    const queue = body?.queue ?? "all";
    const queues = this.pickQueues(queue);
    await Promise.all(queues.map((q) => q.pause()));
    return { ok: true, paused: queue };
  }

  @Post("resume")
  async resumeQueues(@Body() body: { queue?: "series" | "chapters" | "all" }) {
    const queue = body?.queue ?? "all";
    const queues = this.pickQueues(queue);
    await Promise.all(queues.map((q) => q.resume()));
    return { ok: true, resumed: queue };
  }

  /** Xoá các job fail cũ để làm sạch queue */
  @Delete("failed")
  async clearFailed(@Query("limit") limitQ?: string) {
    const limit = Math.min(100, Math.max(1, Number(limitQ) || 50));
    const [seriesFailed, chapterFailed] = await Promise.all([
      this.seriesQ.getFailed(0, limit - 1),
      this.chapterQ.getFailed(0, limit - 1),
    ]);
    const jobs = this.sortJobsByRecent([
      ...seriesFailed,
      ...chapterFailed,
    ]).slice(0, limit);
    let cleared = 0;
    for (const job of jobs) {
      await job.remove();
      cleared += 1;
    }
    return { cleared };
  }

  /** (Tiện debug) Thử bắn thẳng 1 series URL vào queue */
  @Post("seed-series")
  async seedSeries(@Body() body: { source_id: string; url: string }) {
    if (!body?.source_id || !body?.url) {
      throw new BadRequestException("source_id & url required");
    }
    const source = await this.resolveSource(body.source_id);
    const run = await this.state.createRun({
      sourceId: source.id,
      sourceIdentifier: body.url,
      sourceName: source.name,
      type: "series",
      context: { url: body.url },
      queuedSeries: 1,
    });
    await this.seriesQ.add(
      "parse-series-page",
      {
        source_id: source.id,
        url: body.url,
        source_meta: { name: source.name, base_url: source.base_url },
        run_id: run.id,
      },
      { attempts: 2, backoff: { type: "exponential", delay: 1000 } }
    );
    return { ok: true, enqueued: 1, run_id: run.id };
  }
}
