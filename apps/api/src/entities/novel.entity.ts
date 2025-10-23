//apps/api/src/entities/novel.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type NovelStatus = "ongoing" | "completed" | "hiatus";
export type NovelSource = "local" | "crawler";

@Entity({ name: "novels" })
export class Novel {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  @Index({ where: "title IS NOT NULL" })
  title!: string;

  @Column({ type: "text", unique: true })
  @Index()
  slug!: string;

  @Column({ type: "text", default: "" })
  description!: string;

  @Column({ type: "text", nullable: true })
  cover_image_key!: string | null;

  @Column({ type: "varchar", length: 16, default: "ongoing" })
  status!: NovelStatus;

  @Column({ type: "varchar", length: 16, default: "local" })
  source!: NovelSource;

  @Column({ type: "text", nullable: true })
  source_url!: string | null;

  @Column({ type: "uuid", nullable: true })
  author_id!: string | null;

  @Column({ type: "numeric", precision: 6, scale: 3, default: 0 })
  rating_avg!: number;

  @Column({ type: "int", default: 0 })
  rating_count!: number;

  @Column({ type: "numeric", precision: 12, scale: 0, default: 0 })
  words_count!: string | number;

  @Column({ type: "numeric", precision: 12, scale: 0, default: 0 })
  views!: string | number;

  @Column({ type: "timestamptz", nullable: true })
  published_at!: Date | null;

  // --------- NEW FIELDS ----------
  @Column({ type: "text", nullable: true })
  original_title!: string | null;

  // ARRAY text (nullable)
  @Column({ type: "text", array: true, nullable: true })
  alt_titles!: string[] | null;

  // ISO-639-1 hoặc mã tuỳ ý
  @Column({ type: "varchar", length: 16, nullable: true })
  language_code!: string | null;

  @Column({ type: "boolean", default: false })
  is_featured!: boolean;

  @Column({ type: "boolean", default: false })
  mature!: boolean;

  // độ ưu tiên sort
  @Column({ type: "int", default: 0 })
  priority!: number;
  // -------------------------------

  @CreateDateColumn({
    name: "created_at",
    type: "timestamptz",
    default: () => "now()",
  })
  created_at!: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamptz",
    default: () => "now()",
  })
  updated_at!: Date;
}
