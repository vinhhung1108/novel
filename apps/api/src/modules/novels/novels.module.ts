import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Novel } from "../../entities/novel.entity";
import { Chapter } from "../../entities/chapter.entity";
import { ChapterBody } from "../../entities/chapter-body.entity";
import { NovelView } from "../../entities/novel-view.entity";
import { NovelsController } from "./novels.controller";
import { NovelsService } from "./novels.service";
import { SearchService } from "../../search/search.service";

@Module({
  imports: [TypeOrmModule.forFeature([Novel, Chapter, ChapterBody, NovelView])],
  controllers: [NovelsController],
  providers: [NovelsService, SearchService],
  exports: [NovelsService],
})
export class NovelsModule {}
