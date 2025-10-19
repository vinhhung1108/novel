import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NovelsController } from "./novels.controller";
import { NovelsService } from "./novels.service";
import { Novel } from "@/entities/novel.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Novel])],
  controllers: [NovelsController],
  providers: [NovelsService],
  exports: [NovelsService],
})
export class NovelsModule {}
