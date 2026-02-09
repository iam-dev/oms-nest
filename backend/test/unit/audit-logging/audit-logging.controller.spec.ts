import { Test, TestingModule } from "@nestjs/testing";
import { AuditLoggingController } from "../../../src/audit-logging/audit-logging.controller";
import { AuditLoggingService } from "../../../src/audit-logging/audit-logging.service";
import { AuditLogDto } from "../../../src/audit-logging/dto/audit-log.dto";
import { QueryAuditLogDto } from "../../../src/audit-logging/dto/query-audit-log.dto";

describe("AuditLoggingController", () => {
  let controller: AuditLoggingController;
  let service: jest.Mocked<AuditLoggingService>;

  const mockAuditLogDto: AuditLogDto = {
    id: 1,
    userId: 54321,
    userType: 2,
    orderId: 67890,
    action: "Order status changed",
    orderStatusFrom: 1,
    orderStatusTo: 2,
    entityType: "Order",
    entityId: "67890",
    timestamp: "2024-01-15T14:30:00.000Z",
    createdAt: "2024-01-15T14:30:01.000Z",
  } as AuditLogDto;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getAuditStatistics: jest.fn(),
      getOrderAuditTrail: jest.fn(),
      getUserAuditTrail: jest.fn(),
      getStatusChangeHistory: jest.fn(),
      bulkCreate: jest.fn(),
      logAction: jest.fn(),
      archiveOldLogs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditLoggingController],
      providers: [
        {
          provide: AuditLoggingService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<AuditLoggingController>(AuditLoggingController);
    service = module.get(AuditLoggingService);
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
        userId: 54321,
        userType: 2,
        action: "Order status changed",
        timestamp: "2024-01-15T14:30:00.000Z",
      };
      service.create.mockResolvedValue(mockAuditLogDto);

      const result = await controller.create(createDto as any);

      expect(result).toEqual(mockAuditLogDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("findAll", () => {
    it("should delegate to service", async () => {
      const queryDto = new QueryAuditLogDto();
      const paginatedResult = {
        data: [mockAuditLogDto],
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
        totalLogs: 764381,
        statusChanges: 125000,
        uniqueUsers: 450,
        uniqueOrders: 85000,
        topActions: [{ action: "Order status changed", count: 25000 }],
      };
      service.getAuditStatistics.mockResolvedValue(mockStats);

      const fromDate = "2024-01-01T00:00:00.000Z";
      const toDate = "2024-12-31T23:59:59.999Z";
      const result = await controller.getStatistics(fromDate, toDate);

      expect(result).toEqual(mockStats);
      expect(service.getAuditStatistics).toHaveBeenCalledWith(
        new Date(fromDate),
        new Date(toDate),
      );
    });

    it("should pass undefined when no dates provided", async () => {
      const mockStats = {
        totalLogs: 764381,
        statusChanges: 125000,
        uniqueUsers: 450,
        uniqueOrders: 85000,
        topActions: [],
      };
      service.getAuditStatistics.mockResolvedValue(mockStats);

      await controller.getStatistics();

      expect(service.getAuditStatistics).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });
  });

  describe("getOrderAuditTrail", () => {
    it("should pass orderId, page, and limit to service", async () => {
      const paginatedResult = {
        data: [mockAuditLogDto],
        meta: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      service.getOrderAuditTrail.mockResolvedValue(paginatedResult);

      const result = await controller.getOrderAuditTrail(67890, 1, 50);

      expect(result).toEqual(paginatedResult);
      expect(service.getOrderAuditTrail).toHaveBeenCalledWith(67890, 1, 50);
    });
  });

  describe("getUserAuditTrail", () => {
    it("should pass userId, page, and limit to service", async () => {
      const paginatedResult = {
        data: [mockAuditLogDto],
        meta: {
          total: 1,
          page: 1,
          limit: 100,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      service.getUserAuditTrail.mockResolvedValue(paginatedResult);

      const result = await controller.getUserAuditTrail(54321, 1, 100);

      expect(result).toEqual(paginatedResult);
      expect(service.getUserAuditTrail).toHaveBeenCalledWith(54321, 1, 100);
    });
  });

  describe("getStatusChangeHistory", () => {
    it("should pass all optional params to service", async () => {
      const paginatedResult = {
        data: [mockAuditLogDto],
        meta: {
          total: 1,
          page: 1,
          limit: 50,
          totalPages: 1,
          hasNextPage: false,
          count: 1,
        },
      };
      service.getStatusChangeHistory.mockResolvedValue(paginatedResult);

      const result = await controller.getStatusChangeHistory(
        67890,
        1,
        2,
        1,
        50,
      );

      expect(result).toEqual(paginatedResult);
      expect(service.getStatusChangeHistory).toHaveBeenCalledWith(
        67890,
        1,
        2,
        1,
        50,
      );
    });
  });

  describe("findOne", () => {
    it("should delegate to service", async () => {
      service.findOne.mockResolvedValue(mockAuditLogDto);

      const result = await controller.findOne(1);

      expect(result).toEqual(mockAuditLogDto);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe("bulkCreate", () => {
    it("should delegate to service", async () => {
      const createDtos = [
        {
          userId: 54321,
          userType: 2,
          action: "Order status changed",
          timestamp: "2024-01-15T14:30:00.000Z",
        },
      ];
      const bulkResult = { created: 1, skipped: 0 };
      service.bulkCreate.mockResolvedValue(bulkResult);

      const result = await controller.bulkCreate(createDtos as any);

      expect(result).toEqual(bulkResult);
      expect(service.bulkCreate).toHaveBeenCalledWith(createDtos);
    });
  });

  describe("logAction", () => {
    it("should pass body params to service", async () => {
      service.logAction.mockResolvedValue(mockAuditLogDto);

      const body = {
        userId: 54321,
        action: "Order status changed",
        orderId: 67890,
        orderStatusFrom: 1,
        orderStatusTo: 2,
        userType: 2,
      };
      const result = await controller.logAction(body);

      expect(result).toEqual(mockAuditLogDto);
      expect(service.logAction).toHaveBeenCalledWith(
        54321,
        "Order status changed",
        67890,
        1,
        2,
        2,
      );
    });
  });

  describe("archiveOldLogs", () => {
    it("should pass beforeDate as Date to service", async () => {
      const archiveResult = { archived: 0 };
      service.archiveOldLogs.mockResolvedValue(archiveResult);

      const beforeDateStr = "2023-01-01T00:00:00.000Z";
      const result = await controller.archiveOldLogs({
        beforeDate: beforeDateStr,
      });

      expect(result).toEqual(archiveResult);
      expect(service.archiveOldLogs).toHaveBeenCalledWith(
        new Date(beforeDateStr),
      );
    });
  });
});
