import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseQueryLogController } from "../../../src/audit-logging/database-query-log.controller";
import { DatabaseQueryLogService } from "../../../src/audit-logging/database-query-log.service";
import { DatabaseQueryLogDto } from "../../../src/audit-logging/dto/database-query-log.dto";
import { QueryDatabaseQueryLogDto } from "../../../src/audit-logging/dto/query-database-query-log.dto";

describe("DatabaseQueryLogController", () => {
  let controller: DatabaseQueryLogController;
  let service: jest.Mocked<DatabaseQueryLogService>;

  const mockQueryLogDto: DatabaseQueryLogDto = {
    id: 1,
    query: "SELECT * FROM orders WHERE customer_id = 123",
    userId: 54321,
    timestamp: "2024-01-15T14:30:00.000Z",
    page: "/api/orders/search",
    backtrace:
      "at OrderService.findAll (/app/src/orders/order.service.ts:45:12)",
    createdAt: "2024-01-15T14:30:01.000Z",
  } as DatabaseQueryLogDto;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getQueryStatistics: jest.fn(),
      analyzeQueryPatterns: jest.fn(),
      getPotentiallySlowQueries: jest.fn(),
      getUserQueryLogs: jest.fn(),
      getPageQueryLogs: jest.fn(),
      bulkCreate: jest.fn(),
      logQuery: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatabaseQueryLogController],
      providers: [
        {
          provide: DatabaseQueryLogService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<DatabaseQueryLogController>(
      DatabaseQueryLogController,
    );
    service = module.get(DatabaseQueryLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should delegate to service", async () => {
      const createDto = {
        query: "SELECT * FROM orders",
        userId: 54321,
        timestamp: "2024-01-15T14:30:00.000Z",
        page: "/api/orders",
        backtrace: "at OrderService.findAll",
      };
      service.create.mockResolvedValue(mockQueryLogDto);

      const result = await controller.create(createDto as any);

      expect(result).toEqual(mockQueryLogDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("findAll", () => {
    it("should delegate to service", async () => {
      const queryDto = new QueryDatabaseQueryLogDto();
      const paginatedResult = {
        data: [mockQueryLogDto],
        meta: {
          total: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      service.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(queryDto);

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(queryDto);
    });
  });

  describe("getStatistics", () => {
    it("should pass date params and convert to Date objects", async () => {
      const mockStats = {
        totalQueries: 74939,
        uniquePages: 85,
        uniqueUsers: 125,
        topPages: [{ page: "/api/orders/search", count: 12500 }],
        topQueries: [
          { query: "SELECT * FROM orders WHERE customer_id = ?", count: 8500 },
        ],
        sqlOperations: [{ operation: "SELECT", count: 65000 }],
      };
      service.getQueryStatistics.mockResolvedValue(mockStats);

      const fromDate = "2024-01-01T00:00:00.000Z";
      const toDate = "2024-12-31T23:59:59.999Z";
      const result = await controller.getStatistics(fromDate, toDate);

      expect(result).toEqual(mockStats);
      expect(service.getQueryStatistics).toHaveBeenCalledWith(
        new Date(fromDate),
        new Date(toDate),
      );
    });

    it("should pass undefined when no dates provided", async () => {
      const mockStats = {
        totalQueries: 74939,
        uniquePages: 85,
        uniqueUsers: 125,
        topPages: [],
        topQueries: [],
        sqlOperations: [],
      };
      service.getQueryStatistics.mockResolvedValue(mockStats);

      await controller.getStatistics();

      expect(service.getQueryStatistics).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });
  });

  describe("analyzeQueryPatterns", () => {
    it("should pass date params and convert to Date objects", async () => {
      const mockAnalysis = {
        statistics: {},
        recommendations: ["Avoid SELECT * queries"],
        performanceInsights: [
          {
            category: "Query Optimization",
            finding: "Found 5 queries using SELECT *",
            impact: "medium" as const,
            recommendation: "Replace SELECT * with specific column names",
          },
        ],
      };
      service.analyzeQueryPatterns.mockResolvedValue(mockAnalysis);

      const fromDate = "2024-01-01T00:00:00.000Z";
      const toDate = "2024-12-31T23:59:59.999Z";
      const result = await controller.analyzeQueryPatterns(fromDate, toDate);

      expect(result).toEqual(mockAnalysis);
      expect(service.analyzeQueryPatterns).toHaveBeenCalledWith(
        new Date(fromDate),
        new Date(toDate),
      );
    });
  });

  describe("getPotentiallySlowQueries", () => {
    it("should pass page and limit to service", async () => {
      const paginatedResult = {
        data: [mockQueryLogDto],
        meta: {
          total: 10,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      service.getPotentiallySlowQueries.mockResolvedValue(paginatedResult);

      const result = await controller.getPotentiallySlowQueries(1, 50);

      expect(result).toEqual(paginatedResult);
      expect(service.getPotentiallySlowQueries).toHaveBeenCalledWith(1, 50);
    });
  });

  describe("getUserQueryLogs", () => {
    it("should pass userId, page, and limit to service", async () => {
      const paginatedResult = {
        data: [mockQueryLogDto],
        meta: {
          total: 1,
          page: 1,
          limit: 100,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      service.getUserQueryLogs.mockResolvedValue(paginatedResult);

      const result = await controller.getUserQueryLogs(54321, 1, 100);

      expect(result).toEqual(paginatedResult);
      expect(service.getUserQueryLogs).toHaveBeenCalledWith(54321, 1, 100);
    });
  });

  describe("getPageQueryLogs", () => {
    it("should pass page string, pageNum, and limit to service", async () => {
      const paginatedResult = {
        data: [mockQueryLogDto],
        meta: {
          total: 1,
          page: 1,
          limit: 100,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      service.getPageQueryLogs.mockResolvedValue(paginatedResult);

      const result = await controller.getPageQueryLogs("/api/orders", 1, 100);

      expect(result).toEqual(paginatedResult);
      expect(service.getPageQueryLogs).toHaveBeenCalledWith(
        "/api/orders",
        1,
        100,
      );
    });
  });

  describe("findOne", () => {
    it("should delegate to service", async () => {
      service.findOne.mockResolvedValue(mockQueryLogDto);

      const result = await controller.findOne(1);

      expect(result).toEqual(mockQueryLogDto);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe("bulkCreate", () => {
    it("should delegate to service", async () => {
      const createDtos = [
        {
          query: "SELECT * FROM orders",
          userId: 54321,
          timestamp: "2024-01-15T14:30:00.000Z",
          page: "/api/orders",
          backtrace: "at OrderService.findAll",
        },
      ];
      const bulkResult = { created: 1, skipped: 0 };
      service.bulkCreate.mockResolvedValue(bulkResult);

      const result = await controller.bulkCreate(createDtos as any);

      expect(result).toEqual(bulkResult);
      expect(service.bulkCreate).toHaveBeenCalledWith(createDtos);
    });
  });

  describe("logQuery", () => {
    it("should pass body params to service", async () => {
      service.logQuery.mockResolvedValue(mockQueryLogDto);

      const body = {
        query: "SELECT * FROM orders WHERE customer_id = 123",
        userId: 54321,
        page: "/api/orders/search",
        backtrace: "at OrderService.findAll",
      };
      const result = await controller.logQuery(body);

      expect(result).toEqual(mockQueryLogDto);
      expect(service.logQuery).toHaveBeenCalledWith(
        "SELECT * FROM orders WHERE customer_id = 123",
        54321,
        "/api/orders/search",
        "at OrderService.findAll",
      );
    });
  });
});
