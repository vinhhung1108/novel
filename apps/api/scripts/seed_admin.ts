import "reflect-metadata";
import { DataSource } from "typeorm";
import bcrypt from "bcrypt";
import { User } from "../src/entities/user.entity";
import { Role } from "../src/entities/role.entity";
import { UserRole } from "../src/entities/user-role.entity";

const ds = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || "novels",
  username: process.env.POSTGRES_USER || "app",
  password: process.env.POSTGRES_PASSWORD || "app",
  entities: [User, Role, UserRole],
});

async function main() {
  await ds.initialize();
  const roles = ds.getRepository(Role);
  const users = ds.getRepository(User);
  const userRoles = ds.getRepository(UserRole);

  const adminRole = await roles.findOne({ where: { code: "admin" } });
  if (!adminRole)
    throw new Error("Role 'admin' chưa tồn tại. Hãy áp SQL seed roles trước.");

  const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const username = process.env.SEED_ADMIN_USERNAME || "admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";

  let u = await users.findOne({ where: [{ email }, { username }] });
  if (!u) {
    const hash = await bcrypt.hash(password, 12);
    u = await users.save({
      email,
      username,
      password_hash: hash,
      status: 1,
      display_name: "Admin",
    });
    console.log("Đã tạo user admin:", { email, username });
  } else {
    console.log("User admin đã tồn tại:", {
      email: u.email,
      username: u.username,
    });
  }

  const hasLink = await userRoles.findOne({
    where: { user_id: u.id, role_id: adminRole.id },
  });
  if (!hasLink) {
    await userRoles.save({ user_id: u.id, role_id: adminRole.id });
    console.log("Đã gán role admin cho user");
  }

  await ds.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
