import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { OrderController } from "../../../src/orders/order.controller";
import { OrderService } from "../../../src/orders/order.service";
import { OrderSearchService } from "../../../src/orders/order-search.service";
import { CreateOrderDto } from "../../../src/orders/dto/create-order.dto";
import { UpdateOrderDto } from "../../../src/orders/dto/update-order.dto";
import { OrderDto } from "../../../src/orders/dto/order.dto";

describe("OrderController", () => {
  let controller: OrderController;
  let orderService: jest.Mocked<OrderService>;

  const mockOrderDto: OrderDto = {
    id: 12345,
    orderNumber: "ORD-2023-001234",
    customerId: 67890,
    fitterId: 123,
    factoryId: 456,
    status: "pending",
    priority: "normal",
    totalAmount: 2500.0,
    depositPaid: 500.0,
    balanceOwing: 2000.0,
    saddleSpecifications: {
      seatSize: "17.5",
      treeWidth: "Medium",
      panelType: "Wool",
    },
    estimatedDeliveryDate: new Date("2024-03-15"),
    specialInstructions: "Customer prefers extra deep seat",
    measurements: {
      wither: "5.5",
      shoulder: "8.0",
      back: "12.5",
    },
    isUrgent: false,
    // Legacy boolean flags
    rushed: false,
    repair: false,
    demo: false,
    sponsored: false,
    fitterStock: false,
    customOrder: false,
    changed: null,
    seatSizes: null,
    actualDeliveryDate: null,
    isOverdue: false,
    daysUntilDelivery: 105,
    paymentPercentage: 20.0,
    customerName: "John Smith",
    saddleId: 789,
    createdAt: new Date("2023-12-01"),
    updatedAt: new Date("2023-12-01"),
  };

  const mockOrderStats = {
    totalOrders: 150,
    urgentOrders: 12,
    overdueOrders: 8,
    averageValue: 2750.5,
    statusCounts: {
      pending: 45,
      in_progress: 35,
      completed: 50,
      cancelled: 20,
    },
  };

  const mockCustomerSummary = {
    orderCount: 3,
    totalValue: 7500.0,
  };

  beforeEach(async () => {
    const mockOrderService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByOrderNumber: jest.fn(),
      findByCustomerId: jest.fn(),
      findByFitterId: jest.fn(),
      findByFactoryId: jest.fn(),
      findUrgentOrders: jest.fn(),
      findOverdueOrders: jest.fn(),
      findOrdersInProduction: jest.fn(),
      findOrdersForProduction: jest.fn(),
      findOrdersRequiringDeposit: jest.fn(),
      getOrderStats: jest.fn(),
      getCustomerOrderSummary: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      remove: jest.fn(),
    };

    const mockOrderSearchService = {
      searchOrders: jest.fn(),
      findOrdersByCustomer: jest.fn(),
      findOrdersByFitter: jest.fn(),
      findOrdersByFactory: jest.fn(),
      getSearchSuggestions: jest.fn(),
      getSearchStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: OrderSearchService, useValue: mockOrderSearchService },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    orderService = module.get(OrderService);
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
      };
      orderService.create.mockResolvedValue(mockOrderDto);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(mockOrderDto);
      expect(orderService.create).toHaveBeenCalledWith(createDto);
      expect(orderService.create).toHaveBeenCalledTimes(1);
    });

    it("should handle order creation with minimal data", async () => {
      // Arrange
      const minimalCreateDto: CreateOrderDto = {
        customerId: 67890,
      };
      const minimalOrderDto: OrderDto = { ...mockOrderDto, customerId: 67890 };
      orderService.create.mockResolvedValue(minimalOrderDto);

      // Act
      const result = await controller.create(minimalCreateDto);

      // Assert
      expect(result).toEqual(minimalOrderDto);
      expect(orderService.create).toHaveBeenCalledWith(minimalCreateDto);
    });
  });

  describe("findAll", () => {
    it("should return all orders with pagination", async () => {
      // Arrange
      const page = 1;
      const limit = 10;
      const orders = [mockOrderDto];
      const paginatedResult = { data: orders, total: 1, pages: 1 };
      orderService.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll(page, limit);

      // Assert
      expect(result).toEqual(paginatedResult);
      expect(orderService.findAll).toHaveBeenCalledWith(
        page,
        limit,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(orderService.findAll).toHaveBeenCalledTimes(1);
    });

    it("should return all orders with filters", async () => {
      // Arrange
      const page = 1;
      const limit = 10;
      const fitterId = 123;
      const customerId = 67890;
      const factoryId = 456;
      const status = "pending";
      const orders = [mockOrderDto];
      const paginatedResult = { data: orders, total: 1, pages: 1 };
      orderService.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll(
        page,
        limit,
        fitterId,
        customerId,
        factoryId,
        status,
      );

      // Assert
      expect(result).toEqual(paginatedResult);
      expect(orderService.findAll).toHaveBeenCalledWith(
        page,
        limit,
        fitterId,
        customerId,
        factoryId,
        status,
      );
    });
  });

  describe("findOne", () => {
    it("should return order by ID", async () => {
      // Arrange
      const orderId = 12345;
      orderService.findOne.mockResolvedValue(mockOrderDto);

      // Act
      const result = await controller.findOne(orderId);

      // Assert
      expect(result).toEqual(mockOrderDto);
      expect(orderService.findOne).toHaveBeenCalledWith(orderId);
      expect(orderService.findOne).toHaveBeenCalledTimes(1);
    });

    it("should handle order not found", async () => {
      // Arrange
      const orderId = 99999;
      orderService.findOne.mockRejectedValue(
        new NotFoundException("Order not found"),
      );

      // Act & Assert
      await expect(controller.findOne(orderId)).rejects.toThrow(
        NotFoundException,
      );
      expect(orderService.findOne).toHaveBeenCalledWith(orderId);
    });
  });

  describe("findByOrderNumber", () => {
    it("should return order by order number", async () => {
      // Arrange
      const orderNumber = "ORD-2023-001234";
      orderService.findByOrderNumber.mockResolvedValue(mockOrderDto);

      // Act
      const result = await controller.findByOrderNumber(orderNumber);

      // Assert
      expect(result).toEqual(mockOrderDto);
      expect(orderService.findByOrderNumber).toHaveBeenCalledWith(orderNumber);
      expect(orderService.findByOrderNumber).toHaveBeenCalledTimes(1);
    });
  });

  describe("findByCustomer", () => {
    it("should return orders for a specific customer", async () => {
      // Arrange
      const customerId = 67890;
      const orders = [mockOrderDto];
      orderService.findByCustomerId.mockResolvedValue(orders);

      // Act
      const result = await controller.findByCustomer(customerId);

      // Assert
      expect(result).toEqual(orders);
      expect(orderService.findByCustomerId).toHaveBeenCalledWith(customerId);
      expect(orderService.findByCustomerId).toHaveBeenCalledTimes(1);
    });
  });

  describe("findByFitter", () => {
    it("should return orders for a specific fitter", async () => {
      // Arrange
      const fitterId = 123;
      const orders = [mockOrderDto];
      orderService.findByFitterId.mockResolvedValue(orders);

      // Act
      const result = await controller.findByFitter(fitterId);

      // Assert
      expect(result).toEqual(orders);
      expect(orderService.findByFitterId).toHaveBeenCalledWith(fitterId);
      expect(orderService.findByFitterId).toHaveBeenCalledTimes(1);
    });
  });

  describe("findByFactory", () => {
    it("should return orders for a specific factory", async () => {
      // Arrange
      const factoryId = 456;
      const orders = [mockOrderDto];
      orderService.findByFactoryId.mockResolvedValue(orders);

      // Act
      const result = await controller.findByFactory(factoryId);

      // Assert
      expect(result).toEqual(orders);
      expect(orderService.findByFactoryId).toHaveBeenCalledWith(factoryId);
      expect(orderService.findByFactoryId).toHaveBeenCalledTimes(1);
    });
  });

  describe("findUrgent", () => {
    it("should return urgent orders", async () => {
      // Arrange
      const urgentOrder = { ...mockOrderDto, isUrgent: true, priority: "high" };
      const urgentOrders = [urgentOrder];
      orderService.findUrgentOrders.mockResolvedValue(urgentOrders);

      // Act
      const result = await controller.findUrgent();

      // Assert
      expect(result).toEqual(urgentOrders);
      expect(orderService.findUrgentOrders).toHaveBeenCalledWith();
      expect(orderService.findUrgentOrders).toHaveBeenCalledTimes(1);
    });
  });

  describe("findOverdue", () => {
    it("should return overdue orders", async () => {
      // Arrange
      const overdueOrder = {
        ...mockOrderDto,
        estimatedDeliveryDate: new Date("2023-11-01"),
        status: "in_production",
      };
      const overdueOrders = [overdueOrder];
      orderService.findOverdueOrders.mockResolvedValue(overdueOrders);

      // Act
      const result = await controller.findOverdue();

      // Assert
      expect(result).toEqual(overdueOrders);
      expect(orderService.findOverdueOrders).toHaveBeenCalledWith();
      expect(orderService.findOverdueOrders).toHaveBeenCalledTimes(1);
    });
  });

  describe("findInProduction", () => {
    it("should return orders in production", async () => {
      // Arrange
      const productionOrder = { ...mockOrderDto, status: "in_production" };
      const productionOrders = [productionOrder];
      orderService.findOrdersInProduction.mockResolvedValue(productionOrders);

      // Act
      const result = await controller.findInProduction();

      // Assert
      expect(result).toEqual(productionOrders);
      expect(orderService.findOrdersInProduction).toHaveBeenCalledWith();
      expect(orderService.findOrdersInProduction).toHaveBeenCalledTimes(1);
    });
  });

  describe("findForProduction", () => {
    it("should return orders for production scheduling with limit", async () => {
      // Arrange
      const limit = 25;
      const productionOrders = [mockOrderDto];
      orderService.findOrdersForProduction.mockResolvedValue(productionOrders);

      // Act
      const result = await controller.findForProduction(limit);

      // Assert
      expect(result).toEqual(productionOrders);
      expect(orderService.findOrdersForProduction).toHaveBeenCalledWith(limit);
      expect(orderService.findOrdersForProduction).toHaveBeenCalledTimes(1);
    });

    it("should return orders for production scheduling without limit", async () => {
      // Arrange
      const productionOrders = [mockOrderDto];
      orderService.findOrdersForProduction.mockResolvedValue(productionOrders);

      // Act
      const result = await controller.findForProduction();

      // Assert
      expect(result).toEqual(productionOrders);
      expect(orderService.findOrdersForProduction).toHaveBeenCalledWith(
        undefined,
      );
    });
  });

  describe("findRequiringDeposit", () => {
    it("should return orders requiring deposit", async () => {
      // Arrange
      const depositOrder = {
        ...mockOrderDto,
        depositPaid: 0,
        balanceOwing: 2500.0,
      };
      const depositOrders = [depositOrder];
      orderService.findOrdersRequiringDeposit.mockResolvedValue(depositOrders);

      // Act
      const result = await controller.findRequiringDeposit();

      // Assert
      expect(result).toEqual(depositOrders);
      expect(orderService.findOrdersRequiringDeposit).toHaveBeenCalledWith();
      expect(orderService.findOrdersRequiringDeposit).toHaveBeenCalledTimes(1);
    });
  });

  describe("getStats", () => {
    it("should return order statistics", async () => {
      // Arrange
      orderService.getOrderStats.mockResolvedValue(mockOrderStats);

      // Act
      const result = await controller.getStats();

      // Assert
      expect(result).toEqual(mockOrderStats);
      expect(orderService.getOrderStats).toHaveBeenCalledWith();
      expect(orderService.getOrderStats).toHaveBeenCalledTimes(1);
    });
  });

  describe("getCustomerSummary", () => {
    it("should return customer order summary", async () => {
      // Arrange
      const customerId = 67890;
      orderService.getCustomerOrderSummary.mockResolvedValue(
        mockCustomerSummary,
      );

      // Act
      const result = await controller.getCustomerSummary(customerId);

      // Assert
      expect(result).toEqual(mockCustomerSummary);
      expect(orderService.getCustomerOrderSummary).toHaveBeenCalledWith(
        customerId,
      );
      expect(orderService.getCustomerOrderSummary).toHaveBeenCalledTimes(1);
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
        factoryId: 888,
      };
      const updatedOrder = { ...mockOrderDto, ...updateDto };
      orderService.update.mockResolvedValue(updatedOrder);

      // Act
      const result = await controller.update(orderId, updateDto, {} as any);

      // Assert
      expect(result).toEqual(updatedOrder);
      expect(orderService.update).toHaveBeenCalledWith(orderId, updateDto);
      expect(orderService.update).toHaveBeenCalledTimes(1);
    });

    it("should handle partial update", async () => {
      // Arrange
      const orderId = 12345;
      const updateDto: UpdateOrderDto = {
        status: "in_production",
      };
      const partiallyUpdatedOrder = {
        ...mockOrderDto,
        status: "in_production",
      };
      orderService.update.mockResolvedValue(partiallyUpdatedOrder);

      // Act
      const result = await controller.update(orderId, updateDto, {} as any);

      // Assert
      expect(result).toEqual(partiallyUpdatedOrder);
      expect(orderService.update).toHaveBeenCalledWith(orderId, updateDto);
    });
  });

  describe("cancel", () => {
    it("should cancel order with valid reason", async () => {
      // Arrange
      const orderId = 12345;
      const reason = "Customer requested cancellation";
      const cancelledOrder = { ...mockOrderDto, status: "cancelled" };
      orderService.cancel.mockResolvedValue(cancelledOrder);

      // Act
      const result = await controller.cancel(orderId, reason);

      // Assert
      expect(result).toEqual(cancelledOrder);
      expect(orderService.cancel).toHaveBeenCalledWith(orderId, reason);
      expect(orderService.cancel).toHaveBeenCalledTimes(1);
    });

    it("should handle cancellation with empty reason", async () => {
      // Arrange
      const orderId = 12345;
      const reason = "";
      orderService.cancel.mockRejectedValue(
        new BadRequestException("Cancellation reason is required"),
      );

      // Act & Assert
      await expect(controller.cancel(orderId, reason)).rejects.toThrow(
        BadRequestException,
      );
      expect(orderService.cancel).toHaveBeenCalledWith(orderId, reason);
    });
  });

  describe("remove", () => {
    it("should remove order successfully", async () => {
      // Arrange
      const orderId = 12345;
      orderService.remove.mockResolvedValue();

      // Act
      await controller.remove(orderId);

      // Assert
      expect(orderService.remove).toHaveBeenCalledWith(orderId);
      expect(orderService.remove).toHaveBeenCalledTimes(1);
    });

    it("should handle order not found during removal", async () => {
      // Arrange
      const orderId = 99999;
      orderService.remove.mockRejectedValue(
        new NotFoundException("Order not found"),
      );

      // Act & Assert
      await expect(controller.remove(orderId)).rejects.toThrow(
        NotFoundException,
      );
      expect(orderService.remove).toHaveBeenCalledWith(orderId);
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle service throwing unexpected errors", async () => {
      // Arrange
      const orderId = 12345;
      orderService.findOne.mockRejectedValue(
        new Error("Database connection error"),
      );

      // Act & Assert
      await expect(controller.findOne(orderId)).rejects.toThrow(
        "Database connection error",
      );
      expect(orderService.findOne).toHaveBeenCalledWith(orderId);
    });

    it("should handle empty arrays from service methods", async () => {
      // Arrange
      orderService.findUrgentOrders.mockResolvedValue([]);

      // Act
      const result = await controller.findUrgent();

      // Assert
      expect(result).toEqual([]);
      expect(orderService.findUrgentOrders).toHaveBeenCalledWith();
    });

    it("should handle null/undefined from service methods", async () => {
      // Arrange
      const customerId = 67890;
      orderService.findByCustomerId.mockResolvedValue([]);

      // Act
      const result = await controller.findByCustomer(customerId);

      // Assert
      expect(result).toEqual([]);
      expect(orderService.findByCustomerId).toHaveBeenCalledWith(customerId);
    });

    it("should handle zero values in statistics", async () => {
      // Arrange
      const zeroStats = {
        totalOrders: 0,
        urgentOrders: 0,
        overdueOrders: 0,
        averageValue: 0,
        statusCounts: {},
      };
      orderService.getOrderStats.mockResolvedValue(zeroStats);

      // Act
      const result = await controller.getStats();

      // Assert
      expect(result).toEqual(zeroStats);
      expect(orderService.getOrderStats).toHaveBeenCalledWith();
    });
  });
});
