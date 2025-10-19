import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { AuthorsService } from "./authors.service";
import { CreateAuthorDto } from "./dto/create-author.dto";

@Controller("v1/authors")
export class AuthorsController {
  constructor(private readonly svc: AuthorsService) {}

  @Get()
  list(@Query("q") q?: string) {
    return this.svc.list(q);
  }

  @Post()
  create(@Body() dto: CreateAuthorDto) {
    return this.svc.create(dto);
  }
}
