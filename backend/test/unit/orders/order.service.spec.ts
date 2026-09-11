import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { NotFoundException } from "@nestjs/common";
import { OrderService } from "../../../src/orders/order.service";
import { OrderEntity } from "../../../src/orders/infrastructure/persistence/relational/entities/order.entity";
import { EnrichedOrdersService } from "../../../src/enriched-orders/enriched-orders.service";
import { CreateOrderDto } from "../../../src/orders/dto/create-order.dto";
import { UpdateOrderDto } from "../../../src/orders/dto/update-order.dto";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { OrderDto } from "../../../src/orders/dto/order.dto";

describe("OrderService", () => {
  let service: OrderService;
  let repository: jest.Mocked<Repository<OrderEntity>>;
  let enrichedOrdersService: { invalidateCache: jest.Mock };

  const mockOrderEntity: OrderEntity = {
    id: 12345,
    customerId: 67890,
    orderNumber: "ORD-2023-001234",
    status: "pending",
    priority: "normal",
    fitterId: 123,
    factoryId: 456,
    saddleSpecifications: {
      seatSize: "17.5",
      treeWidth: "Medium",
    },
    specialInstructions: "Customer prefers extra deep seat",
    estimatedDeliveryDate: new Date("2024-03-15"),
    actualDeliveryDate: null,
    totalAmount: 2500.0,
    depositPaid: 500.0,
    balanceOwing: 2000.0,
    measurements: { wither: "5.5", shoulder: "8.0" },
    isUrgent: false,
    // Legacy boolean flags
    rushed: false,
    repair: false,
    demo: false,
    sponsored: false,
    fitterStock: false,
    customOrder: false,
    changed: null,
    serialNumber: null,
    leatherId: null,
    orderStatus: 0,
    orderTime: null,
    seatSizes: ["17.5"],
    customerName: "John Smith",
    saddleId: 789,
    createdAt: new Date("2023-12-01"),
    updatedAt: new Date("2023-12-01"),
    deletedAt: null,
  } as OrderEntity;

  const createMockQueryBuilder = (
    mockResults: {
      getMany?: OrderEntity[];
      getOne?: OrderEntity | null;
      getCount?: number;
      getRawOne?: any;
      getRawMany?: any[];
    } = {},
  ) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getMany: jest
      .fn()
      .mockResolvedValue(mockResults.getMany || [mockOrderEntity]),
    getOne: jest.fn().mockResolvedValue(mockResults.getOne || mockOrderEntity),
    getCount: jest.fn().mockResolvedValue(mockResults.getCount ?? 1),
    getRawOne: jest
      .fn()
      .mockResolvedValue(
        mockResults.getRawOne || { count: "1", total: "2500" },
      ),
    getRawMany: jest.fn().mockResolvedValue(mockResults.getRawMany || []),
  });

  beforeEach(async () => {
    const mockQueryBuilder = createMockQueryBuilder();

    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      manager: {
        query: jest.fn(),
      },
    };

    enrichedOrdersService = {
      invalidateCache: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(OrderEntity),
          useValue: mockRepository,
        },
        {
          provide: EnrichedOrdersService,
          useValue: enrichedOrdersService,
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    repository = module.get(getRepositoryToken(OrderEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new order successfully", async () => {
      // Arrange
      const createDto: CreateOrderDto = {
        customerId: 67890,
        fitterId: 123,
        factoryId: 456,
        saddleId: 789,
        priceSaddle: 250000, // In cents
        priceDeposit: 50000,
        rushed: 0,
        name: "John Smith",
      };

      repository.create.mockReturnValue(mockOrderEntity);
      repository.save.mockResolvedValue(mockOrderEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.customerId).toBe(mockOrderEntity.customerId);
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it("should create urgent order when rushed flag is set", async () => {
      // Arrange
      const createDto: CreateOrderDto = {
        customerId: 67890,
        rushed: 1,
      };

      const urgentOrder = {
        ...mockOrderEntity,
        isUrgent: true,
        priority: "urgent",
      };
      repository.create.mockReturnValue(urgentOrder as OrderEntity);
      repository.save.mockResolvedValue(urgentOrder as OrderEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toBeDefined();
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isUrgent: true,
          priority: "urgent",
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return order by ID", async () => {
      // Arrange
      const orderId = 12345;
      repository.findOne.mockResolvedValue(mockOrderEntity);

      // Act
      const result = await service.findOne(orderId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockOrderEntity.id);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: orderId, deletedAt: IsNull() },
      });
    });

    it("should throw NotFoundException when order not found", async () => {
      // Arrange
      const orderId = 99999;
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(orderId)).rejects.toThrow(NotFoundException);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: orderId, deletedAt: IsNull() },
      });
    });
  });

  describe("findByOrderNumber", () => {
    it("should return order by order number", async () => {
      // Arrange
      const orderNumber = "ORD-2023-001234";
      repository.findOne.mockResolvedValue(mockOrderEntity);

      // Act
      const result = await service.findByOrderNumber(orderNumber);

      // Assert
      expect(result).toBeDefined();
      expect(result.orderNumber).toBe(orderNumber);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { orderNumber, deletedAt: IsNull() },
      });
    });

    it("should throw NotFoundException when order number not found", async () => {
      // Arrange
      const orderNumber = "ORD-NOTFOUND";
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findByOrderNumber(orderNumber)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated orders", async () => {
      // Arrange
      const page = 1;
      const limit = 10;

      // Act
      const result = await service.findAll(page, limit);

      // Assert
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.pages).toBe(1);
    });

    it("should apply filters when provided", async () => {
      // Arrange
      const page = 1;
      const limit = 10;
      const fitterId = 123;
      const customerId = 67890;
      const factoryId = 456;
      const status = "pending";

      // Act
      const result = await service.findAll(
        page,
        limit,
        fitterId,
        customerId,
        factoryId,
        status,
      );

      // Assert
      expect(result).toBeDefined();
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update order successfully", async () => {
      // Arrange
      const orderId = 12345;
      const updateDto: UpdateOrderDto = {
        status: "in_production",
        priority: "high",
        fitterId: 999,
      };

      const updatedEntity = { ...mockOrderEntity, ...updateDto };
      repository.findOne.mockResolvedValue(mockOrderEntity);
      repository.save.mockResolvedValue(updatedEntity as OrderEntity);

      // Act
      const result = await service.update(orderId, updateDto);

      // Assert
      expect(result).toBeDefined();
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: orderId, deletedAt: IsNull() },
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it("should update priority and set isUrgent when urgent", async () => {
      // Arrange
      const orderId = 12345;
      const updateDto: UpdateOrderDto = {
        priority: "urgent",
      };

      repository.findOne.mockResolvedValue(mockOrderEntity);
      repository.save.mockResolvedValue({
        ...mockOrderEntity,
        priority: "urgent",
        isUrgent: true,
      } as OrderEntity);

      // Act
      const result = await service.update(orderId, updateDto);

      // Assert
      expect(result).toBeDefined();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isUrgent: true }),
      );
    });

    it("should add additional deposit to existing deposit", async () => {
      // Arrange
      const orderId = 12345;
      const updateDto: UpdateOrderDto = {
        additionalDeposit: 250.0,
      };

      // Create a fresh order entity for this test to avoid state pollution
      const orderForTest = {
        ...mockOrderEntity,
        depositPaid: 500.0,
        balanceOwing: 2000.0,
      };

      repository.findOne.mockResolvedValue(orderForTest as OrderEntity);
      repository.save.mockResolvedValue({
        ...orderForTest,
        depositPaid: 750.0,
        balanceOwing: 1750.0,
      } as OrderEntity);

      // Act
      await service.update(orderId, updateDto);

      // Assert
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          depositPaid: 750.0,
        }),
      );
    });

    it("should throw NotFoundException when order not found", async () => {
      // Arrange
      const orderId = 99999;
      const updateDto: UpdateOrderDto = { status: "in_production" };
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(orderId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should soft delete order successfully", async () => {
      // Arrange
      const orderId = 12345;
      repository.findOne.mockResolvedValue(mockOrderEntity);
      repository.softDelete.mockResolvedValue({ affected: 1 } as any);

      // Act
      await service.remove(orderId);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: orderId, deletedAt: IsNull() },
      });
      expect(repository.softDelete).toHaveBeenCalledWith(orderId);
    });

    it("should invalidate the enriched-orders cache so the order disappears from lists and reports", async () => {
      repository.findOne.mockResolvedValue(mockOrderEntity);
      repository.softDelete.mockResolvedValue({ affected: 1 } as any);

      await service.remove(12345);

      expect(enrichedOrdersService.invalidateCache).toHaveBeenCalledTimes(1);
    });

    it("should throw NotFoundException when order not found", async () => {
      // Arrange
      const orderId = 99999;
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(orderId)).rejects.toThrow(NotFoundException);
      expect(repository.softDelete).not.toHaveBeenCalled();
      expect(enrichedOrdersService.invalidateCache).not.toHaveBeenCalled();
    });
  });

  describe("cancel", () => {
    it("should cancel order with reason", async () => {
      // Arrange
      const orderId = 12345;
      const reason = "Customer requested cancellation";
      const cancelledOrder = {
        ...mockOrderEntity,
        status: "cancelled",
        specialInstructions:
          `${mockOrderEntity.specialInstructions}\n\nCancellation reason: ${reason}`.trim(),
      };

      repository.findOne.mockResolvedValue(mockOrderEntity);
      repository.save.mockResolvedValue(cancelledOrder as OrderEntity);

      // Act
      const result = await service.cancel(orderId, reason);

      // Assert
      expect(result).toBeDefined();
      expect(result.status).toBe("cancelled");
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled" }),
      );
    });

    it("should throw NotFoundException when order not found", async () => {
      // Arrange
      const orderId = 99999;
      const reason = "Customer requested cancellation";
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.cancel(orderId, reason)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findByFitterId", () => {
    it("should return orders for fitter", async () => {
      // Arrange
      const fitterId = 123;
      repository.find.mockResolvedValue([mockOrderEntity]);

      // Act
      const result = await service.findByFitterId(fitterId);

      // Assert
      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { fitterId, deletedAt: IsNull() },
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("findByCustomerId", () => {
    it("should return orders for customer", async () => {
      // Arrange
      const customerId = 67890;
      repository.find.mockResolvedValue([mockOrderEntity]);

      // Act
      const result = await service.findByCustomerId(customerId);

      // Assert
      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { customerId, deletedAt: IsNull() },
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("findByFactoryId", () => {
    it("should return orders for factory", async () => {
      // Arrange
      const factoryId = 456;
      repository.find.mockResolvedValue([mockOrderEntity]);

      // Act
      const result = await service.findByFactoryId(factoryId);

      // Assert
      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { factoryId, deletedAt: IsNull() },
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("findUrgentOrders", () => {
    it("should return urgent orders", async () => {
      // Arrange
      const urgentOrder = { ...mockOrderEntity, isUrgent: true };
      repository.find.mockResolvedValue([urgentOrder as OrderEntity]);

      // Act
      const result = await service.findUrgentOrders();

      // Assert
      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { isUrgent: true, deletedAt: IsNull() },
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("findOverdueOrders", () => {
    it("should return overdue orders", async () => {
      // Arrange - using query builder mock

      // Act
      const result = await service.findOverdueOrders();

      // Assert
      expect(result).toBeDefined();
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe("findOrdersInProduction", () => {
    it("should return orders in production", async () => {
      // Arrange
      const productionOrder = { ...mockOrderEntity, status: "in_production" };
      repository.find.mockResolvedValue([productionOrder as OrderEntity]);

      // Act
      const result = await service.findOrdersInProduction();

      // Assert
      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { status: "in_production", deletedAt: IsNull() },
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("findOrdersForProduction", () => {
    it("should return orders for production with limit", async () => {
      // Arrange
      const limit = 25;

      // Act
      const result = await service.findOrdersForProduction(limit);

      // Assert
      expect(result).toBeDefined();
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });

    it("should return orders for production without limit", async () => {
      // Act
      const result = await service.findOrdersForProduction();

      // Assert
      expect(result).toBeDefined();
    });
  });

  describe("findOrdersRequiringDeposit", () => {
    it("should return orders requiring deposit", async () => {
      // Act
      const result = await service.findOrdersRequiringDeposit();

      // Assert
      expect(result).toBeDefined();
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe("getCustomerOrderSummary", () => {
    it("should return customer order summary", async () => {
      // Act
      const result = await service.getCustomerOrderSummary(67890);

      // Assert
      expect(result).toBeDefined();
      expect(result.orderCount).toBe(1);
      expect(result.totalValue).toBe(2500);
    });
  });

  describe("getOrderStats", () => {
    it("should return order statistics", async () => {
      // Arrange - mock the raw SQL queries used by getOrderStats
      (repository.manager.query as jest.Mock)
        .mockResolvedValueOnce([{ count: "150" }]) // total orders
        .mockResolvedValueOnce([{ count: "12" }]) // urgent orders (rushed = true)
        .mockResolvedValueOnce([{ count: "8" }]) // overdue orders
        .mockResolvedValueOnce([{ avg: "2750.5" }]) // average value
        .mockResolvedValueOnce([
          // status counts (order_status integer column)
          { status: 0, count: "45" }, // unordered
          { status: 3, count: "35" }, // in_production_p1
          { status: 7, count: "50" }, // completed_sale
        ]);

      // Act
      const result = await service.getOrderStats();

      // Assert
      expect(result).toBeDefined();
      expect(result.totalOrders).toBe(150);
      expect(result.urgentOrders).toBe(12);
      expect(result.overdueOrders).toBe(8);
      expect(result.averageValue).toBe(2750.5);
      expect(result.statusCounts).toEqual({
        unordered: 45,
        in_production_p1: 35,
        completed_sale: 50,
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty results from repository", async () => {
      // Arrange
      repository.find.mockResolvedValue([]);

      // Act
      const result = await service.findUrgentOrders();

      // Assert
      expect(result).toEqual([]);
    });

    it("should handle repository errors gracefully", async () => {
      // Arrange
      const orderId = 12345;
      repository.findOne.mockRejectedValue(
        new Error("Database connection error"),
      );

      // Act & Assert
      await expect(service.findOne(orderId)).rejects.toThrow(
        "Database connection error",
      );
    });
  });
});
