import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DatabaseQueryLogService } from "../../../src/audit-logging/database-query-log.service";
import { DatabaseQueryLogRepository } from "../../../src/audit-logging/infrastructure/persistence/relational/repositories/database-query-log.repository";
import { DatabaseQueryLogEntity } from "../../../src/audit-logging/infrastructure/persistence/relational/entities/database-query-log.entity";
import { CreateDatabaseQueryLogDto } from "../../../src/audit-logging/dto/create-database-query-log.dto";
import { QueryDatabaseQueryLogDto } from "../../../src/audit-logging/dto/query-database-query-log.dto";

describe("DatabaseQueryLogService", () => {
  let service: DatabaseQueryLogService;
  let repository: jest.Mocked<DatabaseQueryLogRepository>;

  const mockQueryLogEntity: DatabaseQueryLogEntity = {
    id: 1,
    query: "SELECT * FROM orders WHERE customer_id = 123",
    userId: 54321,
    timestamp: new Date("2024-01-15T14:30:00.000Z"),
    page: "/api/orders/search",
    backtrace:
      "at OrderService.findAll (/app/src/orders/order.service.ts:45:12)",
    createdAt: new Date("2024-01-15T14:30:01.000Z"),
    user: Promise.resolve(null) as any,
  } as DatabaseQueryLogEntity;

  const mockCreateDto: CreateDatabaseQueryLogDto = {
    query: "SELECT * FROM orders WHERE customer_id = 123",
    userId: 54321,
    timestamp: "2024-01-15T14:30:00.000Z",
    page: "/api/orders/search",
    backtrace:
      "at OrderService.findAll (/app/src/orders/order.service.ts:45:12)",
  };

  beforeEach(async () => {
    const mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findManyWithQuery: jest.fn(),
      findByUserId: jest.fn(),
      findByPage: jest.fn(),
      findPotentiallySlowQueries: jest.fn(),
      getQueryStatistics: jest.fn(),
      bulkInsert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseQueryLogService,
        {
          provide: DatabaseQueryLogRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DatabaseQueryLogService>(DatabaseQueryLogService);
    repository = module.get(DatabaseQueryLogRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new database query log entry successfully", async () => {
      repository.save.mockResolvedValue(mockQueryLogEntity);

      const result = await service.create(mockCreateDto);

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("userId", 54321);
      expect(result).toHaveProperty("page", "/api/orders/search");
    });

    it("should throw BadRequestException on repository error", async () => {
      repository.save.mockRejectedValue(new Error("Database error"));

      await expect(service.create(mockCreateDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockCreateDto)).rejects.toThrow(
        "Failed to create database query log entry",
      );
    });
  });

  describe("findOne", () => {
    it("should find a query log entry by id", async () => {
      repository.findById.mockResolvedValue(mockQueryLogEntity);

      const result = await service.findOne(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("query");
    });

    it("should throw NotFoundException when query log not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(
        "Database query log entry not found",
      );
    });
  });

  describe("findAll", () => {
    it("should return enhanced DTOs", async () => {
      const queryDto = new QueryDatabaseQueryLogDto();
      const paginatedResult = {
        data: [mockQueryLogEntity],
        meta: {
          total: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      repository.findManyWithQuery.mockResolvedValue(paginatedResult);

      const result = await service.findAll(queryDto);

      expect(repository.findManyWithQuery).toHaveBeenCalledWith(queryDto);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty("id", 1);
      expect(result.data[0]).toHaveProperty("executionTimeMs");
      expect(result.meta).toEqual(paginatedResult.meta);
    });

    it("should throw BadRequestException on error", async () => {
      const queryDto = new QueryDatabaseQueryLogDto();
      repository.findManyWithQuery.mockRejectedValue(
        new Error("Search failed"),
      );

      await expect(service.findAll(queryDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("getUserQueryLogs", () => {
    it("should return paginated user query logs with offset calculation", async () => {
      const repoResult = {
        items: [mockQueryLogEntity],
        total: 250,
      };
      repository.findByUserId.mockResolvedValue(repoResult);

      const result = await service.getUserQueryLogs(54321, 2, 100);

      // offset = (page - 1) * limit = (2 - 1) * 100 = 100
      expect(repository.findByUserId).toHaveBeenCalledWith(54321, 100, 100);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(250);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(100);
      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasNextPage).toBe(true);
    });
  });

  describe("getPageQueryLogs", () => {
    it("should return paginated page query logs", async () => {
      const repoResult = {
        items: [mockQueryLogEntity],
        total: 50,
      };
      repository.findByPage.mockResolvedValue(repoResult);

      const result = await service.getPageQueryLogs("/api/orders", 1, 100);

      expect(repository.findByPage).toHaveBeenCalledWith("/api/orders", 100, 0);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(50);
      expect(result.meta.page).toBe(1);
    });
  });

  describe("getPotentiallySlowQueries", () => {
    it("should return paginated slow queries", async () => {
      const repoResult = {
        items: [mockQueryLogEntity],
        total: 10,
      };
      repository.findPotentiallySlowQueries.mockResolvedValue(repoResult);

      const result = await service.getPotentiallySlowQueries(1, 50);

      // offset = (1 - 1) * 50 = 0
      expect(repository.findPotentiallySlowQueries).toHaveBeenCalledWith(50, 0);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(10);
      expect(result.meta.page).toBe(1);
    });
  });

  describe("getQueryStatistics", () => {
    it("should delegate to repository with dates", async () => {
      const fromDate = new Date("2024-01-01");
      const toDate = new Date("2024-12-31");
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
      repository.getQueryStatistics.mockResolvedValue(mockStats);

      const result = await service.getQueryStatistics(fromDate, toDate);

      expect(repository.getQueryStatistics).toHaveBeenCalledWith(
        fromDate,
        toDate,
      );
      expect(result).toEqual(mockStats);
    });

    it("should handle call without dates", async () => {
      const mockStats = {
        totalQueries: 74939,
        uniquePages: 85,
        uniqueUsers: 125,
        topPages: [],
        topQueries: [],
        sqlOperations: [],
      };
      repository.getQueryStatistics.mockResolvedValue(mockStats);

      const result = await service.getQueryStatistics();

      expect(repository.getQueryStatistics).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
      expect(result.totalQueries).toBe(74939);
    });
  });

  describe("analyzeQueryPatterns", () => {
    it("should detect SELECT * queries and recommend avoiding them", async () => {
      const mockStats = {
        totalQueries: 100,
        uniquePages: 10,
        uniqueUsers: 5,
        topPages: [{ page: "/api/orders", count: 5 }],
        topQueries: [{ query: "SELECT * FROM orders WHERE id = 1", count: 50 }],
        sqlOperations: [{ operation: "SELECT", count: 100 }],
      };
      repository.getQueryStatistics.mockResolvedValue(mockStats);

      const result = await service.analyzeQueryPatterns();

      expect(result.recommendations).toContain(
        "Avoid SELECT * queries - specify only needed columns",
      );
      expect(result.performanceInsights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: "Query Optimization",
            impact: "medium",
          }),
        ]),
      );
    });

    it("should detect heavy JOIN queries and recommend indexes", async () => {
      const mockStats = {
        totalQueries: 100,
        uniquePages: 10,
        uniqueUsers: 5,
        topPages: [{ page: "/api/orders", count: 5 }],
        topQueries: [
          {
            query:
              "SELECT o.id FROM orders o JOIN customers c ON o.cid = c.id JOIN fitters f ON o.fid = f.id JOIN saddles s ON o.sid = s.id",
            count: 30,
          },
        ],
        sqlOperations: [{ operation: "SELECT", count: 100 }],
      };
      repository.getQueryStatistics.mockResolvedValue(mockStats);

      const result = await service.analyzeQueryPatterns();

      expect(result.recommendations).toContain(
        "Consider adding indexes for heavy JOIN operations",
      );
      expect(result.performanceInsights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: "Indexing",
            impact: "high",
          }),
        ]),
      );
    });

    it("should detect high-volume pages and recommend caching", async () => {
      const mockStats = {
        totalQueries: 100,
        uniquePages: 10,
        uniqueUsers: 5,
        topPages: [{ page: "/api/orders/search", count: 15 }], // 15 > 100 * 0.1 = 10
        topQueries: [{ query: "SELECT id FROM orders", count: 50 }],
        sqlOperations: [{ operation: "SELECT", count: 100 }],
      };
      repository.getQueryStatistics.mockResolvedValue(mockStats);

      const result = await service.analyzeQueryPatterns();

      expect(result.recommendations).toContain(
        "Consider caching for high-volume endpoints",
      );
      expect(result.performanceInsights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: "Caching",
            impact: "high",
          }),
        ]),
      );
    });

    it("should return no recommendations when queries are clean", async () => {
      const mockStats = {
        totalQueries: 100,
        uniquePages: 10,
        uniqueUsers: 5,
        topPages: [{ page: "/api/orders", count: 5 }], // 5 <= 100 * 0.1 = 10
        topQueries: [{ query: "SELECT id, name FROM orders", count: 50 }],
        sqlOperations: [{ operation: "SELECT", count: 100 }],
      };
      repository.getQueryStatistics.mockResolvedValue(mockStats);

      const result = await service.analyzeQueryPatterns();

      expect(result.recommendations).toHaveLength(0);
      expect(result.performanceInsights).toHaveLength(0);
    });
  });

  describe("bulkCreate", () => {
    it("should map DTOs to entities and return count", async () => {
      const dtos: CreateDatabaseQueryLogDto[] = [mockCreateDto, mockCreateDto];
      repository.bulkInsert.mockResolvedValue(undefined);

      const result = await service.bulkCreate(dtos);

      expect(repository.bulkInsert).toHaveBeenCalledTimes(1);
      const calledEntities = repository.bulkInsert.mock.calls[0][0];
      expect(calledEntities).toHaveLength(2);
      expect(calledEntities[0]).toBeInstanceOf(DatabaseQueryLogEntity);
      expect(calledEntities[0].query).toBe(
        "SELECT * FROM orders WHERE customer_id = 123",
      );
      expect(calledEntities[0].userId).toBe(54321);
      expect(result).toEqual({ created: 2, skipped: 0 });
    });

    it("should throw BadRequestException on error", async () => {
      repository.bulkInsert.mockRejectedValue(new Error("Bulk insert failed"));

      await expect(service.bulkCreate([mockCreateDto])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("logQuery", () => {
    it("should create DTO and call create", async () => {
      repository.save.mockResolvedValue(mockQueryLogEntity);

      const result = await service.logQuery(
        "SELECT * FROM orders",
        54321,
        "/api/orders",
        "at OrderService.findAll",
      );

      expect(repository.save).toHaveBeenCalledTimes(1);
      const savedEntity = repository.save.mock.calls[0][0];
      expect(savedEntity.query).toBe("SELECT * FROM orders");
      expect(savedEntity.userId).toBe(54321);
      expect(savedEntity.page).toBe("/api/orders");
      expect(savedEntity.backtrace).toBe("at OrderService.findAll");
      expect(result).toHaveProperty("id", 1);
    });
  });

  describe("analyzeQueryComplexity (private, tested via toEnhancedDto)", () => {
    it("should have base complexity of 1 for simple query", async () => {
      const simpleEntity = {
        ...mockQueryLogEntity,
        query: "SELECT id FROM orders",
      };
      const repoResult = {
        items: [simpleEntity],
        total: 1,
      };
      repository.findByUserId.mockResolvedValue(repoResult);

      const result = await service.getUserQueryLogs(54321, 1, 100);

      // base = 1, no JOIN, no subquery, no ORDER BY, no GROUP BY, no SELECT *
      // executionTimeMs = complexity * 10 = 1 * 10 = 10
      expect(result.data[0].executionTimeMs).toBe(10);
    });

    it("should add 2 per JOIN", async () => {
      const joinEntity = {
        ...mockQueryLogEntity,
        query: "SELECT o.id FROM orders o JOIN customers c ON o.cid = c.id",
      };
      const repoResult = {
        items: [joinEntity],
        total: 1,
      };
      repository.findByUserId.mockResolvedValue(repoResult);

      const result = await service.getUserQueryLogs(54321, 1, 100);

      // base = 1, 1 JOIN = +2 => complexity = 3, executionTimeMs = 30
      expect(result.data[0].executionTimeMs).toBe(30);
    });

    it("should add 1 for ORDER BY", async () => {
      const orderByEntity = {
        ...mockQueryLogEntity,
        query: "SELECT id FROM orders ORDER BY id",
      };
      const repoResult = {
        items: [orderByEntity],
        total: 1,
      };
      repository.findByUserId.mockResolvedValue(repoResult);

      const result = await service.getUserQueryLogs(54321, 1, 100);

      // base = 1, ORDER BY = +1 => complexity = 2, executionTimeMs = 20
      expect(result.data[0].executionTimeMs).toBe(20);
    });

    it("should add 2 for GROUP BY", async () => {
      const groupByEntity = {
        ...mockQueryLogEntity,
        query: "SELECT count(id) FROM orders GROUP BY status",
      };
      const repoResult = {
        items: [groupByEntity],
        total: 1,
      };
      repository.findByUserId.mockResolvedValue(repoResult);

      const result = await service.getUserQueryLogs(54321, 1, 100);

      // base = 1, 1 paren in count(id) = +1, GROUP BY = +2 => complexity = 4, executionTimeMs = 40
      expect(result.data[0].executionTimeMs).toBe(40);
    });
  });

  describe("toEnhancedDto (private, tested via findAll)", () => {
    it("should truncate long queries", async () => {
      const longQuery = "a".repeat(250);
      const longQueryEntity = {
        ...mockQueryLogEntity,
        query: longQuery,
      };
      const paginatedResult = {
        data: [longQueryEntity],
        meta: {
          total: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      repository.findManyWithQuery.mockResolvedValue(paginatedResult);

      const queryDto = new QueryDatabaseQueryLogDto();
      const result = await service.findAll(queryDto);

      expect(result.data[0].queryTruncated).toBe(
        longQuery.substring(0, 200) + "...",
      );
    });

    it("should not truncate short queries", async () => {
      const shortQuery = "SELECT id FROM orders";
      const shortQueryEntity = {
        ...mockQueryLogEntity,
        query: shortQuery,
      };
      const paginatedResult = {
        data: [shortQueryEntity],
        meta: {
          total: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      repository.findManyWithQuery.mockResolvedValue(paginatedResult);

      const queryDto = new QueryDatabaseQueryLogDto();
      const result = await service.findAll(queryDto);

      expect(result.data[0].queryTruncated).toBeUndefined();
    });

    it("should add executionTimeMs from analyzeQueryComplexity", async () => {
      const paginatedResult = {
        data: [mockQueryLogEntity],
        meta: {
          total: 1,
          page: 1,
          limit: 25,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      repository.findManyWithQuery.mockResolvedValue(paginatedResult);

      const queryDto = new QueryDatabaseQueryLogDto();
      const result = await service.findAll(queryDto);

      // mockQueryLogEntity.query = "SELECT * FROM orders WHERE customer_id = 123"
      // base = 1, SELECT * = +1 => complexity = 2, executionTimeMs = 20
      expect(result.data[0].executionTimeMs).toBe(20);
    });
  });
});
