import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CrawlModule } from "@/modules/crawl/crawl.module";
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
    BullModule.registerQueue({ name: "crawl" }),
    CrawlModule,
  ],
  providers: [SeriesProcessor, ChapterProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
