import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("citext", { unique: true })
  email!: string;

  @Column("citext", { unique: true })
  username!: string;

  @Column("text")
  password_hash!: string;

  @Column("smallint", { default: 1 })
  status!: number;

  @Column("text", { nullable: true })
  display_name!: string | null;

  @Column("text", { nullable: true })
  avatar_url!: string | null;

  @Column("text", { nullable: true })
  bio!: string | null;

  @CreateDateColumn({ type: "timestamptz", default: () => "now()" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz", default: () => "now()" })
  updated_at!: Date;
}
