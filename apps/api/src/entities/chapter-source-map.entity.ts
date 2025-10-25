import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity({ name: "chapter_source_map" })
@Index("uq_chapter_source_map_src_ext", ["source_id", "ext_chapter_id"], {
  unique: true,
})
export class ChapterSourceMap {
  @PrimaryColumn("uuid")
  source_id!: string;

  @PrimaryColumn("text")
  ext_chapter_id!: string;

  @Column("uuid")
  chapter_id!: string;

  @Column("text")
  ext_url!: string;

  @Column("uuid")
  novel_id!: string;

  @Column("int")
  index_no!: number;

  @Column("text", { nullable: true })
  url!: string | null;

  @Column("timestamptz", { default: () => "now()" })
  created_at!: Date;

  @Column("timestamptz", { default: () => "now()" })
  updated_at!: Date;
}
