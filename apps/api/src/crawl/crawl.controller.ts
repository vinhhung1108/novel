import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CrawlQueue } from "./crawl.queue";
import { EnqueueSeriesDto } from "./dto/enqueue-series.dto";
import { Queue } from "bullmq";

@Controller("crawl")
export class CrawlController {
  constructor(private readonly q: CrawlQueue) {}

  @Get("health")
  health() {
    return { ok: true, now: Date.now() };
  }

  @Post("enqueue-series")
  @Throttle({ default: { ttl: 60, limit: 12 } })
  async enqueueSeries(@Body() dto: EnqueueSeriesDto) {
    const jobId = `series_${dto.sourceId}_${dto.extSeriesId}`;
    const job = await this.q.seriesQueue.add("series", dto, {
      jobId,
      removeOnComplete: true,
      removeOnFail: true,
    });
    return { enqueued: true, jobId: job.id };
  }

  @Get("jobs")
  async jobs(
    @Query("queue") queueName: "series" | "chapter" = "series",
    @Query("state")
    state: "waiting" | "active" | "completed" | "failed" = "waiting",
    @Query("start") start = "0",
    @Query("end") end = "50"
  ) {
    const queue: Queue =
      queueName === "chapter" ? this.q.chapterQueue : this.q.seriesQueue;
    const s = parseInt(start, 10) || 0;
    const e = parseInt(end, 10) || 50;
    const list = await queue.getJobs([state], s, e, false);
    return list.map((j) => ({
      id: j.id,
      name: j.name,
      state,
      data: j.data,
      attemptsMade: j.attemptsMade,
      timestamp: j.timestamp,
    }));
  }

  @Get("job/:id")
  async job(
    @Param("id") id: string,
    @Query("queue") qname: "series" | "chapter" = "series"
  ) {
    const queue: Queue =
      qname === "chapter" ? this.q.chapterQueue : this.q.seriesQueue;
    const job = await queue.getJob(id);
    if (!job) return { found: false };
    const st = await job.getState();
    return {
      found: true,
      id: job.id,
      state: st,
      data: job.data,
      returnvalue: job.returnvalue,
      attemptsMade: job.attemptsMade,
    };
  }
}
