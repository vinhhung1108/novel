import { Module } from "@nestjs/common";
import { CrawlQueue } from "./crawl.queue";
import { CrawlWorker } from "./crawl.worker";
import { CrawlController } from "./crawl.controller";

@Module({
  controllers: [CrawlController],
  providers: [CrawlQueue, CrawlWorker],
  exports: [CrawlQueue],
})
export class CrawlModule {}
