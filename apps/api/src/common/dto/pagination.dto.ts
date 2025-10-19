import { IsInt, IsOptional, IsString, Min, IsIn } from "class-validator";
import { Type } from "class-transformer";

export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(["updated_at", "title"])
  sort?: "updated_at" | "title" = "updated_at";

  @IsOptional()
  @IsIn(["ASC", "DESC"])
  order?: "ASC" | "DESC" = "DESC";
}
