import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Chapter } from "@/entities/chapter.entity";
import { ChapterBody } from "@/entities/chapter-body.entity";
import { Novel } from "@/entities/novel.entity";
import { ChaptersController } from "./chapters.controller";
import { ChaptersService } from "./chapters.service";
import { SearchService } from "@/search/search.service";

@Module({
  imports: [TypeOrmModule.forFeature([Chapter, ChapterBody, Novel])],
  controllers: [ChaptersController],
  providers: [ChaptersService, SearchService],
})
export class ChaptersModule {}
