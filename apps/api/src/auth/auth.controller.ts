import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(
    @Body() body: { email: string; username: string; password: string }
  ) {
    return this.auth.register(body.email, body.username, body.password);
  }

  @Post("login")
  login(@Body() body: { usernameOrEmail: string; password: string }) {
    return this.auth.login(body.usernameOrEmail, body.password);
  }
}
