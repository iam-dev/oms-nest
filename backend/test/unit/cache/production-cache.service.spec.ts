import { Test, TestingModule } from "@nestjs/testing";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";
import { ProductionCacheService } from "../../../src/cache/production-cache.service";
import { REDIS_SCAN_CLIENT } from "../../../src/cache/cache.constants";
import { createMockCacheManager } from "../helpers/test-helpers";

describe("ProductionCacheService", () => {
  let service: ProductionCacheService;
  let cacheManager: ReturnType<typeof createMockCacheManager>;
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };

  beforeEach(async () => {
    cacheManager = createMockCacheManager();
    configService = {
      get: jest.fn().mockReturnValue("test"),
      getOrThrow: jest.fn().mockReturnValue("test"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductionCacheService,
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: REDIS_SCAN_CLIENT,
          useValue: null,
        },
      ],
    }).compile();

    service = module.get<ProductionCacheService>(ProductionCacheService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getReferenceData", () => {
    it("should return cached data and increment hits on cache hit", async () => {
      const brandData = [{ id: 1, name: "Brand A" }];
      cacheManager.get.mockResolvedValue(brandData);

      const result = await service.getReferenceData("BRANDS");

      expect(result).toEqual(brandData);
      expect(cacheManager.get).toHaveBeenCalledWith("ref:brands:all");

      // Verify hits incremented by checking stats
      const stats = await service.getCacheStats();
      expect(stats.totalHits).toBe(1);
    });

    it("should increment misses on cache miss", async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await service.getReferenceData("BRANDS");

      expect(result).toBeNull();

      const stats = await service.getCacheStats();
      expect(stats.totalMisses).toBe(1);
    });

    it("should return null on cache miss", async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await service.getReferenceData("STATUSES", "123");

      expect(result).toBeNull();
      expect(cacheManager.get).toHaveBeenCalledWith("ref:statuses:123");
    });
  });

  describe("setReferenceData", () => {
    it("should call setInCache with correct TTL for BRANDS", async () => {
      const data = [{ id: 1, name: "Brand A" }];
      cacheManager.set.mockResolvedValue(undefined);

      await service.setReferenceData("BRANDS", data);

      expect(cacheManager.set).toHaveBeenCalledWith(
        "ref:brands:all",
        data,
        3600000, // 60 min
      );
    });

    it("should build correct key format with id", async () => {
      const data = { id: 5, name: "Brand B" };
      cacheManager.set.mockResolvedValue(undefined);

      await service.setReferenceData("BRANDS", data, "5");

      expect(cacheManager.set).toHaveBeenCalledWith(
        "ref:brands:5",
        data,
        3600000,
      );
    });

    it("should use correct TTL for LEATHER_TYPES", async () => {
      cacheManager.set.mockResolvedValue(undefined);

      await service.setReferenceData("LEATHER_TYPES", []);

      expect(cacheManager.set).toHaveBeenCalledWith(
        "ref:leather_types:all",
        [],
        3600000, // 60 min
      );
    });

    it("should use correct TTL for OPTIONS", async () => {
      cacheManager.set.mockResolvedValue(undefined);

      await service.setReferenceData("OPTIONS", []);

      expect(cacheManager.set).toHaveBeenCalledWith(
        "ref:options:all",
        [],
        1800000, // 30 min
      );
    });
  });

  describe("getSearchResults", () => {
    it("should increment hits on search cache hit", async () => {
      const searchData = { data: [{ id: 1 }], total: 1 };
      cacheManager.get.mockResolvedValue(searchData);

      const result = await service.getSearchResults("test", { page: 1 });

      expect(result).toEqual(searchData);
      const stats = await service.getCacheStats();
      expect(stats.totalHits).toBe(1);
    });

    it("should increment misses on search cache miss", async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await service.getSearchResults("query", { page: 1 });

      expect(result).toBeNull();
      const stats = await service.getCacheStats();
      expect(stats.totalMisses).toBe(1);
    });
  });

  describe("setSearchResults", () => {
    it("should use correct TTL for ORDER_SEARCH type", async () => {
      cacheManager.set.mockResolvedValue(undefined);

      await service.setSearchResults(
        "query",
        { page: 1 },
        { data: [] },
        "ORDER",
      );

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        { data: [] },
        300000, // 5 min for ORDER_SEARCH
      );
    });

    it("should use DEFAULT TTL for unknown search type", async () => {
      cacheManager.set.mockResolvedValue(undefined);

      await service.setSearchResults("query", {}, { data: [] }, "UNKNOWN");

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.any(String),
        { data: [] },
        300000, // DEFAULT 5 min
      );
    });
  });

  describe("getUserSession", () => {
    it("should increment hits on session cache hit", async () => {
      const sessionData = { userId: "123", role: "admin" };
      cacheManager.get.mockResolvedValue(sessionData);

      const result = await service.getUserSession("123");

      expect(result).toEqual(sessionData);
      expect(cacheManager.get).toHaveBeenCalledWith("user_session:123");

      const stats = await service.getCacheStats();
      expect(stats.totalHits).toBe(1);
    });

    it("should increment misses on session cache miss", async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await service.getUserSession("999");

      expect(result).toBeNull();
      const stats = await service.getCacheStats();
      expect(stats.totalMisses).toBe(1);
    });
  });

  describe("getAuthToken", () => {
    it("should increment hits on auth token cache hit", async () => {
      const tokenData = { userId: "1", expiresAt: Date.now() };
      cacheManager.get.mockResolvedValue(tokenData);

      const result = await service.getAuthToken("token-abc");

      expect(result).toEqual(tokenData);
      expect(cacheManager.get).toHaveBeenCalledWith("auth_token:token-abc");

      const stats = await service.getCacheStats();
      expect(stats.totalHits).toBe(1);
    });

    it("should increment misses on auth token cache miss", async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await service.getAuthToken("expired-token");

      expect(result).toBeNull();
      const stats = await service.getCacheStats();
      expect(stats.totalMisses).toBe(1);
    });
  });

  describe("getFromCache", () => {
    it("should return data on success", async () => {
      const data = { key: "value" };
      cacheManager.get.mockResolvedValue(data);

      const result = await service.getFromCache("some-key");

      expect(result).toEqual(data);
      expect(cacheManager.get).toHaveBeenCalledWith("some-key");
    });

    it("should return null on error", async () => {
      cacheManager.get.mockRejectedValue(new Error("Connection refused"));

      const result = await service.getFromCache("some-key");

      expect(result).toBeNull();
    });
  });

  describe("setInCache", () => {
    it("should call cacheManager.set with TTL", async () => {
      cacheManager.set.mockResolvedValue(undefined);

      await service.setInCache("my-key", { foo: "bar" }, 60000);

      expect(cacheManager.set).toHaveBeenCalledWith(
        "my-key",
        { foo: "bar" },
        60000,
      );
    });

    it("should use DEFAULT TTL when none provided", async () => {
      cacheManager.set.mockResolvedValue(undefined);

      await service.setInCache("my-key", { foo: "bar" });

      expect(cacheManager.set).toHaveBeenCalledWith(
        "my-key",
        { foo: "bar" },
        300000, // DEFAULT = 5 min
      );
    });

    it("should handle errors gracefully", async () => {
      cacheManager.set.mockRejectedValue(new Error("Write failed"));

      // Should not throw
      await expect(
        service.setInCache("my-key", { foo: "bar" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("getCacheStats", () => {
    it("should return correct hit rate", async () => {
      // Simulate some hits and misses
      cacheManager.get.mockResolvedValueOnce({ data: "cached" }); // hit
      await service.getReferenceData("BRANDS");

      cacheManager.get.mockResolvedValueOnce(null); // miss
      await service.getReferenceData("STATUSES");

      cacheManager.get.mockResolvedValueOnce({ data: "cached" }); // hit
      await service.getReferenceData("OPTIONS");

      const stats = await service.getCacheStats();

      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.totalOperations).toBe(3);
      // hitRate = 2/3 = 0.666... rounded to 0.67
      expect(stats.hitRate).toBeCloseTo(0.67, 1);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    it("should return 0 hit rate when no operations", async () => {
      const stats = await service.getCacheStats();

      expect(stats.hitRate).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(stats.totalOperations).toBe(0);
    });
  });

  describe("clearAllCaches", () => {
    it("should call cacheManager.clear()", async () => {
      (cacheManager as any).clear = jest.fn().mockResolvedValue(undefined);

      await service.clearAllCaches();

      expect((cacheManager as any).clear).toHaveBeenCalled();
    });

    it("should reset hit/miss counters", async () => {
      // Generate some operations
      cacheManager.get.mockResolvedValue({ data: "cached" });
      await service.getReferenceData("BRANDS");

      (cacheManager as any).clear = jest.fn().mockResolvedValue(undefined);
      await service.clearAllCaches();

      const stats = await service.getCacheStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });
  });

  describe("invalidatePattern", () => {
    it("should handle null redis client gracefully", async () => {
      // redisScanClient is null in test setup
      // Should not throw
      await expect(
        service.invalidatePattern("test:*"),
      ).resolves.toBeUndefined();
    });
  });
});
