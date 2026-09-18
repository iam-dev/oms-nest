import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { BadRequestException } from "@nestjs/common";
import { EnrichedOrdersService } from "../../../src/enriched-orders/enriched-orders.service";
import { ProductionCacheService } from "../../../src/cache/production-cache.service";

describe("EnrichedOrdersService - Create & Update methods", () => {
  let service: EnrichedOrdersService;
  let queryRunner: any;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
    };

    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      query: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const configs: Record<string, unknown> = {
          "cache.enrichedOrders.enabled": true,
          "database.enrichedOrders.fallbackQuery": true,
          "pagination.defaultLimit": 10,
          "pagination.maxLimit": 100,
        };
        return configs[key];
      }),
      getOrThrow: jest.fn(),
    };

    const mockProductionCacheService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnrichedOrdersService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ProductionCacheService,
          useValue: mockProductionCacheService,
        },
        {
          provide: "CACHE_MANAGER",
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EnrichedOrdersService>(EnrichedOrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createOrder", () => {
    it("should create an order and return success with orderId", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ active: true }]) // fitter assignable check
        .mockResolvedValueOnce([{ id: 1 }]) // status lookup (if orderStatus provided)
        .mockResolvedValueOnce([{ currency: 1, factoryId: 2 }]) // resolveCurrencyAndFactory
        .mockResolvedValueOnce([{ id: 999 }]) // INSERT RETURNING id
        .mockResolvedValueOnce(undefined); // audit log INSERT

      const dto = {
        fitterId: 5,
        specialNotes: "Test order",
        orderStatus: "Unordered",
      };

      const result = await service.createOrder(dto, 42);

      expect(result).toEqual({ success: true, orderId: 999 });
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it("should use default status 0 when no orderStatus provided", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 888 }]) // INSERT RETURNING id
        .mockResolvedValueOnce(undefined); // audit log INSERT

      const dto = { specialNotes: "No status" };

      const result = await service.createOrder(dto);

      expect(result).toEqual({ success: true, orderId: 888 });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it("should rollback transaction on error", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockRejectedValueOnce(new Error("Insert failed")); // INSERT fails

      const dto = { specialNotes: "Will fail" };

      await expect(service.createOrder(dto, 1)).rejects.toThrow(
        "Insert failed",
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it("should still commit even if audit log fails", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 777 }]) // INSERT RETURNING id
        .mockRejectedValueOnce(new Error("Log insert failed")); // audit log fails

      const dto = { specialNotes: "Log failure" };

      // The service logs a warning but doesn't throw on log failure
      const result = await service.createOrder(dto);

      expect(result).toEqual({ success: true, orderId: 777 });
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe("currency and factory stamping (legacy parity)", () => {
    // Legacy writes orders.currency = fitters.currency and orders.factory_id =
    // the saddle's factory column for that currency's region
    // (1 USD→factory_us, 2 EUR→factory_eu, 3 GBP→factory_gb, 4 CAN→factory_ca,
    //  5 AUD→factory_aud, 6 NL→factory_nl, 7 DE→factory_de). 3,728/3,728 legacy
    // orders follow this rule.
    it("should stamp the fitter's currency and the saddle's regional factory on create", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS
        .mockResolvedValueOnce([{ active: true }]) // fitter assignable
        .mockResolvedValueOnce([{ currency: 7, factoryId: 3 }]) // resolveCurrencyAndFactory
        .mockResolvedValueOnce([{ id: 501 }]) // INSERT
        .mockResolvedValueOnce(undefined); // audit log

      await service.createOrder({ fitterId: 299, saddleId: 97 }, 1);

      const resolve = queryRunner.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" && c[0].includes("WHEN 7 THEN s.factory_de"),
      );
      expect(resolve).toBeDefined();
      expect(resolve[1]).toEqual([299, 97]);
      const insert = queryRunner.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" && c[0].includes("INSERT INTO orders ("),
      );
      const params = insert[1] as unknown[];
      expect(params[3]).toBe(3); // factory_id
      expect(params[params.length - 4]).toBe(7); // currency (before order_data, repair_source_order_id, seat_sizes)
      expect(params[params.length - 5]).toBe(3); // oms_version = 3 like legacy's current writer
    });

    it("should skip the lookup and write 0/0 on create when no fitter is given", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS
        .mockResolvedValueOnce([{ id: 502 }]) // INSERT
        .mockResolvedValueOnce(undefined); // audit log

      await service.createOrder({ specialNotes: "walk-in" });

      expect(queryRunner.query).not.toHaveBeenCalledWith(
        expect.stringContaining("WHEN 7 THEN s.factory_de"),
        expect.anything(),
      );
    });

    it("should reject an unknown status name with 400 on create", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS
        .mockResolvedValueOnce([]); // status lookup: no row

      await expect(
        service.createOrder({ orderStatus: "DRAFT" }),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it("should re-derive currency/factory on update when the saddle changes", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS
        .mockResolvedValueOnce([
          {
            order_status: 1,
            fitter_id: 10,
            customer_id: 0,
            saddle_id: 40,
            currency: 1,
          },
        ]) // existing
        .mockResolvedValueOnce([{ currency: 1, factoryId: 4 }]) // resolve
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce(undefined); // log

      await service.updateOrder(100, { saddleId: 47 }, 1, 2);

      const update = queryRunner.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" && c[0].startsWith("UPDATE orders SET"),
      );
      expect(update[0]).toContain("currency = $");
      expect(update[0]).toContain("factory_id = $");
      expect(update[1]).toEqual(expect.arrayContaining([1, 4]));
    });

    it("should leave currency/factory alone on update when neither fitter nor saddle changes", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS
        .mockResolvedValueOnce([
          {
            order_status: 1,
            fitter_id: 10,
            customer_id: 0,
            saddle_id: 40,
            currency: 1,
          },
        ]) // existing
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce(undefined); // log

      await service.updateOrder(
        100,
        { fitterId: 10, saddleId: 40, specialNotes: "x" },
        1,
        2,
      );

      const update = queryRunner.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" && c[0].startsWith("UPDATE orders SET"),
      );
      expect(update[0]).not.toContain("currency = $");
    });

    it("should backfill currency/factory on update when the order was saved with currency 0 even if fitter and saddle are unchanged", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS
        .mockResolvedValueOnce([
          {
            order_status: 1,
            fitter_id: 10,
            customer_id: 0,
            saddle_id: 40,
            currency: 0,
          },
        ]) // existing, never stamped
        .mockResolvedValueOnce([{ currency: 2, factoryId: 5 }]) // resolve
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce(undefined); // log

      await service.updateOrder(
        100,
        { fitterId: 10, saddleId: 40, specialNotes: "x" },
        1,
        2,
      );

      const update = queryRunner.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" && c[0].startsWith("UPDATE orders SET"),
      );
      expect(update[0]).toContain("currency = $");
      expect(update[0]).toContain("factory_id = $");
      expect(update[1]).toEqual(expect.arrayContaining([2, 5]));
    });
  });

  describe("fitter assignment guard", () => {
    // "Inactive" on the Fitters page means credentials.blocked = 1 on the
    // fitter's login account; such fitters must not receive new orders.
    it("should reject createOrder for a blocked fitter and roll back", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ active: false }]); // fitter is blocked

      await expect(
        service.createOrder({ fitterId: 5, specialNotes: "x" }, 42),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.query).not.toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO orders"),
        expect.anything(),
      );
    });

    it("should reject createOrder for a fitter that does not exist or is deleted", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([]); // no fitter row

      await expect(service.createOrder({ fitterId: 5 }, 42)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should not look up a fitter in createOrder when none is given", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 1 }]) // INSERT RETURNING id
        .mockResolvedValueOnce(undefined); // audit log INSERT

      await service.createOrder({ specialNotes: "no fitter" });

      expect(queryRunner.query).not.toHaveBeenCalledWith(
        expect.stringContaining("FROM fitters"),
        expect.anything(),
      );
    });

    it("should reject updateOrder when reassigning to a blocked fitter", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 1, fitter_id: 10 }]) // existing order
        .mockResolvedValueOnce([{ active: false }]); // new fitter is blocked

      await expect(
        service.updateOrder(100, { fitterId: 5 }, 1, 2),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it("should skip the fitter check in updateOrder when the fitter is unchanged", async () => {
      // An order assigned before its fitter was blocked must stay editable.
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([
          { order_status: 1, fitter_id: 10, currency: 1 },
        ]) // existing order, already stamped
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce(undefined); // log INSERT

      const result = await service.updateOrder(
        100,
        { fitterId: 10, specialNotes: "same fitter" },
        1,
        2,
      );

      expect(result).toEqual({ success: true, orderId: 100 });
      expect(queryRunner.query).not.toHaveBeenCalledWith(
        expect.stringContaining("FROM fitters"),
        expect.anything(),
      );
    });

    it("should allow updateOrder to reassign to an active fitter", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 1, fitter_id: 10 }]) // existing order
        .mockResolvedValueOnce([{ active: true }]) // new fitter is active
        .mockResolvedValueOnce([{ currency: 1, factoryId: 1 }]) // resolveCurrencyAndFactory
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce(undefined); // log INSERT

      const result = await service.updateOrder(100, { fitterId: 5 }, 1, 2);

      expect(result).toEqual({ success: true, orderId: 100 });
    });
  });

  describe("customer assignment guard", () => {
    // Customers have no login and no status flag: "inactive" means
    // customers.deleted = 1. The search endpoints already hide such rows,
    // so the service check is what stops direct API calls and duplicates.
    it("should reject createOrder for a deleted customer and roll back", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([]); // no active customer row

      await expect(
        service.createOrder({ customerId: 7, specialNotes: "x" }, 42),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.query).not.toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO orders"),
        expect.anything(),
      );
    });

    it("should not look up a customer in createOrder when none is given", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 1 }]) // INSERT RETURNING id
        .mockResolvedValueOnce(undefined); // audit log INSERT

      await service.createOrder({ specialNotes: "walk-in" });

      expect(queryRunner.query).not.toHaveBeenCalledWith(
        expect.stringContaining("FROM customers"),
        expect.anything(),
      );
    });

    it("should reject updateOrder when switching to a deleted customer", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([
          { order_status: 1, fitter_id: 10, customer_id: 3 },
        ]) // existing order
        .mockResolvedValueOnce([]); // new customer is deleted

      await expect(
        service.updateOrder(100, { customerId: 7 }, 1, 2),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it("should skip the customer check in updateOrder when the customer is unchanged", async () => {
      // An order placed before its customer was deleted must stay editable.
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([
          { order_status: 1, fitter_id: 10, customer_id: 3 },
        ]) // existing order
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce(undefined); // log INSERT

      const result = await service.updateOrder(
        100,
        { customerId: 3, specialNotes: "same customer" },
        1,
        2,
      );

      expect(result).toEqual({ success: true, orderId: 100 });
      expect(queryRunner.query).not.toHaveBeenCalledWith(
        expect.stringContaining("FROM customers"),
        expect.anything(),
      );
    });

    it("should allow updateOrder to switch to an active customer", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([
          { order_status: 1, fitter_id: 10, customer_id: 3 },
        ]) // existing order
        .mockResolvedValueOnce([{ id: 7 }]) // new customer is active
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce(undefined); // log INSERT

      const result = await service.updateOrder(100, { customerId: 7 }, 1, 2);

      expect(result).toEqual({ success: true, orderId: 100 });
    });
  });

  describe("updateOrderStatus", () => {
    it("should update order status successfully", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 2 }]) // status lookup
        .mockResolvedValueOnce([{ order_status: 1, fitter_id: 10 }]) // existing order
        .mockResolvedValueOnce(undefined) // UPDATE query
        .mockResolvedValueOnce(undefined); // log INSERT

      const result = await service.updateOrderStatus(100, "Approved");

      expect(result).toEqual({
        success: true,
        orderId: 100,
        status: "Approved",
        statusId: 2,
      });
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it("should throw error when status name is unknown", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([]); // status lookup returns empty

      await expect(
        service.updateOrderStatus(100, "NonExistentStatus"),
      ).rejects.toThrow("Unknown status: NonExistentStatus");
    });

    it("should throw error when order not found", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 2 }]) // status lookup
        .mockResolvedValueOnce([]); // order lookup returns empty

      await expect(service.updateOrderStatus(999, "Approved")).rejects.toThrow(
        "Order 999 not found",
      );
    });

    it("should still succeed even if log insert fails", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 2 }]) // status lookup
        .mockResolvedValueOnce([{ order_status: 1, fitter_id: 10 }]) // existing order
        .mockResolvedValueOnce(undefined) // UPDATE query
        .mockRejectedValueOnce(new Error("Log insert failed")); // log INSERT fails

      const result = await service.updateOrderStatus(100, "Approved");

      expect(result).toEqual({
        success: true,
        orderId: 100,
        status: "Approved",
        statusId: 2,
      });
    });
  });

  describe("bulkUpdateOrderStatus", () => {
    it("should process multiple orders and return success/failure counts", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config (startTransaction)
        .mockResolvedValueOnce([{ id: 2 }]) // status lookup
        // Order 1
        .mockResolvedValueOnce([{ order_status: 1, fitter_id: 10 }]) // existing order 1
        .mockResolvedValueOnce(undefined) // UPDATE order 1
        .mockResolvedValueOnce(undefined) // log for order 1
        // Order 2
        .mockResolvedValueOnce([{ order_status: 1, fitter_id: 11 }]) // existing order 2
        .mockResolvedValueOnce(undefined) // UPDATE order 2
        .mockResolvedValueOnce(undefined); // log for order 2

      const result = await service.bulkUpdateOrderStatus([1, 2], "Approved");

      expect(result.success).toBe(true);
      expect(result.updated).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(2);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it("should handle mixed success/failure for individual orders", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 2 }]) // status lookup
        // Order 1 - success
        .mockResolvedValueOnce([{ order_status: 1, fitter_id: 10 }])
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce(undefined) // log
        // Order 2 - not found
        .mockResolvedValueOnce([]); // empty result = not found

      const result = await service.bulkUpdateOrderStatus([1, 2], "Approved");

      expect(result.updated).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain("not found");
    });

    it("should throw error when status name is unknown", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([]); // status lookup returns empty

      await expect(
        service.bulkUpdateOrderStatus([1, 2], "FakeStatus"),
      ).rejects.toThrow("Unknown status: FakeStatus");
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it("should rollback transaction on unexpected error", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockRejectedValueOnce(new Error("Connection lost")); // status lookup throws

      await expect(
        service.bulkUpdateOrderStatus([1], "Approved"),
      ).rejects.toThrow("Connection lost");
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe("saddle options clone_number", () => {
    // Legacy stores a second "CANTLE Option" as another orders_info row with
    // clone_number = 1; the editor sends that as cloneNumber and the service
    // must write it instead of the hard-coded 0 it used to insert.
    const insertCalls = () =>
      queryRunner.query.mock.calls.filter(
        (c: unknown[]) =>
          typeof c[0] === "string" && c[0].includes("INSERT INTO orders_info"),
      );

    it("should write cloneNumber as the 4th insert parameter in updateOrder", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 1, fitter_id: 10 }]) // existing order
        .mockResolvedValue([]); // UPDATE, DELETE, INSERTs, log

      await service.updateOrder(
        100,
        {
          saddleOptions: [
            { optionId: 4, optionItemId: 10, cloneNumber: 0 },
            { optionId: 4, optionItemId: 11, cloneNumber: 1, color: "black" },
          ],
        },
        1,
        2,
      );

      const inserts = insertCalls();
      expect(inserts).toHaveLength(2);
      expect(inserts[0][1]).toEqual([100, 4, 10, 0, "", "", ""]);
      expect(inserts[1][1]).toEqual([100, 4, 11, 1, "black", "", ""]);
    });

    it("should default cloneNumber to 0 in updateOrder when omitted", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 1, fitter_id: 10 }]) // existing order
        .mockResolvedValue([]);

      await service.updateOrder(
        100,
        { saddleOptions: [{ optionId: 7, optionItemId: 701 }] },
        1,
        2,
      );

      expect(insertCalls()[0][1]).toEqual([100, 7, 701, 0, "", "", ""]);
    });

    it("should write cloneNumber as the 4th insert parameter in createOrder", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 555 }]) // INSERT orders RETURNING id
        .mockResolvedValue([]); // orders_info INSERTs, log

      await service.createOrder({
        saddleOptions: [
          { optionId: 4, optionItemId: 10, cloneNumber: 0 },
          {
            optionId: 4,
            optionItemId: 0,
            cloneNumber: 1,
            custom: "A+B same as seat",
          },
        ],
      });

      const inserts = insertCalls();
      expect(inserts).toHaveLength(2);
      expect(inserts[0][1]).toEqual([555, 4, 10, 0, "", "", ""]);
      expect(inserts[1][1]).toEqual([555, 4, 0, 1, "", "", "A+B same as seat"]);
    });
  });
});
