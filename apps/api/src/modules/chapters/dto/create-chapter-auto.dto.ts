import { IsString, IsOptional } from "class-validator";
export class CreateChapterAutoDto {
  @IsString() title!: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() slug?: string | null;
}
