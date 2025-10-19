import { Controller, Get, Query, BadRequestException } from "@nestjs/common";
import { StatsService } from "./stats.service";

@Controller("stats")
export class StatsController {
  constructor(private readonly svc: StatsService) {}

  @Get()
  overview() {
    return this.svc.overview();
  }

  @Get("series")
  series(
    @Query("granularity") granularity: "day" | "week" = "day",
    @Query("range") range = "7"
  ) {
    const r = Number(range);
    if (!Number.isFinite(r)) throw new BadRequestException("range invalid");
    return this.svc.series(granularity, r);
  }

  @Get("top")
  top(@Query("days") days = "7", @Query("limit") limit = "10") {
    const d = Number(days);
    const l = Number(limit);
    if (!Number.isFinite(d) || !Number.isFinite(l))
      throw new BadRequestException("invalid params");
    return this.svc.top(d, l);
  }
}
