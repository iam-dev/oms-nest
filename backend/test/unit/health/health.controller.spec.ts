import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "../../../src/health/health.controller";
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from "@nestjs/terminus";
import { RedisHealthIndicator } from "../../../src/health/redis-health.indicator";

describe("HealthController", () => {
  let controller: HealthController;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let db: jest.Mocked<TypeOrmHealthIndicator>;
  let memory: jest.Mocked<MemoryHealthIndicator>;
  let disk: jest.Mocked<DiskHealthIndicator>;
  let redis: jest.Mocked<RedisHealthIndicator>;

  beforeEach(async () => {
    const mockHealthCheckService = {
      check: jest.fn().mockResolvedValue({ status: "ok" }),
    };

    const mockDb = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: "up" } }),
    };

    const mockMemory = {
      checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: "up" } }),
    };

    const mockDisk = {
      checkStorage: jest.fn().mockResolvedValue({ storage: { status: "up" } }),
    };

    const mockRedis = {
      pingCheck: jest.fn().mockResolvedValue({ redis: { status: "up" } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: mockDb },
        { provide: MemoryHealthIndicator, useValue: mockMemory },
        { provide: DiskHealthIndicator, useValue: mockDisk },
        { provide: RedisHealthIndicator, useValue: mockRedis },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get(HealthCheckService);
    db = module.get(TypeOrmHealthIndicator);
    memory = module.get(MemoryHealthIndicator);
    disk = module.get(DiskHealthIndicator);
    redis = module.get(RedisHealthIndicator);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("check", () => {
    it("should call health.check with all four indicators", async () => {
      await controller.check();

      expect(healthCheckService.check).toHaveBeenCalledTimes(1);

      // Execute the indicator callbacks that were passed to health.check
      const indicators = healthCheckService.check.mock.calls[0][0];
      expect(indicators).toHaveLength(4);

      // Execute each callback to verify they call the correct indicators
      for (const indicator of indicators) {
        await indicator();
      }

      expect(db.pingCheck).toHaveBeenCalledWith("nestjs-database");
      expect(redis.pingCheck).toHaveBeenCalledWith("redis");
      expect(memory.checkHeap).toHaveBeenCalledWith(
        "memory_heap",
        150 * 1024 * 1024,
      );
      expect(disk.checkStorage).toHaveBeenCalledWith("storage", {
        path: "/",
        thresholdPercent: 0.9,
      });
    });
  });

  describe("readiness", () => {
    it("should call health.check with db only", async () => {
      await controller.readiness();

      expect(healthCheckService.check).toHaveBeenCalledTimes(1);

      const indicators = healthCheckService.check.mock.calls[0][0];
      expect(indicators).toHaveLength(1);

      await indicators[0]();

      expect(db.pingCheck).toHaveBeenCalledWith("nestjs-database");
    });
  });

  describe("liveness", () => {
    it("should call health.check with memory and disk", async () => {
      await controller.liveness();

      expect(healthCheckService.check).toHaveBeenCalledTimes(1);

      const indicators = healthCheckService.check.mock.calls[0][0];
      expect(indicators).toHaveLength(2);

      for (const indicator of indicators) {
        await indicator();
      }

      expect(memory.checkHeap).toHaveBeenCalledWith(
        "memory_heap",
        200 * 1024 * 1024,
      );
      expect(disk.checkStorage).toHaveBeenCalledWith("storage", {
        path: "/",
        thresholdPercent: 0.95,
      });
    });
  });

  describe("detailed", () => {
    it("should return combined report object", async () => {
      const result = await controller.detailed();

      // health.check is called 3 times: once for check(), once for readiness(), once for liveness()
      expect(healthCheckService.check).toHaveBeenCalledTimes(3);

      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("service");
      expect(result).toHaveProperty("version");
      expect(result).toHaveProperty("environment");
      expect(result).toHaveProperty("checks");
      expect(result).toHaveProperty("details");
      expect(result.checks).toEqual({
        basic: true,
        readiness: true,
        liveness: true,
      });
      expect(result.details).toEqual({
        basic: { status: "ok" },
        readiness: { status: "ok" },
        liveness: { status: "ok" },
      });
    });

    it("should include service info and timestamp", async () => {
      const before = new Date().toISOString();
      const result = await controller.detailed();
      const after = new Date().toISOString();

      expect(result.service).toBe("nestjs-api");
      expect(typeof result.version).toBe("string");
      expect(typeof result.environment).toBe("string");
      expect(result.timestamp >= before).toBe(true);
      expect(result.timestamp <= after).toBe(true);
    });
  });
});
