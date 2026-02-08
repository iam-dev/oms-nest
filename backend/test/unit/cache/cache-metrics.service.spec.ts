import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CacheMetricsService } from "../../../src/cache/cache-metrics.service";
import { ProductionCacheService } from "../../../src/cache/production-cache.service";

describe("CacheMetricsService", () => {
  let service: CacheMetricsService;
  let cacheService: {
    getCacheStats: jest.Mock;
    getFromCache: jest.Mock;
  };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };

  beforeEach(async () => {
    cacheService = {
      getCacheStats: jest.fn().mockResolvedValue({
        hitRate: 90,
        totalHits: 90,
        totalMisses: 10,
        totalOperations: 100,
        memoryUsage: undefined,
        keyCount: undefined,
        uptime: 60000,
      }),
      getFromCache: jest.fn().mockResolvedValue(null),
    };

    configService = {
      get: jest.fn().mockReturnValue("test"),
      getOrThrow: jest.fn().mockReturnValue("test"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheMetricsService,
        {
          provide: ProductionCacheService,
          useValue: cacheService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<CacheMetricsService>(CacheMetricsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getCacheMetrics", () => {
    it("should return comprehensive cache metrics", async () => {
      const metrics = await service.getCacheMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.hitRate).toBe(90);
      expect(metrics.totalHits).toBe(90);
      expect(metrics.totalMisses).toBe(10);
      expect(metrics.totalOperations).toBe(100);
      expect(metrics.hitRateTarget).toBe(85);
      expect(metrics.uptime).toBe(60000);
    });

    it("should include health checks in metrics", async () => {
      const metrics = await service.getCacheMetrics();

      expect(metrics.healthChecks).toBeDefined();
      expect(metrics.healthChecks.redis).toBeDefined();
      expect(metrics.healthChecks.cache).toBeDefined();
      expect(metrics.healthChecks.overall).toBeDefined();
    });

    it("should include trends in metrics", async () => {
      const metrics = await service.getCacheMetrics();

      expect(metrics.trends).toBeDefined();
      expect(metrics.trends.hitRateChange).toBeDefined();
      expect(metrics.trends.operationsChange).toBeDefined();
    });

    it("should return zero trends on first call (no previous stats)", async () => {
      const metrics = await service.getCacheMetrics();

      expect(metrics.trends.hitRateChange).toBe(0);
      expect(metrics.trends.operationsChange).toBe(0);
    });

    it("should calculate trends after second call", async () => {
      // First call sets previousStats
      await service.getCacheMetrics();

      // Change stats for second call
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 95,
        totalHits: 100,
        totalMisses: 10,
        totalOperations: 110,
        memoryUsage: undefined,
        keyCount: undefined,
        uptime: 120000,
      });

      const metrics = await service.getCacheMetrics();

      // hitRateChange = 95 - 90 = 5
      expect(metrics.trends.hitRateChange).toBeCloseTo(5, 2);
      // operationsChange = 110 - 100 = 10
      expect(metrics.trends.operationsChange).toBe(10);
    });

    it("should include alerts array", async () => {
      const metrics = await service.getCacheMetrics();

      expect(metrics.alerts).toBeDefined();
      expect(Array.isArray(metrics.alerts)).toBe(true);
    });

    it("should set hit rate status to good when above target", async () => {
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 90,
        totalHits: 90,
        totalMisses: 10,
        totalOperations: 100,
        uptime: 60000,
      });

      const metrics = await service.getCacheMetrics();

      expect(metrics.hitRateStatus).toBe("good");
    });

    it("should set hit rate status to warning when between 80% and 100% of target", async () => {
      // hitRateTarget = 85, 80% of target = 68
      // hitRate of 70 is between 68 and 85 => warning
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 70,
        totalHits: 70,
        totalMisses: 30,
        totalOperations: 100,
        uptime: 60000,
      });

      const metrics = await service.getCacheMetrics();

      expect(metrics.hitRateStatus).toBe("warning");
    });

    it("should set hit rate status to critical when below 80% of target", async () => {
      // hitRateTarget = 85, 80% of target = 68
      // hitRate of 50 is below 68 => critical
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 50,
        totalHits: 50,
        totalMisses: 50,
        totalOperations: 100,
        uptime: 60000,
      });

      const metrics = await service.getCacheMetrics();

      expect(metrics.hitRateStatus).toBe("critical");
    });
  });

  describe("recordCacheOperation", () => {
    it("should record a new endpoint hit", () => {
      service.recordCacheOperation("/api/v1/orders", true, 10);

      const endpoints = service.getEndpointMetrics();

      expect(endpoints.length).toBe(1);
      expect(endpoints[0].endpoint).toBe("/api/v1/orders");
      expect(endpoints[0].cacheHits).toBe(1);
      expect(endpoints[0].cacheMisses).toBe(0);
      expect(endpoints[0].hitRate).toBe(100);
      expect(endpoints[0].totalRequests).toBe(1);
      expect(endpoints[0].averageResponseTime).toBe(10);
    });

    it("should record a new endpoint miss", () => {
      service.recordCacheOperation("/api/v1/orders", false, 50);

      const endpoints = service.getEndpointMetrics();

      expect(endpoints.length).toBe(1);
      expect(endpoints[0].cacheHits).toBe(0);
      expect(endpoints[0].cacheMisses).toBe(1);
      expect(endpoints[0].hitRate).toBe(0);
    });

    it("should accumulate metrics for the same endpoint", () => {
      service.recordCacheOperation("/api/v1/orders", true, 10);
      service.recordCacheOperation("/api/v1/orders", true, 20);
      service.recordCacheOperation("/api/v1/orders", false, 100);

      const endpoints = service.getEndpointMetrics();

      expect(endpoints.length).toBe(1);
      expect(endpoints[0].totalRequests).toBe(3);
      expect(endpoints[0].cacheHits).toBe(2);
      expect(endpoints[0].cacheMisses).toBe(1);
      // hitRate = 2/3 * 100 = 66.66...
      expect(endpoints[0].hitRate).toBeCloseTo(66.67, 0);
    });

    it("should track metrics for multiple endpoints separately", () => {
      service.recordCacheOperation("/api/v1/orders", true, 10);
      service.recordCacheOperation("/api/v1/customers", false, 50);

      const endpoints = service.getEndpointMetrics();

      expect(endpoints.length).toBe(2);
    });

    it("should calculate average response time correctly", () => {
      service.recordCacheOperation("/api/v1/orders", true, 10);
      service.recordCacheOperation("/api/v1/orders", true, 30);

      const endpoints = service.getEndpointMetrics();

      // Average = (10 + 30) / 2 = 20
      expect(endpoints[0].averageResponseTime).toBe(20);
    });
  });

  describe("getEndpointMetrics", () => {
    it("should return empty array when no metrics recorded", () => {
      const metrics = service.getEndpointMetrics();

      expect(metrics).toEqual([]);
    });

    it("should sort endpoints by total requests descending", () => {
      service.recordCacheOperation("/api/v1/orders", true, 10);
      service.recordCacheOperation("/api/v1/orders", true, 10);
      service.recordCacheOperation("/api/v1/orders", true, 10);
      service.recordCacheOperation("/api/v1/customers", true, 10);

      const metrics = service.getEndpointMetrics();

      expect(metrics[0].endpoint).toBe("/api/v1/orders");
      expect(metrics[0].totalRequests).toBe(3);
      expect(metrics[1].endpoint).toBe("/api/v1/customers");
      expect(metrics[1].totalRequests).toBe(1);
    });
  });

  describe("getCacheHealth", () => {
    it("should return healthy when hit rate meets target and enough operations", async () => {
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 90,
        totalHits: 90,
        totalMisses: 10,
        totalOperations: 100,
        uptime: 60000,
      });

      const health = await service.getCacheHealth();

      expect(health).toBe("healthy");
    });

    it("should return healthy when not enough operations for evaluation", async () => {
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 10,
        totalHits: 1,
        totalMisses: 9,
        totalOperations: 10,
        uptime: 60000,
      });

      const health = await service.getCacheHealth();

      // Less than 100 operations, assume healthy
      expect(health).toBe("healthy");
    });

    it("should return degraded when hit rate is below target but above 80% of target", async () => {
      // target = 85, 80% = 68
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 70,
        totalHits: 700,
        totalMisses: 300,
        totalOperations: 1000,
        uptime: 60000,
      });

      const health = await service.getCacheHealth();

      expect(health).toBe("degraded");
    });

    it("should return unhealthy when hit rate is very low", async () => {
      // target = 85, 80% = 68
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 50,
        totalHits: 500,
        totalMisses: 500,
        totalOperations: 1000,
        uptime: 60000,
      });

      const health = await service.getCacheHealth();

      expect(health).toBe("unhealthy");
    });

    it("should return degraded when memory usage is high", async () => {
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 90,
        totalHits: 90,
        totalMisses: 10,
        totalOperations: 100,
        memoryUsage: 1500000000, // 1.5 GB
        uptime: 60000,
      });

      const health = await service.getCacheHealth();

      expect(health).toBe("degraded");
    });

    it("should return unhealthy when memory usage is very high", async () => {
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 90,
        totalHits: 90,
        totalMisses: 10,
        totalOperations: 100,
        memoryUsage: 2500000000, // 2.5 GB
        uptime: 60000,
      });

      const health = await service.getCacheHealth();

      expect(health).toBe("unhealthy");
    });

    it("should return unhealthy when getCacheStats throws", async () => {
      cacheService.getCacheStats.mockRejectedValue(
        new Error("Redis connection failed"),
      );

      const health = await service.getCacheHealth();

      expect(health).toBe("unhealthy");
    });
  });

  describe("generatePerformanceReport", () => {
    it("should return summary, top endpoints, and recommendations", async () => {
      const report = await service.generatePerformanceReport();

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.topEndpoints).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it("should include optimal recommendation when performance is good", async () => {
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 90,
        totalHits: 90,
        totalMisses: 10,
        totalOperations: 100,
        uptime: 60000,
      });

      const report = await service.generatePerformanceReport();

      expect(report.recommendations).toEqual(
        expect.arrayContaining([expect.stringContaining("optimal")]),
      );
    });

    it("should recommend increasing TTL when hit rate is below target", async () => {
      cacheService.getCacheStats.mockResolvedValue({
        hitRate: 50,
        totalHits: 50,
        totalMisses: 50,
        totalOperations: 100,
        uptime: 60000,
      });

      const report = await service.generatePerformanceReport();

      expect(report.recommendations).toEqual(
        expect.arrayContaining([expect.stringContaining("TTL")]),
      );
    });

    it("should limit top endpoints to 10", async () => {
      // Record 15 endpoints
      for (let i = 0; i < 15; i++) {
        service.recordCacheOperation(`/api/v1/endpoint${i}`, true, 10);
      }

      const report = await service.generatePerformanceReport();

      expect(report.topEndpoints.length).toBeLessThanOrEqual(10);
    });
  });

  describe("collectMetrics (cron job)", () => {
    it("should collect metrics without throwing", async () => {
      await expect(service.collectMetrics()).resolves.toBeUndefined();
    });

    it("should handle errors in collectMetrics gracefully", async () => {
      cacheService.getCacheStats.mockRejectedValue(new Error("Redis down"));

      // Should not throw
      await expect(service.collectMetrics()).resolves.toBeUndefined();
    });
  });

  describe("resetMetrics", () => {
    it("should clear all performance metrics", () => {
      service.recordCacheOperation("/api/v1/orders", true, 10);
      service.recordCacheOperation("/api/v1/customers", false, 50);

      expect(service.getEndpointMetrics().length).toBe(2);

      service.resetMetrics();

      expect(service.getEndpointMetrics().length).toBe(0);
    });

    it("should reset previous stats for trend calculation", async () => {
      // First call to set previousStats
      await service.getCacheMetrics();

      // Reset
      service.resetMetrics();

      // After reset, trends should be zero again
      const metrics = await service.getCacheMetrics();
      expect(metrics.trends.hitRateChange).toBe(0);
      expect(metrics.trends.operationsChange).toBe(0);
    });
  });
});
