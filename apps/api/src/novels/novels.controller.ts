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
import { NovelsService } from "./novels.service";
import { CreateNovelDto } from "./dto/create-novel.dto";

@Controller("novels") // -> /v1/novels (vì main.ts đã setGlobalPrefix("v1"))
export class NovelsController {
  constructor(private readonly svc: NovelsService) {}

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
    @Body() body: Partial<CreateNovelDto>
  ) {
    return this.svc.update(id, body as any);
  }

  @Delete(":id")
  remove(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.svc.remove(id);
  }
}
