import { Test, TestingModule } from "@nestjs/testing";
import {
  HttpException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { EnrichedOrdersController } from "../../../src/enriched-orders/enriched-orders.controller";
import { EnrichedOrdersService } from "../../../src/enriched-orders/enriched-orders.service";

describe("EnrichedOrdersController", () => {
  let controller: EnrichedOrdersController;
  let service: jest.Mocked<EnrichedOrdersService>;

  const mockEnrichedOrder = {
    id: 1,
    orderNumber: "ORD-001",
    customerName: "John Doe",
    brandName: "Premium Brand",
    modelName: "Classic Model",
    urgency: "urgent",
    status: "pending",
  };

  const mockServiceResponse = {
    data: [mockEnrichedOrder],
    pagination: {
      currentPage: 1,
      totalPages: 5,
      totalItems: 100,
      itemsPerPage: 50,
      hasNext: true,
      hasPrevious: false,
    },
    metadata: {
      queriedAt: new Date().toISOString(),
      cached: false,
      processingTimeMs: 50,
    },
  };

  beforeEach(async () => {
    const mockService = {
      getEnrichedOrders: jest.fn(),
      getOrderDetail: jest.fn(),
      updateOrder: jest.fn(),
      getFitterIdByUserId: jest.fn(),
      getOrderFitterIds: jest.fn(),
      getOrderLockStates: jest.fn(),
      createOrder: jest.fn(),
      getEditFormOptions: jest.fn(),
      updateOrderStatus: jest.fn(),
      bulkUpdateOrderStatus: jest.fn(),
      createDraftFromOrder: jest.fn(),
      bulkCreateDraftFromOrder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EnrichedOrdersController],
      providers: [
        {
          provide: EnrichedOrdersService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<EnrichedOrdersController>(EnrichedOrdersController);
    service = module.get(EnrichedOrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getEnrichedOrders", () => {
    it("should return enriched orders in standard pagination format", async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 50,
      };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act
      const result = await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(result).toMatchObject({
        data: [mockEnrichedOrder],
        total: 100,
        pages: 5,
        page: 1,
        limit: 50,
        hasNext: true,
        hasPrev: false,
      });
    });

    it("should sanitize query parameters", async () => {
      // Arrange
      const query = {
        page: "2",
        limit: "150",
        partial: "true",
        searchTerm: "  test  ",
      };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act
      await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 100,
          partial: true,
          searchTerm: "test",
        }),
      );
    });

    it("should limit maximum page size to 100", async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 500,
      };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act
      await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        }),
      );
    });

    it("should use default pagination values", async () => {
      // Arrange
      const query = {};

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act
      await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 50,
          orderDirection: "DESC",
        }),
      );
    });

    it("should sanitize order by column", async () => {
      // Arrange
      const query = {
        orderBy: "created_at",
      };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act
      await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: "created_at",
        }),
      );
    });

    it("should reject invalid order by column", async () => {
      // Arrange
      const query = {
        orderBy: "invalid_column; DROP TABLE orders;",
      };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act
      await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: undefined,
        }),
      );
    });

    it("should handle multiple filter parameters", async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 20,
        urgency: "urgent",
        fitterId: "5",
        customerId: "10",
        brandId: "3",
        status: "pending",
      };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act
      await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          urgency: "urgent",
          fitterId: 5,
          customerId: 10,
          brandId: 3,
          status: "pending",
        }),
      );
    });

    it("should set hasPrev to true when not on first page", async () => {
      // Arrange
      const query = {
        page: 2,
      };

      const response = {
        ...mockServiceResponse,
        pagination: {
          ...mockServiceResponse.pagination,
          currentPage: 2,
          hasPrevious: true,
        },
      };

      service.getEnrichedOrders.mockResolvedValue(response);

      // Act
      const result = await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(result.hasPrev).toBe(true);
    });

    it("should set hasNext to false on last page", async () => {
      // Arrange
      const query = {
        page: 5,
      };

      const response = {
        ...mockServiceResponse,
        pagination: {
          ...mockServiceResponse.pagination,
          currentPage: 5,
          hasNext: false,
        },
      };

      service.getEnrichedOrders.mockResolvedValue(response);

      // Act
      const result = await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(result.hasNext).toBe(false);
    });

    it("should throw HttpException on service error", async () => {
      // Arrange
      const query = {};
      service.getEnrichedOrders.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(
        controller.getEnrichedOrders(query as any, {
          user: { legacyId: 1, role: { id: 2, name: "admin" } },
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe("getOrderDetail", () => {
    it("should return order detail", async () => {
      // Arrange
      service.getOrderDetail.mockResolvedValue(mockEnrichedOrder);

      // Act
      const result = await controller.getOrderDetail(1);

      // Assert
      expect(result).toEqual(mockEnrichedOrder);
      expect(service.getOrderDetail).toHaveBeenCalledWith(1);
    });

    it("should throw NotFoundException when order not found", async () => {
      // Arrange
      service.getOrderDetail.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getOrderDetail(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should propagate service errors as HttpException", async () => {
      // Arrange
      service.getOrderDetail.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(controller.getOrderDetail(1)).rejects.toThrow(HttpException);
    });
  });

  describe("getHealth", () => {
    it("should return health status", async () => {
      // Arrange

      // Act
      const result = await controller.getHealth();

      // Assert
      expect(result).toMatchObject({
        status: "healthy",
        service: "enriched-orders",
        version: "1.0.0",
      });
      expect(result.timestamp).toBeDefined();
    });
  });

  describe("updateOrder", () => {
    it("should pass user legacyId and role id to service", async () => {
      // Arrange
      const body = { specialNotes: "Updated" };
      const req = { user: { legacyId: 42, role: { id: 1 } } };
      service.updateOrder.mockResolvedValue({ success: true, orderId: 1 });

      // Act
      const result = await controller.updateOrder(1, body, req);

      // Assert
      expect(service.updateOrder).toHaveBeenCalledWith(
        1,
        body,
        42,
        1,
        undefined,
      );
      expect(result).toEqual({ success: true, orderId: 1 });
    });

    it("should pass undefined role when user has no role", async () => {
      // Arrange
      const body = { specialNotes: "Updated" };
      const req = { user: { legacyId: 42 } };
      service.updateOrder.mockResolvedValue({ success: true, orderId: 1 });

      // Act
      await controller.updateOrder(1, body, req);

      // Assert
      expect(service.updateOrder).toHaveBeenCalledWith(
        1,
        body,
        42,
        undefined,
        undefined,
      );
    });

    it("should propagate ForbiddenException from service", async () => {
      // Arrange
      const body = { specialNotes: "Updated" };
      const req = { user: { legacyId: 42, role: { id: 1 } } };
      service.updateOrder.mockRejectedValue(
        new ForbiddenException(
          "Fitters cannot edit orders with status: Approved",
        ),
      );

      // Act & Assert
      await expect(controller.updateOrder(1, body, req)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should wrap generic errors as HttpException", async () => {
      // Arrange
      const body = { specialNotes: "Updated" };
      const req = { user: { legacyId: 42, role: { id: 2 } } };
      service.updateOrder.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(controller.updateOrder(1, body, req)).rejects.toThrow(
        HttpException,
      );
    });

    it("should propagate NotFoundException from service", async () => {
      // Arrange
      const body = { specialNotes: "Updated" };
      const req = { user: { legacyId: 42, role: { id: 2 } } };
      service.updateOrder.mockRejectedValue(
        new NotFoundException("Order not found"),
      );

      // Act & Assert
      await expect(controller.updateOrder(1, body, req)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("sanitizeQuery (private method via getEnrichedOrders)", () => {
    it("should parse positive integers correctly", async () => {
      // Arrange
      const query = {
        id: "123",
        orderId: "456",
        fitterId: "789",
      };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act
      await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 123,
          orderId: 456,
          fitterId: 789,
        }),
      );
    });

    it("should handle invalid positive integers", async () => {
      // Arrange
      const query = {
        fitterId: "invalid",
        customerId: "-5",
      };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act
      await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          fitterId: undefined,
          customerId: undefined,
        }),
      );
    });

    it("should trim string filters", async () => {
      // Arrange
      const query = {
        customerName: "  John Doe  ",
        fitterName: "  Jane Smith  ",
        search: "  test search  ",
      };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act
      await controller.getEnrichedOrders(query as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });

      // Assert
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: "John Doe",
          fitterName: "Jane Smith",
          search: "test search",
        }),
      );
    });

    it("should handle boolean partial field", async () => {
      // Arrange
      const query1 = { partial: "true" };
      const query2 = { partial: true };
      const query3 = { partial: "false" };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act & Assert
      await controller.getEnrichedOrders(query1 as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({ partial: true }),
      );

      await controller.getEnrichedOrders(query2 as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({ partial: true }),
      );

      await controller.getEnrichedOrders(query3 as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({ partial: false }),
      );
    });

    it("should sanitize order direction", async () => {
      // Arrange
      const query1 = { orderDirection: "ASC" };
      const query2 = { orderDirection: "DESC" };
      const query3 = { orderDirection: "INVALID" };

      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Act & Assert
      await controller.getEnrichedOrders(query1 as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({ orderDirection: "ASC" }),
      );

      await controller.getEnrichedOrders(query2 as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({ orderDirection: "DESC" }),
      );

      await controller.getEnrichedOrders(query3 as any, {
        user: { legacyId: 1, role: { id: 2, name: "admin" } },
      });
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({ orderDirection: "DESC" }),
      );
    });
  });

  describe("fitter auto-filtering", () => {
    const fitterReq = {
      user: { legacyId: 42, role: { id: 1, name: "fitter" } },
    };
    const adminReq = {
      user: { legacyId: 1, role: { id: 2, name: "admin" } },
    };
    const supervisorReq = {
      user: { legacyId: 5, role: { id: 5, name: "supervisor" } },
    };

    it("should auto-inject fitterId when user is a fitter", async () => {
      service.getFitterIdByUserId.mockResolvedValue(99);
      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      await controller.getEnrichedOrders({} as any, fitterReq);

      expect(service.getFitterIdByUserId).toHaveBeenCalledWith(42);
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({ fitterId: 99 }),
      );
    });

    it("should NOT inject fitterId for admin users", async () => {
      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      await controller.getEnrichedOrders({} as any, adminReq);

      expect(service.getFitterIdByUserId).not.toHaveBeenCalled();
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.not.objectContaining({ fitterId: expect.anything() }),
      );
    });

    it("should NOT inject fitterId for supervisor users", async () => {
      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      await controller.getEnrichedOrders({} as any, supervisorReq);

      expect(service.getFitterIdByUserId).not.toHaveBeenCalled();
    });

    it("should handle fitter with no matching fitter record gracefully", async () => {
      service.getFitterIdByUserId.mockResolvedValue(null);
      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      await controller.getEnrichedOrders({} as any, fitterReq);

      expect(service.getFitterIdByUserId).toHaveBeenCalledWith(42);
      // fitterId should NOT be set since lookup returned null
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.not.objectContaining({ fitterId: expect.anything() }),
      );
    });

    it("should handle fitter user without legacyId", async () => {
      const noLegacyReq = {
        user: { role: { id: 1, name: "fitter" } },
      };
      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      await controller.getEnrichedOrders({} as any, noLegacyReq);

      expect(service.getFitterIdByUserId).not.toHaveBeenCalled();
    });

    it("should override user-supplied fitterId for fitter users", async () => {
      service.getFitterIdByUserId.mockResolvedValue(99);
      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      // Fitter tries to pass a different fitterId to see other fitter's orders
      await controller.getEnrichedOrders({ fitterId: 999 } as any, fitterReq);

      // Should be overridden with their actual fitter ID
      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({ fitterId: 99 }),
      );
    });

    it("should preserve other query params when injecting fitterId", async () => {
      service.getFitterIdByUserId.mockResolvedValue(99);
      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      await controller.getEnrichedOrders(
        { page: 2, limit: 25, orderStatus: "Approved" } as any,
        fitterReq,
      );

      expect(service.getEnrichedOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          fitterId: 99,
          page: 2,
          limit: 25,
          orderStatus: "Approved",
        }),
      );
    });

    it("should handle missing user in request", async () => {
      service.getEnrichedOrders.mockResolvedValue(mockServiceResponse);

      await controller.getEnrichedOrders({} as any, {});

      expect(service.getFitterIdByUserId).not.toHaveBeenCalled();
    });
  });

  describe("fitter scoping", () => {
    const fitterReq = {
      user: { legacyId: 83, role: { id: 1, name: "fitter" } },
    };
    const adminReq = {
      user: { legacyId: 138, role: { id: 5, name: "supervisor" } },
    };

    beforeEach(() => {
      service.getFitterIdByUserId.mockResolvedValue(49);
    });

    it("should getOrderDetail hides another fitter's order behind a 404", async () => {
      service.getOrderDetail.mockResolvedValue({ id: 53810, fitterId: 274 });

      await expect(controller.getOrderDetail(53810, fitterReq)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should getOrderDetail returns the fitter's own order", async () => {
      const own = { id: 51133, fitterId: 49 };
      service.getOrderDetail.mockResolvedValue(own);

      await expect(controller.getOrderDetail(51133, fitterReq)).resolves.toBe(
        own,
      );
    });

    it("should getOrderDetail returns any order for admins without a fitter lookup", async () => {
      const other = { id: 53810, fitterId: 274 };
      service.getOrderDetail.mockResolvedValue(other);

      await expect(controller.getOrderDetail(53810, adminReq)).resolves.toBe(
        other,
      );
      expect(service.getFitterIdByUserId).not.toHaveBeenCalled();
    });

    it("should createOrder files the order under the fitter's own id whatever the client sent", async () => {
      service.createOrder.mockResolvedValue({ success: true, orderId: 1 });

      await controller.createOrder({ fitterId: 274, saddleId: 5 }, fitterReq);

      expect(service.createOrder).toHaveBeenCalledWith(
        { fitterId: 49, saddleId: 5 },
        83,
      );
    });

    it("should createOrder keeps the admin's chosen fitter", async () => {
      service.createOrder.mockResolvedValue({ success: true, orderId: 1 });

      await controller.createOrder({ fitterId: 274 }, adminReq);

      expect(service.createOrder).toHaveBeenCalledWith({ fitterId: 274 }, 138);
    });

    it("should updateOrder forces the fitter's own id and scopes the service call", async () => {
      service.getOrderLockStates.mockResolvedValue(
        new Map([[1, { fitterId: 49, statusId: 1, statusName: "Ordered" }]]),
      );
      service.updateOrder.mockResolvedValue({ success: true, orderId: 1 });

      await controller.updateOrder(
        1,
        { fitterId: 274, specialNotes: "n" },
        fitterReq,
      );

      expect(service.updateOrder).toHaveBeenCalledWith(
        1,
        { fitterId: 49, specialNotes: "n" },
        83,
        1,
        49,
      );
    });

    it("should updateOrder passes no scope for admins", async () => {
      service.updateOrder.mockResolvedValue({ success: true, orderId: 1 });

      await controller.updateOrder(1, { fitterId: 274 }, adminReq);

      expect(service.updateOrder).toHaveBeenCalledWith(
        1,
        { fitterId: 274 },
        138,
        5,
        undefined,
      );
    });

    it("should getEditFormOptions offers a fitter only themselves and names the current fitter", async () => {
      service.getEditFormOptions.mockResolvedValue({
        fitters: [{ id: 49 }, { id: 274 }],
        saddles: [],
      });

      const result = await controller.getEditFormOptions(
        undefined,
        undefined,
        fitterReq,
      );

      expect(result.fitters).toEqual([{ id: 49 }]);
      expect(result.currentFitterId).toBe(49);
    });

    it("should getEditFormOptions leaves the fitter list alone for admins", async () => {
      const opts = { fitters: [{ id: 49 }, { id: 274 }], saddles: [] };
      service.getEditFormOptions.mockResolvedValue(opts);

      const result = await controller.getEditFormOptions(
        undefined,
        undefined,
        adminReq,
      );

      expect(result.fitters).toEqual(opts.fitters);
      expect(result.currentFitterId).toBeUndefined();
    });

    const lockState = (
      fitterId: number,
      statusId: number,
      statusName: string,
    ) => ({ fitterId, statusId, statusName }) as const;

    it("should updateOrderStatus refuses another fitter's order", async () => {
      service.getOrderLockStates.mockResolvedValue(
        new Map([[53810, lockState(274, 1, "Ordered")]]),
      );

      await expect(
        controller.updateOrderStatus(53810, { status: "Ordered" }, fitterReq),
      ).rejects.toThrow(NotFoundException);
      expect(service.updateOrderStatus).not.toHaveBeenCalled();
    });

    it("should updateOrderStatus refuses the fitter's own order once it is locked", async () => {
      service.getOrderLockStates.mockResolvedValue(
        new Map([[51133, lockState(49, 4, "On hold")]]),
      );

      await expect(
        controller.updateOrderStatus(51133, { status: "Ordered" }, fitterReq),
      ).rejects.toThrow(
        new ForbiddenException(
          "Fitters cannot edit orders with status: On hold",
        ),
      );
      expect(service.updateOrderStatus).not.toHaveBeenCalled();
    });

    it("should updateOrderStatus proceeds on the fitter's own pre-approval order", async () => {
      service.getOrderLockStates.mockResolvedValue(
        new Map([[51133, lockState(49, 1, "Ordered")]]),
      );
      service.updateOrderStatus.mockResolvedValue({
        success: true,
        orderId: 51133,
        status: "Approved",
        statusId: 2,
      });

      await controller.updateOrderStatus(
        51133,
        { status: "Approved" },
        fitterReq,
      );

      expect(service.updateOrderStatus).toHaveBeenCalledWith(
        51133,
        "Approved",
        83,
      );
    });

    it("should updateOrder refuses the fitter's own locked order before touching the service", async () => {
      service.getOrderLockStates.mockResolvedValue(
        new Map([[51133, lockState(49, 12, "Inventory Aiken")]]),
      );

      await expect(
        controller.updateOrder(51133, { specialNotes: "x" }, fitterReq),
      ).rejects.toThrow(
        new ForbiddenException(
          "Fitters cannot edit orders with status: Inventory Aiken",
        ),
      );
      expect(service.updateOrder).not.toHaveBeenCalled();
    });

    it("should createDraftFromOrder refuses another fitter's order", async () => {
      service.getOrderFitterIds.mockResolvedValue(new Map([[53810, 274]]));

      await expect(
        controller.createDraftFromOrder(53810, fitterReq),
      ).rejects.toThrow(NotFoundException);
      expect(service.createDraftFromOrder).not.toHaveBeenCalled();
    });

    it("should bulkCreateDraftFromOrder refuses another fitter's order", async () => {
      service.getOrderFitterIds.mockResolvedValue(new Map([[53810, 274]]));

      await expect(
        controller.bulkCreateDraftFromOrder(53810, { count: 2 }, fitterReq),
      ).rejects.toThrow(NotFoundException);
      expect(service.bulkCreateDraftFromOrder).not.toHaveBeenCalled();
    });

    it("should bulkUpdateOrderStatus refuses when any order belongs to another fitter", async () => {
      service.getOrderLockStates.mockResolvedValue(
        new Map([
          [1, lockState(49, 1, "Ordered")],
          [2, lockState(274, 1, "Ordered")],
        ]),
      );

      await expect(
        controller.bulkUpdateOrderStatus(
          { orderIds: [1, 2], status: "Ordered" },
          fitterReq,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(service.bulkUpdateOrderStatus).not.toHaveBeenCalled();
    });

    it("should bulkUpdateOrderStatus refuses when any own order is locked", async () => {
      service.getOrderLockStates.mockResolvedValue(
        new Map([
          [1, lockState(49, 1, "Ordered")],
          [2, lockState(49, 6, "On trial")],
        ]),
      );

      await expect(
        controller.bulkUpdateOrderStatus(
          { orderIds: [1, 2], status: "Ordered" },
          fitterReq,
        ),
      ).rejects.toThrow("Fitters cannot edit orders with status: On trial");
      expect(service.bulkUpdateOrderStatus).not.toHaveBeenCalled();
    });

    it("should bulkUpdateOrderStatus proceeds when every order is the fitter's own and open", async () => {
      service.getOrderLockStates.mockResolvedValue(
        new Map([
          [1, lockState(49, 1, "Ordered")],
          [2, lockState(49, 15, "Awaiting Client Confirmation")],
        ]),
      );
      service.bulkUpdateOrderStatus.mockResolvedValue({
        success: true,
        updated: 2,
        failed: 0,
        results: [],
      });

      await controller.bulkUpdateOrderStatus(
        { orderIds: [1, 2], status: "Ordered" },
        fitterReq,
      );

      expect(service.bulkUpdateOrderStatus).toHaveBeenCalledWith(
        [1, 2],
        "Ordered",
        83,
      );
    });

    it("should status and draft endpoints skip the ownership lookup for admins", async () => {
      service.updateOrderStatus.mockResolvedValue({
        success: true,
        orderId: 53810,
        status: "Ordered",
        statusId: 1,
      });

      await controller.updateOrderStatus(
        53810,
        { status: "Ordered" },
        adminReq,
      );

      expect(service.getOrderFitterIds).not.toHaveBeenCalled();
      expect(service.getOrderLockStates).not.toHaveBeenCalled();
    });
  });
});
