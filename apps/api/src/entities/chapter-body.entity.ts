import { Entity, Column, PrimaryColumn, Index } from "typeorm";

/**
 * Lưu nội dung chương tách riêng theo thiết kế mới.
 * Bảng đã partition theo HASH(novel_id) ở migration 100_*
 */
@Entity({ name: "chapter_bodies" })
@Index("idx_chapter_bodies_novel", ["novel_id"])
export class ChapterBody {
  // PK là chapter_id (trùng id của bảng chapters)
  @PrimaryColumn("uuid")
  chapter_id!: string;

  @Column("uuid")
  novel_id!: string;

  @Column("text")
  content_html!: string;

  @Column("timestamptz", { default: () => "now()" })
  created_at!: Date;

  @Column("timestamptz", { default: () => "now()" })
  updated_at!: Date;
}
