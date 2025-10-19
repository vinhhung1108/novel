import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";

import { HealthController } from "./health.controller";

// Entities “hệ thống” (user/role)
import { User } from "./entities/user.entity";
import { Role } from "./entities/role.entity";
import { UserRole } from "./entities/user-role.entity";

// Auth & Upload
import { AuthModule } from "./auth/auth.module";
import { UploadModule } from "./upload/upload.module";

// Modules tách theo domain
import { AuthorsModule } from "./modules/authors/authors.module";
import { TagsModule } from "./modules/tags/tags.module";
import { NovelsModule } from "./modules/novels/novels.module";
import { ChaptersModule } from "./modules/chapters/chapters.module";
import { StatsModule } from "./modules/stats/stats.module";

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.POSTGRES_HOST || "localhost",
      port: Number(process.env.POSTGRES_PORT || 5432),
      database: process.env.POSTGRES_DB || "novels",
      username: process.env.POSTGRES_USER || "app",
      password: process.env.POSTGRES_PASSWORD || "app",
      synchronize: false,
      autoLoadEntities: true,
    }),

    // Đăng ký repo cho các entity hệ thống
    TypeOrmModule.forFeature([User, Role, UserRole]),

    // Feature modules
    AuthModule,
    UploadModule,

    // Domain modules (đã tách thay cho DomainModule cũ)
    AuthorsModule,
    TagsModule,
    NovelsModule,
    ChaptersModule,
    StatsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
