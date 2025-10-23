// apps/api/src/entities/novel-tag.entity.ts
import { Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "novel_tags" })
export class NovelTag {
  @PrimaryColumn("uuid") novel_id!: string;
  @PrimaryColumn("uuid") tag_id!: string;
}
