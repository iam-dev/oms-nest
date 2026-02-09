import { Test, TestingModule } from "@nestjs/testing";
import { CacheManagementController } from "../../../src/cache/cache-management.controller";
import { ProductionCacheService } from "../../../src/cache/production-cache.service";
import { CacheWarmingService } from "../../../src/cache/cache-warming.service";
import { CacheMetricsService } from "../../../src/cache/cache-metrics.service";
import { CacheInvalidationService } from "../../../src/cache/cache-invalidation.service";

describe("CacheManagementController", () => {
  let controller: CacheManagementController;
  let cacheService: {
    getCacheStats: jest.Mock;
    clearAllCaches: jest.Mock;
    invalidatePattern: jest.Mock;
    invalidateByTag: jest.Mock;
    getFromCache: jest.Mock;
    setInCache: jest.Mock;
  };
  let warmingService: {
    getWarmupStatus: jest.Mock;
    warmupCriticalData: jest.Mock;
    warmupSpecific: jest.Mock;
  };
  let metricsService: {
    getCacheHealth: jest.Mock;
    getCacheMetrics: jest.Mock;
    getEndpointMetrics: jest.Mock;
    generatePerformanceReport: jest.Mock;
    resetMetrics: jest.Mock;
  };
  let invalidationService: {
    invalidateEntityCaches: jest.Mock;
    getCacheStats: jest.Mock;
  };

  beforeEach(async () => {
    cacheService = {
      getCacheStats: jest.fn().mockResolvedValue({
        hitRate: 0.85,
        totalHits: 850,
        totalMisses: 150,
        totalOperations: 1000,
        memoryUsage: 500000000,
        keyCount: 5000,
        uptime: 3600000,
      }),
      clearAllCaches: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
      invalidateByTag: jest.fn().mockResolvedValue(undefined),
      getFromCache: jest.fn().mockResolvedValue(null),
      setInCache: jest.fn().mockResolvedValue(undefined),
    };

    warmingService = {
      getWarmupStatus: jest.fn().mockReturnValue({ isWarming: false }),
      warmupCriticalData: jest.fn().mockResolvedValue(undefined),
      warmupSpecific: jest.fn().mockResolvedValue(true),
    };

    metricsService = {
      getCacheHealth: jest.fn().mockResolvedValue("healthy"),
      getCacheMetrics: jest.fn().mockResolvedValue({
        hitRate: 0.85,
        hitRateTarget: 85,
        hitRateStatus: "good",
        totalHits: 850,
        totalMisses: 150,
        totalOperations: 1000,
        averageResponseTime: 0,
        uptime: 3600000,
        trends: { hitRateChange: 0, operationsChange: 0 },
        healthChecks: {
          redis: "healthy",
          cache: "healthy",
          overall: "healthy",
        },
        alerts: [],
      }),
      getEndpointMetrics: jest.fn().mockReturnValue([]),
      generatePerformanceReport: jest.fn().mockResolvedValue({
        summary: {},
        topEndpoints: [],
        recommendations: ["Cache performance is optimal."],
      }),
      resetMetrics: jest.fn(),
    };

    invalidationService = {
      invalidateEntityCaches: jest.fn().mockResolvedValue(undefined),
      getCacheStats: jest.fn().mockResolvedValue({
        queueLength: 0,
        processingJobs: 0,
        completedJobs: 10,
        failedJobs: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CacheManagementController],
      providers: [
        { provide: ProductionCacheService, useValue: cacheService },
        { provide: CacheWarmingService, useValue: warmingService },
        { provide: CacheMetricsService, useValue: metricsService },
        { provide: CacheInvalidationService, useValue: invalidationService },
      ],
    }).compile();

    controller = module.get<CacheManagementController>(
      CacheManagementController,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getCacheStats", () => {
    it("should return cache statistics from the cache service", async () => {
      const result = await controller.getCacheStats();

      expect(result).toBeDefined();
      expect(result.hitRate).toBe(0.85);
      expect(result.totalHits).toBe(850);
      expect(result.totalMisses).toBe(150);
      expect(result.totalOperations).toBe(1000);
      expect(cacheService.getCacheStats).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCacheHealth", () => {
    it("should return healthy status", async () => {
      const result = await controller.getCacheHealth();

      expect(result).toEqual({ status: "healthy" });
      expect(metricsService.getCacheHealth).toHaveBeenCalledTimes(1);
    });

    it("should return degraded status when cache is degraded", async () => {
      metricsService.getCacheHealth.mockResolvedValue("degraded");

      const result = await controller.getCacheHealth();

      expect(result).toEqual({ status: "degraded" });
    });

    it("should return unhealthy status when cache is unhealthy", async () => {
      metricsService.getCacheHealth.mockResolvedValue("unhealthy");

      const result = await controller.getCacheHealth();

      expect(result).toEqual({ status: "unhealthy" });
    });
  });

  describe("getCacheMetrics", () => {
    it("should return comprehensive cache metrics", async () => {
      const result = await controller.getCacheMetrics();

      expect(result).toBeDefined();
      expect(result.hitRate).toBe(0.85);
      expect(metricsService.getCacheMetrics).toHaveBeenCalledTimes(1);
    });
  });

  describe("getEndpointMetrics", () => {
    it("should return endpoint metrics wrapped in object", async () => {
      const endpointData = [
        {
          endpoint: "/api/v1/orders",
          hitRate: 90,
          averageResponseTime: 15,
          totalRequests: 100,
          cacheHits: 90,
          cacheMisses: 10,
          lastAccessed: new Date(),
        },
      ];
      metricsService.getEndpointMetrics.mockReturnValue(endpointData);

      const result = await controller.getEndpointMetrics();

      expect(result).toEqual({ endpoints: endpointData });
    });
  });

  describe("getPerformanceReport", () => {
    it("should return a performance report", async () => {
      const result = await controller.getPerformanceReport();

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.topEndpoints).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(metricsService.generatePerformanceReport).toHaveBeenCalledTimes(1);
    });
  });

  describe("getWarmupStatus", () => {
    it("should return current warmup status", () => {
      const result = controller.getWarmupStatus();

      expect(result).toEqual({ isWarming: false });
      expect(warmingService.getWarmupStatus).toHaveBeenCalledTimes(1);
    });

    it("should return warming in progress", () => {
      warmingService.getWarmupStatus.mockReturnValue({ isWarming: true });

      const result = controller.getWarmupStatus();

      expect(result).toEqual({ isWarming: true });
    });
  });

  describe("startCacheWarming", () => {
    it("should start cache warming and return accepted status", async () => {
      const result = await controller.startCacheWarming();

      expect(result).toEqual({
        message: "Cache warming started",
        status: "accepted",
      });
    });
  });

  describe("warmSpecificDataType", () => {
    it("should warm specific data type successfully", async () => {
      warmingService.warmupSpecific.mockResolvedValue(true);

      const result = await controller.warmSpecificDataType("brands");

      expect(result).toEqual({
        message: "Cache warming completed for brands",
        status: "success",
      });
      expect(warmingService.warmupSpecific).toHaveBeenCalledWith("brands");
    });

    it("should return error when data type not found", async () => {
      warmingService.warmupSpecific.mockResolvedValue(false);

      const result = await controller.warmSpecificDataType("nonexistent");

      expect(result).toEqual({
        message: "Data type 'nonexistent' not found",
        status: "error",
      });
    });
  });

  describe("clearAllCaches", () => {
    it("should clear all caches and return success", async () => {
      const result = await controller.clearAllCaches();

      expect(result).toEqual({
        message: "All caches cleared successfully",
        status: "success",
      });
      expect(cacheService.clearAllCaches).toHaveBeenCalledTimes(1);
    });

    it("should propagate errors from cache service", async () => {
      cacheService.clearAllCaches.mockRejectedValue(
        new Error("Failed to clear"),
      );

      await expect(controller.clearAllCaches()).rejects.toThrow(
        "Failed to clear",
      );
    });
  });

  describe("invalidateCachePattern", () => {
    it("should invalidate cache by pattern", async () => {
      const result = await controller.invalidateCachePattern("order:*");

      expect(result).toEqual({
        message: "Cache invalidated for pattern: order:*",
        status: "success",
      });
      expect(cacheService.invalidatePattern).toHaveBeenCalledWith("order:*");
    });
  });

  describe("invalidateCacheByTag", () => {
    it("should invalidate cache by tag", async () => {
      const result = await controller.invalidateCacheByTag("orders");

      expect(result).toEqual({
        message: "Cache invalidated for tag: orders",
        status: "success",
      });
      expect(cacheService.invalidateByTag).toHaveBeenCalledWith("orders");
    });
  });

  describe("invalidateEntityCache", () => {
    it("should invalidate entity cache with entity type and operation", async () => {
      const result = await controller.invalidateEntityCache(
        "order",
        "123",
        "update",
      );

      expect(result).toEqual({
        message: "Cache invalidated for order:123 (update)",
        status: "success",
      });
      expect(invalidationService.invalidateEntityCaches).toHaveBeenCalledWith({
        entityType: "order",
        entityId: "123",
        operation: "update",
      });
    });

    it("should handle entity invalidation without entityId", async () => {
      const result = await controller.invalidateEntityCache(
        "customer",
        undefined,
        "create",
      );

      expect(result).toEqual({
        message: "Cache invalidated for customer (create)",
        status: "success",
      });
    });
  });

  describe("getInvalidationStats", () => {
    it("should return invalidation queue statistics", async () => {
      const result = await controller.getInvalidationStats();

      expect(result).toEqual({
        queueLength: 0,
        processingJobs: 0,
        completedJobs: 10,
        failedJobs: 0,
      });
      expect(invalidationService.getCacheStats).toHaveBeenCalledTimes(1);
    });
  });

  describe("runLoadTest", () => {
    it("should run load test with default request count", async () => {
      const result = await controller.runLoadTest();

      expect(result).toBeDefined();
      expect(result.message).toBe("Load test completed");
      expect(result.results).toBeDefined();
      expect(result.results.totalOperations).toBe(1000);
    });

    it("should run load test with custom request count", async () => {
      const result = await controller.runLoadTest("100");

      expect(result).toBeDefined();
      expect(result.results.totalOperations).toBe(100);
    });
  });

  describe("resetMetrics", () => {
    it("should reset metrics and return success", () => {
      const result = controller.resetMetrics();

      expect(result).toEqual({
        message: "Cache metrics reset successfully",
        status: "success",
      });
      expect(metricsService.resetMetrics).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCacheConfig", () => {
    it("should return cache configuration", () => {
      const result = controller.getCacheConfig();

      expect(result).toBeDefined();
      expect(result.ttlStrategies).toBeDefined();
      expect(result.ttlStrategies.referenceData).toBe("60 minutes");
      expect(result.ttlStrategies.searchResults).toBe("5-10 minutes");
      expect(result.features).toBeDefined();
      expect(result.targets).toBeDefined();
      expect(result.targets.hitRate).toBe(">85%");
    });
  });
});
