import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { TagsService } from "./tags.service";
import { CreateTagDto } from "./dto/create-tag.dto";

@Controller("v1/tags")
export class TagsController {
  constructor(private readonly svc: TagsService) {}

  @Get()
  list(@Query("q") q?: string) {
    return this.svc.list(q);
  }

  @Post()
  create(@Body() dto: CreateTagDto) {
    return this.svc.create(dto);
  }
}
