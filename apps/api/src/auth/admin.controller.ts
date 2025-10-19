import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";


@Controller("admin-only")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class AdminOnlyController {
@Get()
@Roles("admin")
hello() { return { ok: true, msg: "Admin area" } as const; }
}