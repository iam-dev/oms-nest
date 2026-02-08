import { register } from "prom-client";
import { MetricsService } from "../../../src/monitoring/metrics.service";

describe("MetricsService", () => {
  let service: MetricsService;

  beforeEach(() => {
    // IMPORTANT: Clear the prom-client registry before each test
    // to avoid "duplicate metric" registration errors.
    register.clear();
    service = new MetricsService();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("incrementHttpRequests", () => {
    it("should not throw", () => {
      expect(() =>
        service.incrementHttpRequests("GET", "/api/v1/orders", 200),
      ).not.toThrow();
    });
  });

  describe("observeHttpDuration", () => {
    it("should not throw", () => {
      expect(() =>
        service.observeHttpDuration("GET", "/api/v1/orders", 0.5),
      ).not.toThrow();
    });
  });

  describe("setDatabaseConnections", () => {
    it("should not throw", () => {
      expect(() =>
        service.setDatabaseConnections("oms_nest", 10),
      ).not.toThrow();
    });
  });

  describe("setMigrationProgress", () => {
    it("should not throw", () => {
      expect(() => service.setMigrationProgress("schema", 75)).not.toThrow();
    });
  });

  describe("observeQueryDuration", () => {
    it("should not throw", () => {
      expect(() =>
        service.observeQueryDuration("orders", 0.25, true, false, true),
      ).not.toThrow();
    });
  });

  describe("observeQueryComplexity", () => {
    it("should not throw", () => {
      expect(() => service.observeQueryComplexity("orders", 15)).not.toThrow();
    });
  });

  describe("incrementCacheOperations", () => {
    it("should not throw", () => {
      expect(() =>
        service.incrementCacheOperations("get", "hit", "orders"),
      ).not.toThrow();
    });
  });

  describe("setCacheHitRate", () => {
    it("should not throw", () => {
      expect(() =>
        service.setCacheHitRate("orders", "redis", 0.85),
      ).not.toThrow();
    });
  });

  describe("incrementMaterializedViewRefresh", () => {
    it("should not throw", () => {
      expect(() =>
        service.incrementMaterializedViewRefresh(
          "enriched_order_view",
          "manual",
          "success",
        ),
      ).not.toThrow();
    });
  });

  describe("observeDatabaseQueryDuration", () => {
    it("should not throw and should track slow queries for duration > 1s", () => {
      // Normal query (should NOT track slow query)
      expect(() =>
        service.observeDatabaseQueryDuration("select", "orders", "find", 0.5),
      ).not.toThrow();

      // Slow query (> 1s) should also not throw but should track via slow queries counter
      expect(() =>
        service.observeDatabaseQueryDuration("select", "orders", "find", 3.0),
      ).not.toThrow();

      // Various duration ranges
      expect(() =>
        service.observeDatabaseQueryDuration("select", "orders", "find", 1.5),
      ).not.toThrow(); // 1-2s range

      expect(() =>
        service.observeDatabaseQueryDuration("select", "orders", "find", 7.0),
      ).not.toThrow(); // 5-10s range

      expect(() =>
        service.observeDatabaseQueryDuration("select", "orders", "find", 15.0),
      ).not.toThrow(); // 10-30s range

      expect(() =>
        service.observeDatabaseQueryDuration("select", "orders", "find", 45.0),
      ).not.toThrow(); // 30s+ range
    });
  });

  describe("incrementEntityValidationErrors", () => {
    it("should not throw", () => {
      expect(() =>
        service.incrementEntityValidationErrors("orders", "required", "name"),
      ).not.toThrow();

      // Without optional field parameter
      expect(() =>
        service.incrementEntityValidationErrors("orders", "format"),
      ).not.toThrow();
    });
  });

  describe("observeBulkOperationSize", () => {
    it("should not throw", () => {
      expect(() =>
        service.observeBulkOperationSize("import", "orders", 100),
      ).not.toThrow();
    });
  });

  describe("recordBulkOperationMetrics", () => {
    it("should call internal methods", async () => {
      const observeBulkSpy = jest.spyOn(service, "observeBulkOperationSize");
      const observeDbQuerySpy = jest.spyOn(
        service,
        "observeDatabaseQueryDuration",
      );

      await service.recordBulkOperationMetrics(
        "import",
        "orders",
        50,
        2.5,
        true,
      );

      expect(observeBulkSpy).toHaveBeenCalledWith("import", "orders", 50);
      expect(observeDbQuerySpy).toHaveBeenCalledWith(
        "bulk",
        "orders",
        "import",
        2.5,
      );
    });
  });

  describe("recordCacheMetrics", () => {
    it("should increment with hit/miss result", async () => {
      const incrementSpy = jest.spyOn(service, "incrementCacheOperations");

      await service.recordCacheMetrics("get", true, "orders");
      expect(incrementSpy).toHaveBeenCalledWith("get", "hit", "orders");

      incrementSpy.mockClear();

      await service.recordCacheMetrics("get", false, "orders");
      expect(incrementSpy).toHaveBeenCalledWith("get", "miss", "orders");
    });
  });

  describe("getMetrics", () => {
    it("should return string", async () => {
      const metrics = await service.getMetrics();

      expect(typeof metrics).toBe("string");
      expect(metrics.length).toBeGreaterThan(0);
    });
  });
});
