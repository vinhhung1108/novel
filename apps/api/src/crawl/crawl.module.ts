import { Module } from "@nestjs/common";
import { CrawlQueue } from "./crawl.queue";
import { CrawlWorker } from "./crawl.worker";

@Module({
  providers: [CrawlQueue, CrawlWorker],
  exports: [CrawlQueue],
})
export class CrawlModule {}
