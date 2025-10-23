// apps/api/src/entities/chapter.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, Index } from "typeorm";

@Entity({ name: "chapters" })
@Index("chapters_novel_index_unique", ["novel_id", "index_no"], {
  unique: true,
})
export class Chapter {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  novel_id!: string;

  @Column("int")
  index_no!: number;

  @Column("text", { default: "" })
  title!: string;

  @Column("text", { nullable: true })
  slug!: string | null;

  @Column("text", { nullable: true })
  checksum!: string | null;

  @Column("int", { default: 0 })
  words_count!: number;

  @Column("bigint", { default: 0 })
  views!: string; // lưu big int dạng string

  @Column("timestamptz", { nullable: true })
  published_at!: Date | null;

  @Column("timestamptz", { default: () => "now()" })
  created_at!: Date;

  @Column("timestamptz", { default: () => "now()" })
  updated_at!: Date;
}
