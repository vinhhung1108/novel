import {
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
} from "class-validator";

export class CreateNovelDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cover_image_key?: string;

  // Các field mở rộng (nếu có trên DB của bạn)
  @IsOptional() @IsString() original_title?: string | null;
  @IsOptional() @IsArray() alt_titles?: string[] | null;
  @IsOptional() @IsString() language_code?: string | null;
  @IsOptional() @IsBoolean() is_featured?: boolean;
  @IsOptional() @IsBoolean() mature?: boolean;
  @IsOptional() @IsInt() @Min(0) priority?: number;
}
