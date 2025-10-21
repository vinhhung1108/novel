import { Injectable } from "@nestjs/common";
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerOptionsFactory,
} from "@nestjs/throttler";

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {}

@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  createThrottlerOptions(): ThrottlerModuleOptions {
    const ttl = Number(process.env.RATE_LIMIT_TTL || 60);
    const limit = Number(process.env.RATE_LIMIT_LIMIT || 120);
    return {
      throttlers: [{ ttl, limit }],
    };
  }
}
