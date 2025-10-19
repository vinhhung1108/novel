import { Controller, Get, Query } from "@nestjs/common";
import { StatsService } from "./stats.service";

@Controller("v1/stats")
export class StatsController {
  constructor(private readonly svc: StatsService) {}

  @Get()
  overview() {
    return this.svc.overview();
  }

  @Get("series")
  series(
    @Query("granularity") g: "day" | "week" = "day",
    @Query("range") r = "7"
  ) {
    return this.svc.series(g, Number(r));
  }

  @Get("top")
  top(@Query("days") days = "7", @Query("limit") limit = "10") {
    return this.svc.top(Number(days), Number(limit));
  }
}
