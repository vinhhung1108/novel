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
import type { Author } from "@/entities/author.entity";
import { AuthorsService } from "./authors.service";

@Controller("authors")
export class AuthorsController {
  constructor(private readonly svc: AuthorsService) {}

  @Get()
  list(
    @Query("page") page = "1",
    @Query("limit") limit = "50",
    @Query("q") q?: string
  ) {
    return this.svc.list(Number(page || 1), Number(limit || 50), q);
  }

  // tiện ích: GET /authors/slug-exists?slug=abc
  @Get("slug-exists")
  slugExists(@Query("slug") slug = "") {
    return this.svc.slugExists(slug);
  }

  @Post()
  create(@Body() body: Partial<Author>) {
    return this.svc.create(body);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: Partial<Author>
  ) {
    return this.svc.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }
}
