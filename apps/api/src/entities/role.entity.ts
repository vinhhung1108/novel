import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({ name: "roles" })
export class Role {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", { unique: true })
  code!: string; // admin, moderator, editor, author, user

  @Column("text")
  name!: string;
}
