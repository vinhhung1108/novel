//apps/api/src/entities/series-source-map.entity.ts
import { Entity, Column, PrimaryColumn, Index } from "typeorm";

@Entity({ name: "series_source_map" })
@Index("uq_series_source_map_src_ext", ["source_id", "ext_series_id"], {
  unique: true,
})
export class SeriesSourceMap {
  @PrimaryColumn("uuid")
  source_id!: string; // id của bảng sources

  @PrimaryColumn("text")
  ext_series_id!: string; // slug/đường dẫn ngoài

  @Column("uuid")
  novel_id!: string;

  @Column("text", { nullable: true })
  url!: string | null;

  @Column("timestamptz", { default: () => "now()" })
  created_at!: Date;

  @Column("timestamptz", { default: () => "now()" })
  updated_at!: Date;
}
