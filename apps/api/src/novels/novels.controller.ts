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
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { NovelsService } from "./novels.service";

@Controller("novels")
export class NovelsController {
  constructor(private readonly svc: NovelsService) {}

  // GET /v1/novels?page=1&limit=12&q=...&sort=updated_at|title&order=ASC|DESC
  @Get()
  list(
    @Query("page") page = "1",
    @Query("limit") limit = "12",
    @Query("q") q?: string,
    @Query("sort") sort: "updated_at" | "title" = "updated_at",
    @Query("order") order: "ASC" | "DESC" = "DESC"
  ) {
    return this.svc.list(Number(page), Number(limit), { q, sort, order });
  }

  // GET /v1/novels/slug-exists/my-slug   (cũng hỗ trợ ?slug=)
  @Get("slug-exists/:slug")
  slugExistsParam(@Param("slug") slug: string) {
    return this.svc.slugExists(slug);
  }
  @Get("slug-exists")
  slugExistsQuery(@Query("slug") slug?: string) {
    if (!slug) throw new BadRequestException("slug required");
    return this.svc.slugExists(slug);
  }

  // GET /v1/novels/:slug
  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const novel = await this.svc.getBySlug(slug);
    if (!novel) throw new NotFoundException("Novel not found");
    return novel;
  }

  // POST /v1/novels
  @Post()
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  // PATCH /v1/novels/:id
  @Patch(":id")
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: any
  ) {
    const n = await this.svc.update(id, body);
    if (!n) throw new NotFoundException("Novel not found");
    return n;
  }

  // DELETE /v1/novels/:id
  @Delete(":id")
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.svc.remove(id);
  }
}
