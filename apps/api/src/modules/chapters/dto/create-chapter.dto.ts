import { IsString, IsInt, Min, IsOptional } from "class-validator";
export class CreateChapterDto {
  @IsString() novel_id!: string;
  @IsInt() @Min(1) index_no!: number;
  @IsString() title!: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() slug?: string | null;
}
