import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Novel } from "./novel.entity";

/**
 * Lượt xem theo ngày cho từng truyện.
 * Bảng thật trong DB đang là bảng PARTITIONED theo tháng (range theo view_date),
 * kèm UNIQUE(novel_id, view_date) để phục vụ upsert tăng views.
 */
@Entity({ name: "novel_views" })
@Index("idx_novel_views_novel_date", ["novel_id", "view_date"], {
  unique: true,
})
export class NovelView {
  /**
   * BIGSERIAL → trong TypeORM nên dùng type 'bigint' và kiểu TS là string
   * để không mất chính xác khi số lớn.
   */
  @PrimaryGeneratedColumn({ type: "bigint" })
  id!: string;

  @Column("uuid")
  novel_id!: string;

  /**
   * Ngày (UTC) dạng YYYY-MM-DD; trong PG type DATE.
   * Dùng string ở phía TS để giữ nguyên định dạng 'YYYY-MM-DD'.
   */
  @Column({ type: "date" })
  view_date!: string;

  @Column({ type: "int", default: 1 })
  views!: number;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  /**
   * Quan hệ tham chiếu về Novel (không tạo FK ở DB vì bảng partitioned và để linh hoạt),
   * nhưng vẫn giúp TypeORM join tiện hơn. Nếu bạn đã tạo FK ở DB thì có thể bỏ
   * createForeignKeyConstraints: false.
   */
  @ManyToOne(() => Novel, { createForeignKeyConstraints: false })
  @JoinColumn({ name: "novel_id", referencedColumnName: "id" })
  novel?: Novel;
}
