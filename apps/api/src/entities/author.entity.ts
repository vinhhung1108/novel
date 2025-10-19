import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({ name: "authors" })
export class Author {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column("text") name!: string;
  @Column("text", { unique: true }) slug!: string;
  @Column("text", { nullable: true }) description!: string | null;
}
