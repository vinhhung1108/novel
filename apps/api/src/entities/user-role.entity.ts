import { Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "user_roles" })
export class UserRole {
  @PrimaryColumn("uuid")
  user_id!: string;

  @PrimaryColumn("int")
  role_id!: number;
}
