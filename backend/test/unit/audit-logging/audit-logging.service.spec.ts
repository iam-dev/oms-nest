import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AuditLoggingService } from "../../../src/audit-logging/audit-logging.service";
import { AuditLogRepository } from "../../../src/audit-logging/infrastructure/persistence/relational/repositories/audit-log.repository";
import { AuditLogEntity } from "../../../src/audit-logging/infrastructure/persistence/relational/entities/audit-log.entity";
import { CreateAuditLogDto } from "../../../src/audit-logging/dto/create-audit-log.dto";
import { QueryAuditLogDto } from "../../../src/audit-logging/dto/query-audit-log.dto";

describe("AuditLoggingService", () => {
  let service: AuditLoggingService;
  let repository: jest.Mocked<AuditLogRepository>;

  const mockAuditLogEntity: AuditLogEntity = {
    id: 1,
    userId: 54321,
    userType: 2,
    orderId: 67890,
    action: "Order status changed",
    orderStatusFrom: 1,
    orderStatusTo: 2,
    entityType: "Order",
    entityId: "67890",
    timestamp: new Date("2024-01-15T14:30:00.000Z"),
    createdAt: new Date("2024-01-15T14:30:01.000Z"),
    user: Promise.resolve(null) as any,
    order: Promise.resolve(null) as any,
  } as AuditLogEntity;

  const mockCreateDto: CreateAuditLogDto = {
    userId: 54321,
    userType: 2,
    orderId: 67890,
    action: "Order status changed",
    orderStatusFrom: 1,
    orderStatusTo: 2,
    entityType: "Order",
    entityId: "67890",
    timestamp: "2024-01-15T14:30:00.000Z",
  };

  beforeEach(async () => {
    const mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findManyWithQuery: jest.fn(),
      findByOrderId: jest.fn(),
      findByUserId: jest.fn(),
      findStatusChanges: jest.fn(),
      getAuditStatistics: jest.fn(),
      bulkInsert: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggingService,
        {
          provide: AuditLogRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<AuditLoggingService>(AuditLoggingService);
    repository = module.get(AuditLogRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new audit log entry successfully", async () => {
      repository.save.mockResolvedValue(mockAuditLogEntity);

      const result = await service.create(mockCreateDto);

      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("userId", 54321);
      expect(result).toHaveProperty("action", "Order status changed");
      expect(result).toHaveProperty("orderId", 67890);
    });

    it("should throw BadRequestException on repository error", async () => {
      repository.save.mockRejectedValue(new Error("Database error"));

      await expect(service.create(mockCreateDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(mockCreateDto)).rejects.toThrow(
        "Failed to create audit log entry",
      );
    });
  });

  describe("findOne", () => {
    it("should find an audit log entry by id", async () => {
      repository.findById.mockResolvedValue(mockAuditLogEntity);

      const result = await service.findOne(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("userId", 54321);
    });

    it("should throw NotFoundException when audit log not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(
        "Audit log entry not found",
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated audit log DTOs", async () => {
      const queryDto = new QueryAuditLogDto();
      const paginatedResult = {
        data: [mockAuditLogEntity],
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
      expect(result.meta).toEqual(paginatedResult.meta);
    });

    it("should throw BadRequestException on repository error", async () => {
      const queryDto = new QueryAuditLogDto();
      repository.findManyWithQuery.mockRejectedValue(
        new Error("Search failed"),
      );

      await expect(service.findAll(queryDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAll(queryDto)).rejects.toThrow(
        "Failed to search audit logs",
      );
    });
  });

  describe("getOrderAuditTrail", () => {
    it("should return paginated order audit trail", async () => {
      const repoResult = {
        items: [mockAuditLogEntity],
        total: 1,
      };
      repository.findByOrderId.mockResolvedValue(repoResult);

      const result = await service.getOrderAuditTrail(67890, 1, 50);

      expect(repository.findByOrderId).toHaveBeenCalledWith(67890, 50, 0);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(50);
    });

    it("should calculate offset correctly for page 2 with limit 50", async () => {
      const repoResult = {
        items: [mockAuditLogEntity],
        total: 75,
      };
      repository.findByOrderId.mockResolvedValue(repoResult);

      const result = await service.getOrderAuditTrail(67890, 2, 50);

      // offset = (page - 1) * limit = (2 - 1) * 50 = 50
      expect(repository.findByOrderId).toHaveBeenCalledWith(67890, 50, 50);
      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(2);
      expect(result.meta.hasNextPage).toBe(false);
    });
  });

  describe("getUserAuditTrail", () => {
    it("should return user audit trail with pagination meta", async () => {
      const repoResult = {
        items: [mockAuditLogEntity],
        total: 150,
      };
      repository.findByUserId.mockResolvedValue(repoResult);

      const result = await service.getUserAuditTrail(54321, 1, 100);

      expect(repository.findByUserId).toHaveBeenCalledWith(54321, 100, 0);
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(150);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(100);
      expect(result.meta.totalPages).toBe(2);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.count).toBe(1);
    });
  });

  describe("getStatusChangeHistory", () => {
    it("should pass optional filters to repository", async () => {
      const repoResult = {
        items: [mockAuditLogEntity],
        total: 1,
      };
      repository.findStatusChanges.mockResolvedValue(repoResult);

      const result = await service.getStatusChangeHistory(67890, 1, 2, 1, 50);

      expect(repository.findStatusChanges).toHaveBeenCalledWith(
        67890,
        1,
        2,
        50,
        0,
      );
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it("should handle undefined optional parameters", async () => {
      const repoResult = {
        items: [],
        total: 0,
      };
      repository.findStatusChanges.mockResolvedValue(repoResult);

      await service.getStatusChangeHistory(undefined, undefined, undefined);

      expect(repository.findStatusChanges).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        50,
        0,
      );
    });
  });

  describe("getAuditStatistics", () => {
    it("should delegate to repository with date range", async () => {
      const fromDate = new Date("2024-01-01");
      const toDate = new Date("2024-12-31");
      const mockStats = {
        totalLogs: 764381,
        statusChanges: 125000,
        uniqueUsers: 450,
        uniqueOrders: 85000,
        topActions: [{ action: "Order status changed", count: 25000 }],
      };
      repository.getAuditStatistics.mockResolvedValue(mockStats);

      const result = await service.getAuditStatistics(fromDate, toDate);

      expect(repository.getAuditStatistics).toHaveBeenCalledWith(
        fromDate,
        toDate,
      );
      expect(result).toEqual(mockStats);
    });

    it("should handle call without dates", async () => {
      const mockStats = {
        totalLogs: 764381,
        statusChanges: 125000,
        uniqueUsers: 450,
        uniqueOrders: 85000,
        topActions: [],
      };
      repository.getAuditStatistics.mockResolvedValue(mockStats);

      const result = await service.getAuditStatistics();

      expect(repository.getAuditStatistics).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
      expect(result.totalLogs).toBe(764381);
    });
  });

  describe("bulkCreate", () => {
    it("should map DTOs to entities and return count", async () => {
      const dtos: CreateAuditLogDto[] = [mockCreateDto, mockCreateDto];
      repository.bulkInsert.mockResolvedValue(undefined);

      const result = await service.bulkCreate(dtos);

      expect(repository.bulkInsert).toHaveBeenCalledTimes(1);
      const calledEntities = repository.bulkInsert.mock.calls[0][0];
      expect(calledEntities).toHaveLength(2);
      expect(calledEntities[0]).toBeInstanceOf(AuditLogEntity);
      expect(calledEntities[0].userId).toBe(54321);
      expect(calledEntities[0].action).toBe("Order status changed");
      expect(result).toEqual({ created: 2, skipped: 0 });
    });

    it("should throw BadRequestException on error", async () => {
      repository.bulkInsert.mockRejectedValue(new Error("Bulk insert failed"));

      await expect(service.bulkCreate([mockCreateDto])).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("logAction", () => {
    it("should create DTO and call create", async () => {
      repository.save.mockResolvedValue(mockAuditLogEntity);

      const result = await service.logAction(
        54321,
        "Order status changed",
        67890,
        1,
        2,
        2,
      );

      expect(repository.save).toHaveBeenCalledTimes(1);
      const savedEntity = repository.save.mock.calls[0][0];
      expect(savedEntity.userId).toBe(54321);
      expect(savedEntity.action).toBe("Order status changed");
      expect(savedEntity.orderId).toBe(67890);
      expect(savedEntity.orderStatusFrom).toBe(1);
      expect(savedEntity.orderStatusTo).toBe(2);
      expect(savedEntity.userType).toBe(2);
      expect(result).toHaveProperty("id", 1);
    });
  });

  describe("archiveOldLogs", () => {
    it("should return archived count of 0 (placeholder)", async () => {
      const beforeDate = new Date("2023-01-01");

      const result = await service.archiveOldLogs(beforeDate);

      expect(result).toEqual({ archived: 0 });
    });
  });

  describe("toDto (private, tested via create)", () => {
    it("should convert Date timestamp to ISO string", async () => {
      const entityWithDateTimestamp = {
        ...mockAuditLogEntity,
        timestamp: new Date("2024-01-15T14:30:00.000Z"),
        createdAt: new Date("2024-01-15T14:30:01.000Z"),
      };
      repository.save.mockResolvedValue(entityWithDateTimestamp);

      const result = await service.create(mockCreateDto);

      expect(result.timestamp).toBe("2024-01-15T14:30:00.000Z");
      expect(result.createdAt).toBe("2024-01-15T14:30:01.000Z");
    });

    it("should handle string timestamp without conversion", async () => {
      const entityWithStringTimestamp = {
        ...mockAuditLogEntity,
        timestamp: "2024-01-15T14:30:00.000Z" as any,
        createdAt: "2024-01-15T14:30:01.000Z" as any,
      };
      repository.save.mockResolvedValue(entityWithStringTimestamp);

      const result = await service.create(mockCreateDto);

      expect(result.timestamp).toBe("2024-01-15T14:30:00.000Z");
      expect(result.createdAt).toBe("2024-01-15T14:30:01.000Z");
    });
  });
});
