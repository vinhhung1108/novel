import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { Novel } from "@/entities/novel.entity";
import { Chapter } from "@/entities/chapter.entity";
import { ChapterBody } from "@/entities/chapter-body.entity";
import { SourceMapsService } from "./source-maps.service";
import { CrawlerPersistService } from "./crawler-persist.service";

import { NovelsModule } from "@/novels/novels.module";
import { ChaptersModule } from "@/modules/chapters/chapters.module";
import { UploadModule } from "@/upload/upload.module";
import { SearchModule } from "@/search/search.module";
import { CrawlController } from "./crawl.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Novel, Chapter, ChapterBody]),
    forwardRef(() => NovelsModule),
    forwardRef(() => ChaptersModule),
    BullModule.registerQueue({ name: "crawl" }),
    UploadModule,
    SearchModule,
  ],
  controllers: [CrawlController],
  providers: [SourceMapsService, CrawlerPersistService],
  exports: [CrawlerPersistService, SourceMapsService],
})
export class CrawlModule {}
