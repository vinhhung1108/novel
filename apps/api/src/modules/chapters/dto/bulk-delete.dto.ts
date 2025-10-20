import { IsArray, ArrayNotEmpty, IsInt, Min } from "class-validator";
export class BulkDeleteDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  index_list!: number[]; // danh sách index_no cần xoá
}
