import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({ name: "tags" })
export class Tag {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("text") name!: string;
  @Column("text", { unique: true }) slug!: string;
  @Column("text", { default: "tag" }) type!: string;
}
