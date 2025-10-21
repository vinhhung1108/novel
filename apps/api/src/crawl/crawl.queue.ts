import { Queue } from "bullmq";
import { Inject, Injectable } from "@nestjs/common";

function int(v: string | undefined, d: number) {
  return Number.isFinite(+(v ?? "")) ? +v! : d;
}

@Injectable()
export class CrawlQueue {
  public readonly seriesQueue: Queue;
  public readonly chapterQueue: Queue;

  constructor() {
    const connection = {
      host: process.env.REDIS_HOST ?? "localhost",
      port: +(process.env.REDIS_PORT ?? 6379),
    };
    const limiter = {
      max: int(process.env.CRAWL_RATE_MAX, 10),
      duration: int(process.env.CRAWL_RATE_DURATION_MS, 1000),
      // Có thể dùng groupKey để giới hạn theo host nếu cần (nâng cấp sau)
      // groupKey: 'host'
    };

    this.seriesQueue = new Queue("crawl-series", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
    this.chapterQueue = new Queue("crawl-chapter", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 7000 },
      },
    });
  }
}
