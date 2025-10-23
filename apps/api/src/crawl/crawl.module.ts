import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { CrawlQueue } from "./crawl.queue";
import { CrawlWorker } from "./crawl.worker";
import { CrawlController } from "./crawl.controller";

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60, // 60 giây
        limit: 100, // mỗi IP 100 req/phút
      },
    ]),
  ],
  controllers: [CrawlController],
  providers: [CrawlQueue, CrawlWorker],
  exports: [CrawlQueue],
})
export class CrawlModule {}
