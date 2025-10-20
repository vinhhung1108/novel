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
  BadRequestException,
} from "@nestjs/common";
import type { Tag } from "@/entities/tag.entity";
import { TagsService } from "./tags.service";

@Controller("tags")
export class TagsController {
  constructor(private readonly svc: TagsService) {}

  // GET /v1/tags?page=1&limit=50&q=abc&order=ASC
  @Get()
  list(
    @Query("page") page = "1",
    @Query("limit") limit = "50",
    @Query("q") q?: string,
    @Query("order") order: "ASC" | "DESC" = "ASC"
  ) {
    return this.svc.list(Number(page || 1), Number(limit || 50), q, order);
  }

  // GET /v1/tags/slug-exists?slug=abc
  @Get("slug-exists")
  async slugExists(@Query("slug") slug?: string) {
    if (!slug?.trim()) throw new BadRequestException("slug is required");
    return this.svc.slugExists(slug);
  }

  // POST /v1/tags
  // body: { name, slug?, description? }
  @Post()
  create(@Body() body: Partial<Tag>) {
    return this.svc.create(body);
  }

  // PATCH /v1/tags/:id
  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: Partial<Tag>
  ) {
    return this.svc.update(id, body);
  }

  // DELETE /v1/tags/:id
  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }
}
