/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { NovelsService } from "./novels.service";
import { CreateNovelDto } from "./dto/create-novel.dto";
import { UpdateNovelDto } from "./dto/update-novel.dto";

type UpdateNovelBody = UpdateNovelDto;

@Controller("novels") // -> /v1/novels (vì main.ts đã setGlobalPrefix("v1"))
export class NovelsController {
  constructor(private readonly svc: NovelsService) {}

  @Get()
  list(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query("q") q?: string,
    @Query("sort", new DefaultValuePipe("updated_at"))
    sort?: "updated_at" | "title",
    @Query("order", new DefaultValuePipe("DESC")) order?: string
  ) {
    const normalizedOrder =
      typeof order === "string" && order.toUpperCase() === "ASC"
        ? "ASC"
        : "DESC";
    const normalizedSort = sort === "title" ? "title" : "updated_at";
    return this.svc.list(page, limit, {
      q: q?.trim() || undefined,
      sort: normalizedSort,
      order: normalizedOrder,
    });
  }

  @Get("slug-exists/:slug")
  slugExistsParam(@Param("slug") slug: string) {
    return this.svc.slugExists(slug);
  }

  @Get("slug-exists")
  slugExistsQuery(@Query("slug") slug: string) {
    return this.svc.slugExists(slug);
  }

  @Get(":slug")
  getBySlug(@Param("slug") slug: string) {
    return this.svc.getBySlug(slug);
  }

  @Post()
  create(@Body() body: CreateNovelDto) {
    return this.svc.create(body);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: UpdateNovelBody
  ) {
    return this.svc.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.svc.remove(id);
  }

  @Post(":id/categories")
  async setCategories(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: { category_ids: string[] }
  ) {
    await this.svc.replaceNovelCategories(
      id,
      Array.isArray(body?.category_ids) ? body.category_ids : []
    );
    return { ok: true };
  }

  @Post(":id/tags")
  async setTags(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: { tag_ids: string[] }
  ) {
    await this.svc.replaceNovelTags(
      id,
      Array.isArray(body?.tag_ids) ? body.tag_ids : []
    );
    return { ok: true };
  }
}
