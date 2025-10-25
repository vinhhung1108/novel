import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CrawlModule } from "@/modules/crawl/crawl.module";
import { CHAPTER_QUEUE, SERIES_QUEUE } from "@/modules/crawl/constants";
import { SeriesProcessor } from "./processors/series.processor";
import { ChapterProcessor } from "./processors/chapter.processor";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      useFactory: (cfg: ConfigService) => ({
        connection: {
          url: cfg.get<string>("REDIS_URL") || "redis://127.0.0.1:6379",
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: SERIES_QUEUE }),
    BullModule.registerQueue({ name: CHAPTER_QUEUE }),
    CrawlModule,
  ],
  providers: [SeriesProcessor, ChapterProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
