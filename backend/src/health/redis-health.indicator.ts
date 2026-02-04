import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import Redis from "ioredis";

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private redis: Redis;

  constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      const start = Date.now();
      const result = await this.redis.ping();
      const responseTime = Date.now() - start;

      if (result !== "PONG") {
        throw new Error(`Redis ping failed: ${result}`);
      }

      const status = {
        status: "up",
        responseTime: `${responseTime}ms`,
        connection: "established",
      };

      return this.getStatus(key, true, status);
    } catch (error) {
      const status = {
        status: "down",
        error: error.message,
        connection: "failed",
      };

      throw new HealthCheckError(
        "Redis check failed",
        this.getStatus(key, false, status),
      );
    }
  }

  async checkMemoryUsage(key: string): Promise<HealthIndicatorResult> {
    try {
      // Simplified memory check for now
      const info = await this.redis.info("memory");

      const status = {
        status: "up",
        memoryInfo: info ? "available" : "unavailable",
      };

      return this.getStatus(key, true, status);
    } catch (error) {
      throw new HealthCheckError(
        "Redis memory check failed",
        this.getStatus(key, false, { error: error.message }),
      );
    }
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }
}
