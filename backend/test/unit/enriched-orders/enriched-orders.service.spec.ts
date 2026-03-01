import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
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
});
