import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  NotFoundException,
  ParseUUIDPipe,
} from "@nestjs/common";
import { NovelsService } from "./novels.service";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { CreateNovelDto } from "./dto/create-novel.dto";
import { UpdateNovelDto } from "./dto/update-novel.dto";

@Controller("v1/novels")
export class NovelsController {
  constructor(private readonly svc: NovelsService) {}

  @Get()
  list(@Query() qs: PaginationQueryDto) {
    return this.svc.list(qs);
  }

  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const n = await this.svc.getBySlug(slug);
    if (!n) throw new NotFoundException("Novel not found");
    return n;
  }

  @Get("slug-exists/:slug")
  slugExistsLegacy(@Param("slug") slug: string) {
    return this.svc.slugExists(slug);
  }

  // Cho FE mới đang gọi ?slug=...
  @Get("slug-exists")
  slugExists(@Query("slug") slug: string) {
    return this.svc.slugExists(slug);
  }

  @Post()
  create(@Body() dto: CreateNovelDto) {
    return this.svc.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateNovelDto
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(":id")
  delete(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.svc.delete(id);
  }

  @Post(":id/view")
  addView(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.svc.addView(id);
  }
}
