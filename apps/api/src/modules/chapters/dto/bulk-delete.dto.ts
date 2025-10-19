import { IsArray, ArrayNotEmpty, IsInt, Min } from "class-validator";
export class BulkDeleteDto {
  @IsArray()
  @ArrayNotEmpty()
  index_list!: number[]; // danh sách index_no cần xoá
}
