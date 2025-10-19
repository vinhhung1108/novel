import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { Role } from "../entities/role.entity";
import { UserRole } from "../entities/user-role.entity";
import bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { In } from "typeorm";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoles: Repository<UserRole>,
    private readonly jwt: JwtService
  ) {}

  async register(email: string, username: string, password: string) {
    const exist = await this.users.findOne({
      where: [{ email }, { username }],
    });
    if (exist) throw new ConflictException("Email hoặc username đã tồn tại");
    const password_hash = await bcrypt.hash(password, 12);
    const u = await this.users.save({
      email,
      username,
      password_hash,
      status: 1,
    });
    // gán role user mặc định
    const role = await this.roles.findOne({ where: { code: "user" } });
    if (role) await this.userRoles.save({ user_id: u.id, role_id: role.id });
    return { id: u.id, email: u.email, username: u.username };
  }

  async login(usernameOrEmail: string, password: string) {
    const u = await this.users.findOne({
      where: [{ email: usernameOrEmail }, { username: usernameOrEmail }],
    });
    if (!u) throw new UnauthorizedException("Sai thông tin đăng nhập");
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) throw new UnauthorizedException("Sai thông tin đăng nhập");
    const roles = await this.userRoles.find({ where: { user_id: u.id } });
    const roleIds = roles.map((r) => r.role_id);
    const roleRows = roleIds.length
      ? await this.roles.find({ where: { id: In(roleIds) } })
      : [];
    const roleCodes = roleRows.map((r) => r.code);
    const payload = { sub: u.id, roles: roleCodes, username: u.username };
    const access_token = await this.jwt.signAsync(payload);
    return { access_token };
  }
}
