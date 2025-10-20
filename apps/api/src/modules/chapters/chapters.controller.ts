import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ChaptersService } from "./chapters.service";
import { UpdateChapterDto } from "./dto/update-chapter.dto";
import { CreateChapterDto } from "./dto/create-chapter.dto";
import { CreateChapterAutoDto } from "./dto/create-chapter-auto.dto";
import { BulkDeleteDto } from "./dto/bulk-delete.dto";

@Controller("novels/:novel_id/chapters")
export class ChaptersController {
  constructor(private readonly svc: ChaptersService) {}

  @Get()
  list(
    @Param("novel_id", new ParseUUIDPipe()) novel_id: string,
    @Query("page") page = "1",
    @Query("limit") limit = "50"
  ) {
    return this.svc.list(novel_id, Number(page), Number(limit));
  }

  @Get("next-index")
  async nextIndex(@Param("novel_id", new ParseUUIDPipe()) novel_id: string) {
    const next_index = await this.svc.getNextIndex(novel_id);
    return { next_index };
  }

  @Get(":index_no")
  getWithBody(
    @Param("novel_id", new ParseUUIDPipe()) novel_id: string,
    @Param("index_no") index_no: string
  ) {
    return this.svc.getWithBody(novel_id, Number(index_no));
  }

  // Legacy: /v1/novels/:novel_id/chapters  (nhưng client gửi index_no)
  @Post("legacy")
  createLegacy(
    @Param("novel_id", new ParseUUIDPipe()) novel_id: string,
    @Body() body: CreateChapterDto
  ) {
    return this.svc.createLegacy({ ...body, novel_id });
  }

  // Auto-index: KHÔNG gửi index_no
  @Post()
  createAuto(
    @Param("novel_id", new ParseUUIDPipe()) novel_id: string,
    @Body() body: CreateChapterAutoDto
  ) {
    return this.svc.createAuto(novel_id, body);
  }

  @Patch(":index_no")
  patch(
    @Param("novel_id", new ParseUUIDPipe()) novel_id: string,
    @Param("index_no") index_no: string,
    @Body() body: UpdateChapterDto
  ) {
    return this.svc.patch(novel_id, Number(index_no), body as any);
  }

  @Delete(":index_no")
  deleteOne(
    @Param("novel_id", new ParseUUIDPipe()) novel_id: string,
    @Param("index_no") index_no: string
  ) {
    return this.svc.deleteOne(novel_id, Number(index_no));
  }

  @Post("bulk-delete")
  bulkDelete(
    @Param("novel_id", new ParseUUIDPipe()) novel_id: string,
    @Body() body: BulkDeleteDto
  ) {
    return this.svc.bulkDelete(novel_id, body.index_list);
  }
}
