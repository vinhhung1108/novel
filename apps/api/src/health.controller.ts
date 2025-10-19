import { Controller, Get } from "@nestjs/common";
import { DataSource } from "typeorm";

@Controller("health")
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  get() {
    return { status: "ok" } as const;
  }

  @Get("db")
  async db() {
    try {
      await this.dataSource.query("SELECT 1");
      return { db: "ok" } as const;
    } catch (e) {
      return { db: "error", message: (e as Error).message } as const;
    }
  }
}
