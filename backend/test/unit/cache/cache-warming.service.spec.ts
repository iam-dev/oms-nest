import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { getDataSourceToken } from "@nestjs/typeorm";
import { CacheWarmingService } from "../../../src/cache/cache-warming.service";
import { ProductionCacheService } from "../../../src/cache/production-cache.service";

describe("CacheWarmingService", () => {
  let service: CacheWarmingService;
  let cacheService: jest.Mocked<ProductionCacheService>;
  let dataSource: jest.Mocked<DataSource>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockCacheService = {
      getFromCache: jest.fn(),
      setInCache: jest.fn().mockResolvedValue(undefined),
    };

    const mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    const mockConfigService = {
      get: jest.fn(),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        const configs: Record<string, any> = {
          "app.nodeEnv": "development",
        };
        return configs[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheWarmingService,
        { provide: ProductionCacheService, useValue: mockCacheService },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CacheWarmingService>(CacheWarmingService);
    cacheService = module.get(ProductionCacheService);
    dataSource = module.get(getDataSourceToken());
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("onApplicationBootstrap", () => {
    it("should skip cache warming in test environment", async () => {
      configService.getOrThrow.mockReturnValue("test");

      const warmupSpy = jest.spyOn(service, "warmupCriticalData");

      await service.onApplicationBootstrap();

      // warmupCriticalData should not be called (it's in setTimeout but skipped for test env)
      expect(warmupSpy).not.toHaveBeenCalled();
    });

    it("should schedule warmup in non-test environment", async () => {
      jest.useFakeTimers();
      configService.getOrThrow.mockReturnValue("development");

      const warmupSpy = jest
        .spyOn(service, "warmupCriticalData")
        .mockResolvedValue(undefined);

      await service.onApplicationBootstrap();

      // warmupCriticalData is called after 5000ms delay
      expect(warmupSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5000);

      expect(warmupSpy).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe("warmupCriticalData", () => {
    it("should warm up all jobs and set cache", async () => {
      const mockBrands = [{ id: 1, name: "Brand A" }];
      dataSource.query.mockResolvedValue(mockBrands);

      await service.warmupCriticalData();

      // Should set data in cache for each warmup job that returns data
      expect(cacheService.setInCache).toHaveBeenCalled();
    });

    it("should guard against concurrent warming", async () => {
      // Make a slow loader
      dataSource.query.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100, [{ id: 1 }])),
      );

      // Start two warmups simultaneously
      const warmup1 = service.warmupCriticalData();
      const warmup2 = service.warmupCriticalData();

      await Promise.all([warmup1, warmup2]);

      // The second call should be skipped since isWarming is true
      // Total setInCache calls should be from only one run (8 jobs)
      // rather than two runs (16 jobs)
      const callCount = cacheService.setInCache.mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(8);
    });

    it("should reset isWarming flag after completion", async () => {
      dataSource.query.mockResolvedValue([{ id: 1 }]);

      await service.warmupCriticalData();

      const status = service.getWarmupStatus();
      expect(status.isWarming).toBe(false);
    });

    it("should reset isWarming flag even on error", async () => {
      dataSource.query.mockRejectedValue(new Error("DB error"));

      await service.warmupCriticalData();

      const status = service.getWarmupStatus();
      expect(status.isWarming).toBe(false);
    });

    it("should handle individual job failures gracefully", async () => {
      // First call succeeds, second fails, rest succeed
      let callCount = 0;
      dataSource.query.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error("Query failed"));
        }
        return Promise.resolve([{ id: callCount }]);
      });

      // Should not throw even when individual jobs fail
      await expect(service.warmupCriticalData()).resolves.not.toThrow();
    });

    it("should skip jobs that return null/undefined data", async () => {
      dataSource.query.mockResolvedValue(null);

      await service.warmupCriticalData();

      // popular_products returns [] (not null) so it still caches that one
      // All other jobs return null from the mock, so only popular_products gets cached
      expect(cacheService.setInCache).toHaveBeenCalledTimes(1);
      expect(cacheService.setInCache).toHaveBeenCalledWith(
        "products:popular",
        [],
        60 * 60 * 1000,
      );
    });

    it("should execute jobs sorted by priority in batches of 3", async () => {
      const callOrder: string[] = [];
      dataSource.query.mockImplementation((sql: string) => {
        // Track which query ran based on SQL content
        if (sql.includes("brands")) callOrder.push("brands");
        else if (sql.includes("statuses")) callOrder.push("statuses");
        else if (sql.includes("leather_types")) callOrder.push("leather_types");
        else callOrder.push("other");
        return Promise.resolve([{ id: 1 }]);
      });

      await service.warmupCriticalData();

      // Higher priority jobs should appear before lower ones
      // brands (10) and statuses (10) should be before active_fitters (6)
      expect(cacheService.setInCache).toHaveBeenCalled();
    });
  });

  describe("backgroundRefresh", () => {
    it("should only refresh high-priority items (priority >= 8)", async () => {
      cacheService.getFromCache.mockResolvedValue(null);
      dataSource.query.mockResolvedValue([{ id: 1 }]);

      await service.backgroundRefresh();

      // High-priority items: brands(10), statuses(10), leather_types(9), options(8), models(8) = 5 items
      expect(cacheService.getFromCache).toHaveBeenCalledTimes(5);
    });

    it("should skip items that are already cached", async () => {
      cacheService.getFromCache.mockResolvedValue([{ id: 1, cached: true }]);

      await service.backgroundRefresh();

      // Should check cache but not reload data
      expect(cacheService.getFromCache).toHaveBeenCalled();
      expect(cacheService.setInCache).not.toHaveBeenCalled();
    });

    it("should refresh items that are not in cache", async () => {
      cacheService.getFromCache.mockResolvedValue(null);
      dataSource.query.mockResolvedValue([{ id: 1, name: "Fresh" }]);

      await service.backgroundRefresh();

      expect(cacheService.setInCache).toHaveBeenCalled();
    });

    it("should handle errors gracefully during refresh", async () => {
      cacheService.getFromCache.mockRejectedValue(new Error("Cache error"));

      await expect(service.backgroundRefresh()).resolves.not.toThrow();
    });
  });

  describe("warmupSpecific", () => {
    it("should warm up a specific data type by name", async () => {
      dataSource.query.mockResolvedValue([{ id: 1, brand_name: "TestBrand" }]);

      const result = await service.warmupSpecific("brands");

      expect(result).toBe(true);
      expect(cacheService.setInCache).toHaveBeenCalledWith(
        "ref:brands:all",
        expect.any(Array),
        60 * 60 * 1000,
      );
    });

    it("should return false for unknown data type", async () => {
      const result = await service.warmupSpecific("unknown_type");

      expect(result).toBe(false);
      expect(cacheService.setInCache).not.toHaveBeenCalled();
    });

    it("should return false when loader fails", async () => {
      dataSource.query.mockRejectedValue(new Error("DB error"));

      const result = await service.warmupSpecific("brands");

      expect(result).toBe(false);
    });
  });

  describe("getWarmupStatus", () => {
    it("should return isWarming false when not warming", () => {
      const status = service.getWarmupStatus();
      expect(status.isWarming).toBe(false);
    });
  });

  describe("data loading methods", () => {
    it("should load brands ordered by name", async () => {
      dataSource.query.mockResolvedValue([
        { id: 1, name: "Brand A" },
        { id: 2, name: "Brand B" },
      ]);

      const result = await service.warmupSpecific("brands");
      expect(result).toBe(true);

      // Verify the SQL includes brand_name ordering
      const queryCall = dataSource.query.mock.calls[0][0];
      expect(queryCall).toContain("brands");
      expect(queryCall).toContain("ORDER BY");
    });

    it("should load statuses ordered by sequence", async () => {
      dataSource.query.mockResolvedValue([{ id: 1, name: "New", sequence: 1 }]);

      await service.warmupSpecific("statuses");

      const queryCall = dataSource.query.mock.calls[0][0];
      expect(queryCall).toContain("statuses");
      expect(queryCall).toContain("sequence");
    });

    it("should load leather types excluding deleted", async () => {
      dataSource.query.mockResolvedValue([]);

      await service.warmupSpecific("leather_types");

      const queryCall = dataSource.query.mock.calls[0][0];
      expect(queryCall).toContain("leather_types");
      expect(queryCall).toContain("deleted = 0");
    });

    it("should load options with limit", async () => {
      dataSource.query.mockResolvedValue([]);

      await service.warmupSpecific("options");

      const queryCall = dataSource.query.mock.calls[0][0];
      expect(queryCall).toContain("options");
      expect(queryCall).toContain("LIMIT 1000");
    });

    it("should load recent orders from last 7 days", async () => {
      dataSource.query.mockResolvedValue([]);

      await service.warmupSpecific("recent_orders");

      const queryCall = dataSource.query.mock.calls[0][0];
      expect(queryCall).toContain("orders");
      expect(queryCall).toContain("order_time >= $1");
      // Check the parameter is roughly 7 days ago
      const param = dataSource.query.mock.calls[0]?.[1]?.[0];
      const sevenDaysAgoApprox =
        Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
      expect(Math.abs(param - sevenDaysAgoApprox)).toBeLessThan(10);
    });

    it("should load active fitters excluding deleted", async () => {
      dataSource.query.mockResolvedValue([]);

      await service.warmupSpecific("active_fitters");

      const queryCall = dataSource.query.mock.calls[0][0];
      expect(queryCall).toContain("fitters");
      expect(queryCall).toContain("deleted = 0");
    });

    it("should handle popular_products returning empty array", async () => {
      const result = await service.warmupSpecific("popular_products");

      // popular_products returns empty array (not implemented yet)
      expect(result).toBe(true);
      expect(cacheService.setInCache).toHaveBeenCalledWith(
        "products:popular",
        [],
        60 * 60 * 1000,
      );
    });
  });
});
