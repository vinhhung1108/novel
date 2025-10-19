import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateNovelDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  cover_image_key?: string | null;

  // extra fields (đã migrate ở 108)
  @IsOptional()
  @IsString()
  original_title?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alt_titles?: string[] | null;

  @IsOptional()
  @IsString()
  language_code?: string | null;

  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @IsOptional()
  @IsBoolean()
  mature?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
