import { Queue } from "bullmq";
import { Injectable } from "@nestjs/common";
import { envInt, envStr } from "../common/env";

const toInt = (v: string | undefined, d: number) =>
  Number.isFinite(+(v ?? "")) ? +v! : d;

@Injectable()
export class CrawlQueue {
  public readonly seriesQueue: Queue;
  public readonly chapterQueue: Queue;

  constructor() {
    const connection = {
      host: envStr("REDIS_HOST", "localhost"),
      port: envInt("REDIS_PORT", 6379, { min: 1, max: 65535 }),
    };

    const limiter = {
      max: toInt(process.env.CRAWL_RATE_MAX, 10),
      duration: toInt(process.env.CRAWL_RATE_DURATION_MS, 1000),
    };

    const defaultJobOptions = {
      attempts: 5,
      backoff: { type: "exponential" as const, delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    };

    this.seriesQueue = new Queue("crawl-series", {
      connection,
      defaultJobOptions,
    });
    this.chapterQueue = new Queue("crawl-chapter", {
      connection,
      defaultJobOptions,
    });
  }
}
