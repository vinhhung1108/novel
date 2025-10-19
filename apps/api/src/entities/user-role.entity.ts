import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity({ name: "user_roles" })
export class UserRole {
  @PrimaryColumn("uuid")
  user_id!: string;

  @PrimaryColumn("int")
  role_id!: number;
}
