import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NovelsController } from "./novels.controller";
import { NovelsService } from "./novels.service";
import { Novel } from "@/entities/novel.entity";
import { UploadModule } from "@/upload/upload.module";

@Module({
  imports: [TypeOrmModule.forFeature([Novel]), UploadModule],
  controllers: [NovelsController],
  providers: [NovelsService],
  exports: [NovelsService],
})
export class NovelsModule {}
