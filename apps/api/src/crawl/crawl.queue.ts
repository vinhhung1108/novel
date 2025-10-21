import { Queue } from "bullmq";
import { Inject, Injectable } from "@nestjs/common";

@Injectable()
export class CrawlQueue {
  public readonly seriesQueue: Queue;
  public readonly chapterQueue: Queue;

  constructor() {
    const connection = {
      host: process.env.REDIS_HOST ?? "localhost",
      port: +(process.env.REDIS_PORT ?? 6379),
    };
    this.seriesQueue = new Queue("crawl:series", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
    this.chapterQueue = new Queue("crawl:chapter", {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 7000 },
      },
    });
  }
}
