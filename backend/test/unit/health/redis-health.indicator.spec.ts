import { HealthCheckError } from "@nestjs/terminus";
import { RedisHealthIndicator } from "../../../src/health/redis-health.indicator";

describe("RedisHealthIndicator", () => {
  let indicator: RedisHealthIndicator;
  let mockRedisClient: {
    ping: jest.Mock;
    info: jest.Mock;
    disconnect: jest.Mock;
  };

  beforeEach(() => {
    indicator = new RedisHealthIndicator();

    // Override the internal redis client with a mock
    mockRedisClient = {
      ping: jest.fn(),
      info: jest.fn(),
      disconnect: jest.fn(),
    };
    (indicator as any).redis = mockRedisClient;
  });

  afterEach(() => {
    // Clean up
    mockRedisClient.disconnect();
  });

  it("should be defined", () => {
    expect(indicator).toBeDefined();
  });

  describe("pingCheck", () => {
    it("should return healthy status on PONG response", async () => {
      mockRedisClient.ping.mockResolvedValue("PONG");

      const result = await indicator.pingCheck("redis");

      expect(result).toBeDefined();
      expect(result.redis).toBeDefined();
      expect(result.redis.status).toBe("up");
      expect(result.redis.connection).toBe("established");
      expect(result.redis.responseTime).toBeDefined();
    });

    it("should throw HealthCheckError on non-PONG response", async () => {
      mockRedisClient.ping.mockResolvedValue("NOT_PONG");

      await expect(indicator.pingCheck("redis")).rejects.toThrow(
        HealthCheckError,
      );

      try {
        await indicator.pingCheck("redis");
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.message).toBe("Redis check failed");
        expect(error.causes.redis.status).toBe("down");
        expect(error.causes.redis.connection).toBe("failed");
      }
    });

    it("should throw HealthCheckError on connection error", async () => {
      mockRedisClient.ping.mockRejectedValue(new Error("Connection refused"));

      await expect(indicator.pingCheck("redis")).rejects.toThrow(
        HealthCheckError,
      );

      try {
        await indicator.pingCheck("redis");
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.message).toBe("Redis check failed");
        expect(error.causes.redis.status).toBe("down");
        expect(error.causes.redis.error).toBe("Connection refused");
      }
    });
  });

  describe("checkMemoryUsage", () => {
    it("should return healthy status on success", async () => {
      mockRedisClient.info.mockResolvedValue(
        "# Memory\r\nused_memory:1024\r\nused_memory_human:1K\r\n",
      );

      const result = await indicator.checkMemoryUsage("redis-memory");

      expect(result).toBeDefined();
      expect(result["redis-memory"]).toBeDefined();
      expect(result["redis-memory"].status).toBe("up");
      expect(result["redis-memory"].memoryInfo).toBe("available");
    });

    it("should throw HealthCheckError on error", async () => {
      mockRedisClient.info.mockRejectedValue(
        new Error("Redis memory info failed"),
      );

      await expect(indicator.checkMemoryUsage("redis-memory")).rejects.toThrow(
        HealthCheckError,
      );

      try {
        await indicator.checkMemoryUsage("redis-memory");
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.message).toBe("Redis memory check failed");
        expect(error.causes["redis-memory"].error).toBe(
          "Redis memory info failed",
        );
      }
    });
  });
});
