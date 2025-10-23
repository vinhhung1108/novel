// apps/api/src/sources/sources.module.ts
import { Module } from "@nestjs/common";
import { SourcesController } from "./sources.controller";

@Module({
  controllers: [SourcesController],
})
export class SourcesModule {}
