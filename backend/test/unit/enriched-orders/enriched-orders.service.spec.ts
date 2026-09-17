import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { EnrichedOrdersService } from "../../../src/enriched-orders/enriched-orders.service";
import { ProductionCacheService } from "../../../src/cache/production-cache.service";

describe("EnrichedOrdersService", () => {
  let service: EnrichedOrdersService;
  let queryRunner: any;
  let configService: jest.Mocked<ConfigService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _productionCacheService: jest.Mocked<ProductionCacheService> | undefined;

  const mockEnrichedOrderData = [
    {
      order_id: "550e8400-e29b-41d4-a716-446655440000",
      order_number: "ORD-2023-001234",
      customer_name: "John Doe",
      customer_email: "john@example.com",
      total_amount: 2500.0,
      status: "PENDING",
      created_at: new Date("2023-12-01T00:00:00Z"),
      factory_name: "Premium Factory",
      fitter_name: "Expert Fitter",
    },
  ];

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
      get: jest.fn(),
      getOrThrow: jest.fn(),
    };

    const mockProductionCacheService = {
      // Note: ProductionCacheService methods not mocked - service doesn't use them as expected
    };

    // Setup default configurations
    mockConfigService.get.mockImplementation((key: string) => {
      const configs = {
        "cache.enrichedOrders.enabled": true,
        "database.enrichedOrders.fallbackQuery": true,
        "pagination.defaultLimit": 10,
        "pagination.maxLimit": 100,
      };
      return configs[key];
    });

    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      const result = mockConfigService.get(key);
      if (result === undefined) {
        throw new Error(`Configuration key not found: ${key}`);
      }
      return result;
    });

    // Note: ProductionCacheService methods not mocked - service doesn't use them as expected

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
    configService = module.get(ConfigService);
    _productionCacheService = module.get(ProductionCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getEnrichedOrders", () => {
    it("should return enriched orders with pagination", async () => {
      // Arrange
      const queryDto = {
        page: 1,
        limit: 10,
      };

      // Mock the queryRunner.query calls (service uses queryRunner, not dataSource.query)
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config call
        .mockResolvedValueOnce([{ total: "150" }]) // Count query
        .mockResolvedValueOnce(mockEnrichedOrderData); // Data query

      // Act
      const result = await service.getEnrichedOrders(queryDto);

      // Assert
      expect(result).toEqual({
        data: mockEnrichedOrderData,
        pagination: {
          totalItems: 150,
          totalPages: 15,
          currentPage: 1,
          itemsPerPage: 10,
          hasNext: true,
          hasPrevious: false,
        },
        metadata: {
          queriedAt: expect.any(String),
          cached: false,
          processingTimeMs: expect.any(Number),
        },
      });

      expect(queryRunner.query).toHaveBeenCalledTimes(3);
      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it("should exclude soft-deleted orders from both the count and data queries", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config call
        .mockResolvedValueOnce([{ total: "0" }]) // Count query
        .mockResolvedValueOnce([]); // Data query

      await service.getEnrichedOrders({ page: 1, limit: 10 });

      const countSql: string = queryRunner.query.mock.calls[1][0];
      const dataSql: string = queryRunner.query.mock.calls[2][0];
      expect(countSql).toMatch(/WHERE[\s\S]*o\.deleted_at IS NULL/);
      expect(dataSql).toMatch(/WHERE[\s\S]*o\.deleted_at IS NULL/);
    });

    it("should keep the soft-delete filter when other filters are applied", async () => {
      queryRunner.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: "0" }])
        .mockResolvedValueOnce([]);

      await service.getEnrichedOrders({
        page: 1,
        limit: 10,
        urgent: true,
      } as any);

      const dataSql: string = queryRunner.query.mock.calls[2][0];
      expect(dataSql).toMatch(/o\.deleted_at IS NULL/);
      expect(dataSql).toMatch(/o\.rushed = \$1/);
    });
  });

  describe("Configuration", () => {
    it("should use default pagination settings", async () => {
      // Trigger a call that uses configuration
      const queryDto = { page: 1, limit: 5 };

      // Mock queryRunner.query responses (service uses queryRunner, not dataSource.query)
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config call
        .mockResolvedValueOnce([{ total: "10" }]) // Count query
        .mockResolvedValueOnce([]); // Data query

      await service.getEnrichedOrders(queryDto);

      // Verify config access
      expect(configService.get).toHaveBeenCalledWith("cache", { infer: true });
    });
  });

  describe("updateOrder - Fitter status-based restrictions", () => {
    const FITTER_ROLE_ID = 1;
    const ADMIN_ROLE_ID = 2;
    const SUPERVISOR_ROLE_ID = 5;

    it("should throw ForbiddenException when fitter edits order with restricted status", async () => {
      // Arrange: order has status_id 2 (Approved) — restricted for fitters
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 2, fitter_id: 10 }]) // existing order
        .mockResolvedValueOnce([{ name: "Approved" }]); // status name lookup

      // Act & Assert
      await expect(
        service.updateOrder(100, { specialNotes: "test" }, 10, FITTER_ROLE_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should include status name in ForbiddenException message", async () => {
      // Arrange: separate test for message check — needs fresh mocks
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 2, fitter_id: 10 }]) // existing order
        .mockResolvedValueOnce([{ name: "Approved" }]); // status name lookup

      await expect(
        service.updateOrder(100, { specialNotes: "test" }, 10, FITTER_ROLE_ID),
      ).rejects.toThrow("Fitters cannot edit orders with status: Approved");
    });

    it("should throw ForbiddenException for all restricted status IDs", async () => {
      const restrictedIds = [2, 3, 5, 7, 9, 10, 11];

      for (const statusId of restrictedIds) {
        queryRunner.query
          .mockResolvedValueOnce([]) // RLS set_config
          .mockResolvedValueOnce([{ order_status: statusId, fitter_id: 10 }])
          .mockResolvedValueOnce([{ name: `Status ${statusId}` }]);

        await expect(
          service.updateOrder(
            100,
            { specialNotes: "test" },
            10,
            FITTER_ROLE_ID,
          ),
        ).rejects.toThrow(ForbiddenException);
      }
    });

    it("should allow fitter to edit order with non-restricted status", async () => {
      // Arrange: order has status_id 1 (Unordered) — not restricted
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 1, fitter_id: 10 }]) // existing order (non-restricted)
        .mockResolvedValueOnce(undefined) // UPDATE query
        .mockResolvedValueOnce(undefined); // log INSERT

      // Act
      const result = await service.updateOrder(
        100,
        { specialNotes: "Updated note" },
        10,
        FITTER_ROLE_ID,
      );

      // Assert
      expect(result).toEqual({ success: true, orderId: 100 });
    });

    it("should allow admin to edit order with restricted status", async () => {
      // Arrange: order has status_id 2 (Approved) — restricted for fitters, not for admin
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 2, fitter_id: 10 }]) // existing order
        .mockResolvedValueOnce(undefined) // UPDATE query
        .mockResolvedValueOnce(undefined); // log INSERT

      // Act
      const result = await service.updateOrder(
        100,
        { specialNotes: "Admin edit" },
        1,
        ADMIN_ROLE_ID,
      );

      // Assert
      expect(result).toEqual({ success: true, orderId: 100 });
    });

    it("should allow supervisor to edit order with restricted status", async () => {
      // Arrange: order has status_id 7 (Completed sale) — restricted for fitters
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 7, fitter_id: 10 }]) // existing order
        .mockResolvedValueOnce(undefined) // UPDATE query
        .mockResolvedValueOnce(undefined); // log INSERT

      // Act
      const result = await service.updateOrder(
        100,
        { specialNotes: "Supervisor edit" },
        1,
        SUPERVISOR_ROLE_ID,
      );

      // Assert
      expect(result).toEqual({ success: true, orderId: 100 });
    });

    it("should allow edit when userRoleId is undefined (backwards compatibility)", async () => {
      // Arrange: no role passed — should not restrict
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 2, fitter_id: 10 }]) // existing order
        .mockResolvedValueOnce(undefined) // UPDATE query
        .mockResolvedValueOnce(undefined); // log INSERT

      // Act
      const result = await service.updateOrder(100, {
        specialNotes: "No role check",
      });

      // Assert
      expect(result).toEqual({ success: true, orderId: 100 });
    });
  });

  describe("getFitterIdByUserId", () => {
    it("should return fitter ID when fitter record exists", async () => {
      const mockDataSource = (service as any).dataSource;
      mockDataSource.query.mockResolvedValue([{ id: 99 }]);

      const result = await service.getFitterIdByUserId(42);

      expect(result).toBe(99);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        "SELECT id FROM fitters WHERE user_id = $1 LIMIT 1",
        [42],
      );
    });

    it("should return null when no fitter record exists", async () => {
      const mockDataSource = (service as any).dataSource;
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getFitterIdByUserId(999);

      expect(result).toBeNull();
    });

    it("should return null when query returns undefined id", async () => {
      const mockDataSource = (service as any).dataSource;
      mockDataSource.query.mockResolvedValue([{ id: undefined }]);

      const result = await service.getFitterIdByUserId(42);

      expect(result).toBeNull();
    });
  });

  describe("updateOrder - concurrent status overwrite (P2 / issue 9)", () => {
    // Regression: the Edit Order form loads order_status into local state when it
    // opens and resubmits that snapshot on every save.  If another user changed the
    // status in the meantime, the stale save silently reverted it -- producing the
    // pair of audit-log lines seen on order 46550 ("Changed the order status to
    // 'In Production P2'" immediately followed by "Order updated. Status changed to
    // 'Inventory Aiken'.").  updateOrder must never write order_status without a
    // matching expectedStatus precondition.

    const setClauseFor = (): string => {
      const call = queryRunner.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" && c[0].startsWith("UPDATE orders SET"),
      );
      return call ? (call[0] as string) : "";
    };

    it("should leave order_status untouched when the caller omits orderStatus", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 4, fitter_id: 10 }]) // existing order
        .mockResolvedValueOnce([{ id: 46550 }]) // UPDATE orders ... RETURNING id
        .mockResolvedValueOnce(undefined); // audit log INSERT

      const result = await service.updateOrder(46550, {
        customerCity: "Aiken",
      });

      expect(result).toEqual({ success: true, orderId: 46550 });
      expect(setClauseFor()).not.toContain("order_status");
    });

    it("should throw ConflictException when the submitted status is stale", async () => {
      // Order is now 'In Production P2' (id 6); the stale form still believes
      // it is 'Inventory Aiken' (id 4) and tries to write that back.
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 6, fitter_id: 10 }]) // current status = 6
        .mockResolvedValueOnce([{ id: 4 }]) // resolve dto.orderStatus -> 4
        .mockResolvedValueOnce([{ id: 4 }]); // resolve dto.expectedStatus -> 4

      await expect(
        service.updateOrder(46550, {
          orderStatus: "Inventory Aiken",
          expectedStatus: "Inventory Aiken",
          customerCity: "Aiken",
        }),
      ).rejects.toThrow(ConflictException);

      expect(setClauseFor()).toBe("");
    });

    it("should reject a status change when expectedStatus is absent", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 6, fitter_id: 10 }]) // current status = 6
        .mockResolvedValueOnce([{ id: 4 }]); // resolve dto.orderStatus -> 4

      await expect(
        service.updateOrder(46550, { orderStatus: "Inventory Aiken" }),
      ).rejects.toThrow(ConflictException);

      expect(setClauseFor()).toBe("");
    });

    it("should apply the status change when expectedStatus matches current status", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 4, fitter_id: 10 }]) // current status = 4
        .mockResolvedValueOnce([{ id: 6 }]) // resolve dto.orderStatus -> 6
        .mockResolvedValueOnce([{ id: 4 }]) // resolve dto.expectedStatus -> 4
        .mockResolvedValueOnce([{ id: 46550 }]) // UPDATE orders ... RETURNING id
        .mockResolvedValueOnce(undefined); // audit log INSERT

      const result = await service.updateOrder(46550, {
        orderStatus: "In Production P2",
        expectedStatus: "Inventory Aiken",
      });

      expect(result).toEqual({ success: true, orderId: 46550 });
      expect(setClauseFor()).toContain("order_status");
    });

    it("should throw ConflictException when the compare-and-swap UPDATE matches no row", async () => {
      // Status changed between the SELECT and the UPDATE inside the transaction.
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 4, fitter_id: 10 }]) // current status = 4
        .mockResolvedValueOnce([{ id: 6 }]) // resolve dto.orderStatus -> 6
        .mockResolvedValueOnce([{ id: 4 }]) // resolve dto.expectedStatus -> 4
        .mockResolvedValueOnce([]); // UPDATE matched no row

      await expect(
        service.updateOrder(46550, {
          orderStatus: "In Production P2",
          expectedStatus: "Inventory Aiken",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should not log a status change when the submitted status equals the current one", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ order_status: 4, fitter_id: 10 }]) // current status = 4
        .mockResolvedValueOnce([{ id: 4 }]) // resolve dto.orderStatus -> 4
        .mockResolvedValueOnce([{ id: 46550 }]) // UPDATE orders ... RETURNING id
        .mockResolvedValueOnce(undefined); // audit log INSERT

      await service.updateOrder(46550, {
        orderStatus: "Inventory Aiken",
        customerCity: "Aiken",
      });

      const logCall = queryRunner.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" && c[0].includes("INSERT INTO log"),
      );
      expect(logCall).toBeDefined();
      expect(logCall[1][2]).toBe("Order updated.");
    });
  });
  describe("getOrderDetail - customer fields round-trip with updateOrder", () => {
    // Regression: the Edit Order form's "Customer information" inputs are saved by
    // updateOrder into the orders row (orders.name/address/city/...), but the detail
    // read that feeds the form and the details view returned those fields straight
    // from the customers table.  Every customer-info edit therefore looked lost on
    // the very next open, even though the UPDATE had succeeded.
    //
    // The detail read must prefer the order's own snapshot and fall back to the
    // customer record only when the snapshot is empty (legacy rows).
    //
    // "Empty" includes the literal string 'NULL': the legacy PHP wrote the word
    // into these NOT NULL columns on ~78% of orders (156k values in the 2026-06
    // dump), and its own UI ignores it and shows the customers record.

    const detailSelectSql = (): string => {
      const call = queryRunner.query.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" &&
          c[0].includes('o.fitter_reference as "fitterReference"'),
      );
      return call ? (call[0] as string) : "";
    };

    const snapshotColumns: Array<[string, string]> = [
      ["name", "customerName"],
      ["email", "customerEmail"],
      ["address", "customerAddress"],
      ["city", "customerCity"],
      ["state", "customerState"],
      ["zipcode", "customerZipcode"],
      ["country", "customerCountry"],
      ["phone_no", "customerPhone"],
      ["cell_no", "customerCell"],
    ];

    it.each(snapshotColumns)(
      "should read orders.%s before customers.%s for %s",
      async (column, alias) => {
        queryRunner.query
          .mockResolvedValueOnce([]) // RLS set_config
          .mockResolvedValueOnce([{ id: 1, currency: 1, fitterCurrency: 1 }]) // detail row
          .mockResolvedValue([]); // saddle specs, log, comments

        await service.getOrderDetail(1);

        const sql = detailSelectSql();
        expect(sql).not.toBe("");
        // Whitespace-insensitive match on the exact expression.
        const normalised = sql.replace(/\s+/g, " ");
        expect(normalised).toContain(
          `COALESCE(NULLIF(NULLIF(o.${column}, ''), 'NULL'), c.${column}) as "${alias}"`,
        );
        expect(normalised).not.toContain(`c.${column} as "${alias}"`);
      },
    );

    it("should not surface the legacy literal 'NULL' as the horse name", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 1, currency: 1, fitterCurrency: 1 }]) // detail row
        .mockResolvedValue([]); // saddle specs, log, comments

      await service.getOrderDetail(1);

      const normalised = detailSelectSql().replace(/\s+/g, " ");
      expect(normalised).toContain(
        `NULLIF(o.horse_name, 'NULL') as "horseName"`,
      );
    });
  });

  describe("option clones (orders_info.clone_number)", () => {
    // Legacy shows an option's extra rows as "CANTLE Option (2)", "(3)", …;
    // the read queries must expose clone_number and label the rows the same way.
    const sqlContaining = (needle: string): string => {
      const call = queryRunner.query.mock.calls.find(
        (c: unknown[]) => typeof c[0] === "string" && c[0].includes(needle),
      );
      return call ? (call[0] as string).replace(/\s+/g, " ") : "";
    };

    const CLONE_LABEL_SQL = `o.name || CASE WHEN oi.clone_number > 0 THEN ' (' || (oi.clone_number + 1) || ')' ELSE '' END as "optionName"`;

    it("should return cloneNumber and a suffixed optionName from getOrderDetail, ordered by clone_number", async () => {
      queryRunner.query
        .mockResolvedValueOnce([]) // RLS set_config
        .mockResolvedValueOnce([{ id: 1, currency: 1, fitterCurrency: 1 }]) // detail row
        .mockResolvedValue([]); // specs, log, comments

      await service.getOrderDetail(1);

      const sql = sqlContaining("FROM orders_info oi");
      expect(sql).not.toBe("");
      expect(sql).toContain(`oi.clone_number as "cloneNumber"`);
      expect(sql).toContain(CLONE_LABEL_SQL);
      expect(sql).toContain(
        "ORDER BY o.sequence NULLS LAST, oi.option_id, oi.clone_number",
      );
    });

    it("should return cloneNumber and a suffixed optionName from getBatchSaddleSpecs, ordered by clone_number", async () => {
      queryRunner.query.mockResolvedValue([
        {
          orderId: 1,
          optionId: 4,
          optionName: "CANTLE Option",
          cloneNumber: 0,
          displayValue: "A",
        },
        {
          orderId: 1,
          optionId: 4,
          optionName: "CANTLE Option (2)",
          cloneNumber: 1,
          displayValue: "B",
        },
      ]);

      const result = await service.getBatchSaddleSpecs([1]);

      const sql = sqlContaining("WHERE oi.order_id = ANY($1::int[])");
      expect(sql).toContain(`oi.clone_number as "cloneNumber"`);
      expect(sql).toContain(CLONE_LABEL_SQL);
      expect(sql).toContain(
        "ORDER BY oi.order_id, o.sequence, oi.option_id, oi.clone_number",
      );
      expect(result[1]).toEqual([
        {
          optionId: 4,
          optionName: "CANTLE Option",
          cloneNumber: 0,
          displayValue: "A",
        },
        {
          optionId: 4,
          optionName: "CANTLE Option (2)",
          cloneNumber: 1,
          displayValue: "B",
        },
      ]);
    });

    it.each([
      ["with a saddle filter", 10],
      ["without a saddle filter", undefined],
    ])(
      "should select options.extra_allowed in getEditFormOptions %s",
      async (_label, saddleId) => {
        queryRunner.query.mockResolvedValue([]);

        await service.getEditFormOptions(saddleId);

        const sql = sqlContaining('o.name as "optionName"');
        expect(sql).not.toBe("");
        expect(sql).toContain(`o.extra_allowed as "extraAllowed"`);
      },
    );
  });

  describe("getEditFormOptions - per-model dropdown lists", () => {
    // Models > Manage Options stores what a model may use in saddle_options_items:
    //   option enabled   -> (option_id, option_item_id = 0, leather_id = 0)
    //   item ticked      -> (option_id, option_item_id = item, leather_id = 0)
    //   leather ticked   -> (option_id, option_item_id = 0, leather_id = leather)
    // and the model's base leathers in saddle_leathers. The wizard must only
    // offer what is ticked; an enabled option with no ticks offers nothing.
    const sqlContaining = (needle: string): string => {
      const call = queryRunner.query.mock.calls.find(
        (c: unknown[]) => typeof c[0] === "string" && c[0].includes(needle),
      );
      return call ? (call[0] as string).replace(/\s+/g, " ") : "";
    };

    it("should only return option items ticked for the saddle", async () => {
      queryRunner.query.mockResolvedValue([]);

      await service.getEditFormOptions(100);

      const sql = sqlContaining('oi.option_id as "optionId"');
      expect(sql).toContain("saddle_options_items soi");
      expect(sql).toContain("soi.option_item_id = oi.id");
      expect(sql).toContain("soi.saddle_id = $1");
      expect(sql).toContain("soi.deleted = 0");
      expect(sql).toContain("oi.deleted = 0");
      expect(sql).toContain("ORDER BY oi.option_id, oi.sequence, oi.name");
    });

    it("should return the leathers ticked per leather option as optionLeathers", async () => {
      queryRunner.query.mockImplementation((sql: string) =>
        Promise.resolve(
          sql.includes("soi.leather_id = lt.id")
            ? [{ optionId: 11, leatherId: 48, name: "ASBLV" }]
            : [],
        ),
      );

      const result = await service.getEditFormOptions(100);

      const sql = sqlContaining("soi.leather_id = lt.id");
      expect(sql).toContain("saddle_options_items soi");
      expect(sql).toContain("soi.saddle_id = $1");
      expect(sql).toContain("soi.deleted = 0");
      expect(sql).toContain("lt.deleted = 0");
      expect(result.optionLeathers).toEqual([
        { optionId: 11, leatherId: 48, name: "ASBLV" },
      ]);
    });

    it("should only return the saddle's own base leather types", async () => {
      queryRunner.query.mockResolvedValue([]);

      await service.getEditFormOptions(100);

      const sql = sqlContaining("FROM leather_types lt");
      expect(sql).toContain("saddle_leathers sl");
      expect(sql).toContain("sl.leather_id = lt.id");
      expect(sql).toContain("sl.saddle_id = $1");
      expect(sql).toContain("sl.deleted = 0");
      expect(sql).toContain("ORDER BY sl.sequence, lt.name");
    });

    it("should return every item, leather type and no optionLeathers when no saddle is chosen", async () => {
      queryRunner.query.mockResolvedValue([]);

      const result = await service.getEditFormOptions(undefined);

      const items = sqlContaining('oi.option_id as "optionId"');
      expect(items).not.toContain("saddle_options_items");
      expect(items).toContain("oi.deleted = 0");
      const leathers = sqlContaining("FROM leather_types");
      expect(leathers).not.toContain("saddle_leathers");
      expect(result.optionLeathers).toEqual([]);
    });
  });
});
