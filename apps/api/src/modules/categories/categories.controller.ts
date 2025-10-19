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
import { CategoriesService } from "./categories.service";

@Controller("v1/categories")
export class CategoriesController {
  constructor(private readonly svc: CategoriesService) {}

  @Get()
  list(
    @Query("page") page = "1",
    @Query("limit") limit = "50",
    @Query("q") q?: string
  ) {
    return this.svc.list(Number(page || 1), Number(limit || 50), q);
  }

  @Post()
  create(@Body() body: any) {
    return this.svc.create(body);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() body: any) {
    return this.svc.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }
}
