import { Controller, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { Role } from "../entities/role.entity";
import { UserRole } from "../entities/user-role.entity";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtStrategy } from "./jwt.strategy";
import { AdminOnlyController } from "./admin.controller";

@Controller()
export class _Dummy {}

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, UserRole]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-secret-please-change",
      signOptions: { expiresIn: "1h" },
    }),
  ],
  controllers: [AuthController, AdminOnlyController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
