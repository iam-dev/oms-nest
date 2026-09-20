import { Test, TestingModule } from "@nestjs/testing";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { OrderProductSaddleController } from "../../../src/order-product-saddles/order-product-saddle.controller";
import { OrderProductSaddleService } from "../../../src/order-product-saddles/order-product-saddle.service";
import { EnrichedOrdersService } from "../../../src/enriched-orders/enriched-orders.service";
import { CreateOrderProductSaddleDto } from "../../../src/order-product-saddles/dto/create-order-product-saddle.dto";
import { UpdateOrderProductSaddleDto } from "../../../src/order-product-saddles/dto/update-order-product-saddle.dto";
import { QueryOrderProductSaddleDto } from "../../../src/order-product-saddles/dto/query-order-product-saddle.dto";
import { OrderProductSaddleDto } from "../../../src/order-product-saddles/dto/order-product-saddle.dto";

describe("OrderProductSaddleController", () => {
  let controller: OrderProductSaddleController;
  let service: jest.Mocked<OrderProductSaddleService>;
  let orderAccess: {
    getFitterIdByUserId: jest.Mock;
    getOrderLockStates: jest.Mock;
  };

  const mockOrderProductSaddleDto: OrderProductSaddleDto = {
    id: 1,
    orderId: 1001,
    productId: 500,
    serial: "SN-2024-001",
    configuration: { color: "brown" } as Record<string, any>,
    quantity: 2,
    notes: "Special order",
    sequence: 1,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByOrderId: jest.fn(),
      findByProductId: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      countByOrderId: jest.fn(),
      getTotalQuantityByOrderId: jest.fn(),
      bulkCreate: jest.fn(),
    };

    orderAccess = {
      getFitterIdByUserId: jest.fn().mockResolvedValue(49),
      getOrderLockStates: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderProductSaddleController],
      providers: [
        { provide: OrderProductSaddleService, useValue: mockService },
        { provide: EnrichedOrdersService, useValue: orderAccess },
      ],
    }).compile();

    controller = module.get<OrderProductSaddleController>(
      OrderProductSaddleController,
    );
    service = module.get(OrderProductSaddleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new order-product-saddle relationship successfully", async () => {
      // Arrange
      const createDto: CreateOrderProductSaddleDto = {
        orderId: 1001,
        productId: 500,
        serial: "SN-2024-001",
        quantity: 2,
      };
      service.create.mockResolvedValue(mockOrderProductSaddleDto);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(mockOrderProductSaddleDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it("should handle validation error", async () => {
      // Arrange
      const createDto: CreateOrderProductSaddleDto = {
        productId: 500,
      } as CreateOrderProductSaddleDto;
      service.create.mockRejectedValue(
        new BadRequestException("Both orderId and productId are required"),
      );

      // Act & Assert
      await expect(controller.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("findAll", () => {
    it("should return all relationships with query filters", async () => {
      // Arrange
      const queryDto = new QueryOrderProductSaddleDto();
      queryDto.orderId = 1001;
      const relationships = [mockOrderProductSaddleDto];
      service.findAll.mockResolvedValue(relationships);

      // Act
      const result = await controller.findAll(queryDto);

      // Assert
      expect(result).toEqual(relationships);
      expect(service.findAll).toHaveBeenCalledWith(queryDto);
    });
  });

  describe("findByOrderId", () => {
    it("should return all products for a specific order", async () => {
      // Arrange
      const orderId = 1001;
      const products = [mockOrderProductSaddleDto];
      service.findByOrderId.mockResolvedValue(products);

      // Act
      const result = await controller.findByOrderId(orderId);

      // Assert
      expect(result).toEqual(products);
      expect(service.findByOrderId).toHaveBeenCalledWith(orderId);
    });
  });

  describe("getOrderProductCount", () => {
    it("should return count and total quantity for an order", async () => {
      // Arrange
      const orderId = 1001;
      service.countByOrderId.mockResolvedValue(3);
      service.getTotalQuantityByOrderId.mockResolvedValue(10);

      // Act
      const result = await controller.getOrderProductCount(orderId);

      // Assert
      expect(result).toEqual({
        count: 3,
        totalQuantity: 10,
      });
      expect(service.countByOrderId).toHaveBeenCalledWith(orderId);
      expect(service.getTotalQuantityByOrderId).toHaveBeenCalledWith(orderId);
    });

    it("should call both methods in parallel", async () => {
      // Arrange
      const orderId = 1001;
      service.countByOrderId.mockResolvedValue(0);
      service.getTotalQuantityByOrderId.mockResolvedValue(0);

      // Act
      await controller.getOrderProductCount(orderId);

      // Assert
      expect(service.countByOrderId).toHaveBeenCalledWith(orderId);
      expect(service.getTotalQuantityByOrderId).toHaveBeenCalledWith(orderId);
    });
  });

  describe("findByProductId", () => {
    it("should return all orders for a specific product", async () => {
      // Arrange
      const productId = 500;
      const orders = [mockOrderProductSaddleDto];
      service.findByProductId.mockResolvedValue(orders);

      // Act
      const result = await controller.findByProductId(productId);

      // Assert
      expect(result).toEqual(orders);
      expect(service.findByProductId).toHaveBeenCalledWith(productId);
    });
  });

  describe("findOne", () => {
    it("should return relationship by ID", async () => {
      // Arrange
      const id = 1;
      service.findOne.mockResolvedValue(mockOrderProductSaddleDto);

      // Act
      const result = await controller.findOne(id);

      // Assert
      expect(result).toEqual(mockOrderProductSaddleDto);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });

    it("should handle relationship not found", async () => {
      // Arrange
      const id = 999;
      service.findOne.mockRejectedValue(
        new NotFoundException("Order-product relationship not found"),
      );

      // Act & Assert
      await expect(controller.findOne(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update relationship successfully", async () => {
      // Arrange
      const id = 1;
      const updateDto: UpdateOrderProductSaddleDto = {
        quantity: 5,
        notes: "Updated notes",
      };
      const updatedRelationship = {
        ...mockOrderProductSaddleDto,
        ...updateDto,
      };
      service.update.mockResolvedValue(updatedRelationship);

      // Act
      const result = await controller.update(id, updateDto);

      // Assert
      expect(result).toEqual(updatedRelationship);
      expect(service.update).toHaveBeenCalledWith(id, updateDto);
    });

    it("should handle relationship not found during update", async () => {
      // Arrange
      const id = 999;
      const updateDto: UpdateOrderProductSaddleDto = { quantity: 5 };
      service.update.mockRejectedValue(
        new NotFoundException("Order-product relationship not found"),
      );

      // Act & Assert
      await expect(controller.update(id, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("remove", () => {
    it("should remove relationship successfully", async () => {
      // Arrange
      const id = 1;
      service.remove.mockResolvedValue();

      // Act
      await controller.remove(id);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(id);
      expect(service.remove).toHaveBeenCalledTimes(1);
    });

    it("should handle relationship not found during removal", async () => {
      // Arrange
      const id = 999;
      service.remove.mockRejectedValue(
        new NotFoundException("Order-product relationship not found"),
      );

      // Act & Assert
      await expect(controller.remove(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe("bulkCreate", () => {
    it("should bulk create multiple relationships", async () => {
      // Arrange
      const createDtos: CreateOrderProductSaddleDto[] = [
        {
          orderId: 1001,
          productId: 500,
          quantity: 1,
        },
        {
          orderId: 1001,
          productId: 501,
          quantity: 2,
        },
      ];
      const createdRelationships = [
        mockOrderProductSaddleDto,
        { ...mockOrderProductSaddleDto, id: 2, productId: 501 },
      ];
      service.bulkCreate.mockResolvedValue(createdRelationships);

      // Act
      const result = await controller.bulkCreate(createDtos);

      // Assert
      expect(result).toEqual(createdRelationships);
      expect(service.bulkCreate).toHaveBeenCalledWith(createDtos);
    });
  });

  describe("fitter lock", () => {
    const fitterReq = {
      user: { legacyId: 83, role: { id: 1, name: "fitter" } },
    };
    const adminReq = { user: { legacyId: 1, role: { id: 2, name: "admin" } } };
    const locked = new Map([
      [1001, { fitterId: 49, statusId: 13, statusName: "Inventory UK" }],
    ]);

    it("should create refuses a saddle on the fitter's own locked order", async () => {
      orderAccess.getOrderLockStates.mockResolvedValue(locked);

      await expect(
        controller.create({ orderId: 1001, productId: 500 } as any, fitterReq),
      ).rejects.toThrow(
        new ForbiddenException(
          "Fitters cannot edit orders with status: Inventory UK",
        ),
      );
      expect(service.create).not.toHaveBeenCalled();
    });

    it("should create hides another fitter's order behind a 404", async () => {
      orderAccess.getOrderLockStates.mockResolvedValue(
        new Map([
          [1001, { fitterId: 274, statusId: 1, statusName: "Ordered" }],
        ]),
      );

      await expect(
        controller.create({ orderId: 1001, productId: 500 } as any, fitterReq),
      ).rejects.toThrow(NotFoundException);
      expect(service.create).not.toHaveBeenCalled();
    });

    it("should create skips the lookup for admins", async () => {
      service.create.mockResolvedValue(mockOrderProductSaddleDto);

      await controller.create(
        { orderId: 1001, productId: 500 } as any,
        adminReq,
      );

      expect(orderAccess.getOrderLockStates).not.toHaveBeenCalled();
    });

    it("should bulkCreate checks every distinct order once", async () => {
      orderAccess.getOrderLockStates.mockResolvedValue(
        new Map([
          [1001, { fitterId: 49, statusId: 1, statusName: "Ordered" }],
          [1002, { fitterId: 49, statusId: 4, statusName: "On hold" }],
        ]),
      );

      await expect(
        controller.bulkCreate(
          [{ orderId: 1001 }, { orderId: 1002 }, { orderId: 1001 }] as any,
          fitterReq,
        ),
      ).rejects.toThrow("Fitters cannot edit orders with status: On hold");
      expect(orderAccess.getOrderLockStates).toHaveBeenCalledWith([1001, 1002]);
      expect(service.bulkCreate).not.toHaveBeenCalled();
    });

    it("should update resolves the row's order before applying the lock", async () => {
      service.findOne.mockResolvedValue(mockOrderProductSaddleDto);
      orderAccess.getOrderLockStates.mockResolvedValue(locked);

      await expect(
        controller.update(1, { quantity: 3 }, fitterReq),
      ).rejects.toThrow(ForbiddenException);
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(orderAccess.getOrderLockStates).toHaveBeenCalledWith([1001]);
      expect(service.update).not.toHaveBeenCalled();
    });

    it("should remove resolves the row's order before applying the lock", async () => {
      service.findOne.mockResolvedValue(mockOrderProductSaddleDto);
      orderAccess.getOrderLockStates.mockResolvedValue(locked);

      await expect(controller.remove(1, fitterReq)).rejects.toThrow(
        ForbiddenException,
      );
      expect(service.remove).not.toHaveBeenCalled();
    });

    it("should update does not look the row up for admins", async () => {
      service.update.mockResolvedValue(mockOrderProductSaddleDto);

      await controller.update(1, { quantity: 3 }, adminReq);

      expect(service.findOne).not.toHaveBeenCalled();
      expect(service.update).toHaveBeenCalledWith(1, { quantity: 3 });
    });
  });
});
