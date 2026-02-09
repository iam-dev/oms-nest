import { Controller, Get } from "@nestjs/common";
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from "@nestjs/terminus";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { RedisHealthIndicator } from "./redis-health.indicator";
import { SkipRlsContext } from "../rls/rls.guard";

@ApiTags("health")
@SkipThrottle()
@SkipRlsContext()
@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: "General health check" })
  @ApiResponse({ status: 200, description: "Health check successful" })
  @ApiResponse({ status: 503, description: "Service unavailable" })
  check() {
    return this.health.check([
      () => this.db.pingCheck("nestjs-database"),
      () => this.redis.pingCheck("redis"),
      () => this.memory.checkHeap("memory_heap", 150 * 1024 * 1024),
      () =>
        this.disk.checkStorage("storage", {
          path: "/",
          thresholdPercent: 0.9,
        }),
    ]);
  }

  @Get("ready")
  @HealthCheck()
  @ApiOperation({ summary: "Readiness probe" })
  @ApiResponse({ status: 200, description: "Service ready" })
  @ApiResponse({ status: 503, description: "Service not ready" })
  readiness() {
    return this.health.check([() => this.db.pingCheck("nestjs-database")]);
  }

  @Get("live")
  @HealthCheck()
  @ApiOperation({ summary: "Liveness probe" })
  @ApiResponse({ status: 200, description: "Service alive" })
  @ApiResponse({ status: 503, description: "Service not responding" })
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap("memory_heap", 200 * 1024 * 1024),
      () =>
        this.disk.checkStorage("storage", {
          path: "/",
          thresholdPercent: 0.95,
        }),
    ]);
  }

  @Get("detailed")
  @ApiOperation({ summary: "Detailed health information" })
  @ApiResponse({ status: 200, description: "Detailed health report" })
  async detailed() {
    const basic = await this.check();
    const readiness = await this.readiness();
    const liveness = await this.liveness();

    return {
      timestamp: new Date().toISOString(),
      service: "nestjs-api",
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      checks: {
        basic: basic.status === "ok",
        readiness: readiness.status === "ok",
        liveness: liveness.status === "ok",
      },
      details: {
        basic,
        readiness,
        liveness,
      },
    };
  }
}
