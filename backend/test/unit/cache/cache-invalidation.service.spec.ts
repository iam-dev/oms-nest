import { Test, TestingModule } from "@nestjs/testing";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { getQueueToken } from "@nestjs/bullmq";
import {
  CacheInvalidationService,
  CacheInvalidationContext,
} from "../../../src/cache/cache-invalidation.service";
import {
  createMockCacheManager,
  createMockBullQueue,
} from "../helpers/test-helpers";

describe("CacheInvalidationService", () => {
  let service: CacheInvalidationService;
  let cacheManager: ReturnType<typeof createMockCacheManager>;
  let queue: ReturnType<typeof createMockBullQueue>;

  beforeEach(async () => {
    cacheManager = createMockCacheManager();
    queue = createMockBullQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidationService,
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
        {
          provide: getQueueToken("cache-invalidation"),
          useValue: queue,
        },
      ],
    }).compile();

    service = module.get<CacheInvalidationService>(CacheInvalidationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("invalidateEntityCaches", () => {
    it("should call invalidation for order entity", async () => {
      const context: CacheInvalidationContext = {
        entityType: "order",
        entityId: "123",
        operation: "update",
      };

      await service.invalidateEntityCaches(context);

      // Should queue related cache invalidation patterns
      expect(queue.add).toHaveBeenCalled();
    });

    it("should include customer LTV in related patterns for orders", async () => {
      const context: CacheInvalidationContext = {
        entityType: "order",
        entityId: "456",
        operation: "create",
      };

      await service.invalidateEntityCaches(context);

      // The queue should have been called with customer_ltv_view patterns
      const addCalls = queue.add.mock.calls;
      const patterns = addCalls
        .filter((call: any) => call[0] === "invalidate-pattern")
        .map((call: any) => call[1]?.pattern);

      expect(patterns).toContain("customer_ltv_view:*");
    });

    it("should schedule materialized view refresh for orders", async () => {
      const context: CacheInvalidationContext = {
        entityType: "order",
        entityId: "789",
        operation: "update",
      };

      await service.invalidateEntityCaches(context);

      const addCalls = queue.add.mock.calls;
      const refreshCalls = addCalls.filter(
        (call: any) => call[0] === "refresh-materialized-view",
      );

      expect(refreshCalls.length).toBeGreaterThan(0);
      expect(refreshCalls[0][1]).toMatchObject({
        entityType: "order",
        operation: "update",
      });
    });

    it("should not throw on error", async () => {
      cacheManager.del.mockRejectedValue(new Error("Redis error"));

      const context: CacheInvalidationContext = {
        entityType: "order",
        entityId: "123",
        operation: "delete",
      };

      await expect(
        service.invalidateEntityCaches(context),
      ).resolves.not.toThrow();
    });
  });

  describe("invalidateMultipleEntityCaches", () => {
    it("should process multiple entities", async () => {
      const contexts: CacheInvalidationContext[] = [
        { entityType: "order", entityId: "1", operation: "update" },
        { entityType: "customer", entityId: "2", operation: "update" },
        { entityType: "order", entityId: "3", operation: "create" },
      ];

      await service.invalidateMultipleEntityCaches(contexts);

      // Should have processed -- the queue should be called
      expect(queue.add).toHaveBeenCalled();
    });
  });

  describe("getCacheStats", () => {
    it("should return queue statistics from bull queue", async () => {
      queue.getWaiting.mockResolvedValue([{ id: "1" }, { id: "2" }]);
      queue.getActive.mockResolvedValue([{ id: "3" }]);
      queue.getCompleted.mockResolvedValue([
        { id: "4" },
        { id: "5" },
        { id: "6" },
      ]);
      queue.getFailed.mockResolvedValue([{ id: "7" }]);

      const stats = await service.getCacheStats();

      expect(stats).toEqual({
        queueLength: 2,
        processingJobs: 1,
        completedJobs: 3,
        failedJobs: 1,
      });
    });
  });

  describe("clearAllCaches", () => {
    it("should call cacheManager.clear()", async () => {
      (cacheManager as any).clear = jest.fn().mockResolvedValue(undefined);

      await service.clearAllCaches();

      expect((cacheManager as any).clear).toHaveBeenCalled();
    });
  });

  describe("getCachePatterns (tested indirectly)", () => {
    it("should include analytics patterns for order entity", async () => {
      const context: CacheInvalidationContext = {
        entityType: "order",
        entityId: "100",
        operation: "update",
      };

      await service.invalidateEntityCaches(context);

      const addCalls = queue.add.mock.calls;
      const patterns = addCalls
        .filter((call: any) => call[0] === "invalidate-pattern")
        .map((call: any) => call[1]?.pattern);

      expect(patterns).toContain("analytics:*");
    });

    it("should include customer_ltv for customer entity", async () => {
      const context: CacheInvalidationContext = {
        entityType: "customer",
        entityId: "200",
        operation: "update",
      };

      await service.invalidateEntityCaches(context);

      const addCalls = queue.add.mock.calls;
      const patterns = addCalls
        .filter((call: any) => call[0] === "invalidate-pattern")
        .map((call: any) => call[1]?.pattern);

      expect(patterns).toContain("customer_ltv_view:*");
    });

    it("should get generic patterns for unknown entity", async () => {
      const context: CacheInvalidationContext = {
        entityType: "widget",
        entityId: "300",
        operation: "create",
      };

      await service.invalidateEntityCaches(context);

      // Should still have been called with some patterns (the generic ones)
      expect(queue.add).toHaveBeenCalled();
    });
  });

  describe("shouldRefreshMaterializedView (tested indirectly)", () => {
    it("should return true for order (schedules refresh)", async () => {
      const context: CacheInvalidationContext = {
        entityType: "order",
        entityId: "1",
        operation: "create",
      };

      await service.invalidateEntityCaches(context);

      const refreshCalls = queue.add.mock.calls.filter(
        (call: any) => call[0] === "refresh-materialized-view",
      );
      expect(refreshCalls.length).toBeGreaterThan(0);
    });

    it("should return false for unknown entity (no refresh scheduled)", async () => {
      const context: CacheInvalidationContext = {
        entityType: "unknown_entity",
        entityId: "1",
        operation: "create",
      };

      await service.invalidateEntityCaches(context);

      const refreshCalls = queue.add.mock.calls.filter(
        (call: any) => call[0] === "refresh-materialized-view",
      );
      expect(refreshCalls.length).toBe(0);
    });
  });

  describe("getRefreshPriority (tested indirectly)", () => {
    it("should give order higher priority than fitter", async () => {
      // Invalidate order
      await service.invalidateEntityCaches({
        entityType: "order",
        entityId: "1",
        operation: "update",
      });

      const orderRefreshCalls = queue.add.mock.calls.filter(
        (call: any) => call[0] === "refresh-materialized-view",
      );
      const orderPriority = orderRefreshCalls[0]?.[2]?.priority;

      queue.add.mockClear();

      // Invalidate fitter
      await service.invalidateEntityCaches({
        entityType: "fitter",
        entityId: "2",
        operation: "update",
      });

      const fitterRefreshCalls = queue.add.mock.calls.filter(
        (call: any) => call[0] === "refresh-materialized-view",
      );
      const fitterPriority = fitterRefreshCalls[0]?.[2]?.priority;

      expect(orderPriority).toBeGreaterThan(fitterPriority);
    });
  });

  describe("getRefreshDelay (tested indirectly)", () => {
    it("should give order a faster refresh than fitter", async () => {
      // Invalidate order
      await service.invalidateEntityCaches({
        entityType: "order",
        entityId: "1",
        operation: "update",
      });

      const orderRefreshCalls = queue.add.mock.calls.filter(
        (call: any) => call[0] === "refresh-materialized-view",
      );
      const orderDelay = orderRefreshCalls[0]?.[2]?.delay;

      queue.add.mockClear();

      // Invalidate fitter
      await service.invalidateEntityCaches({
        entityType: "fitter",
        entityId: "2",
        operation: "update",
      });

      const fitterRefreshCalls = queue.add.mock.calls.filter(
        (call: any) => call[0] === "refresh-materialized-view",
      );
      const fitterDelay = fitterRefreshCalls[0]?.[2]?.delay;

      expect(orderDelay).toBeLessThan(fitterDelay);
    });
  });
});
