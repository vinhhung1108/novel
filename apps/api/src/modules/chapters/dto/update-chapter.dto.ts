import { IsInt, IsOptional, IsString, Min } from "class-validator";
export class UpdateChapterDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsInt() @Min(1) index_no?: number;
  @IsOptional() @IsString() slug?: string | null;
}
