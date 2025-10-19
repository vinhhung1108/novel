import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";
// (Không cần entity riêng, chỉ dùng DataSource query)
// Nếu muốn dùng Repo, có thể import entity tại đây.

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [StatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
