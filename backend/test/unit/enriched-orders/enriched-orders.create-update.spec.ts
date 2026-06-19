import { Test, TestingModule } from "@nestjs/testing";
import { HttpException, NotFoundException } from "@nestjs/common";
import { EnrichedOrdersController } from "../../../src/enriched-orders/enriched-orders.controller";
import { EnrichedOrdersService } from "../../../src/enriched-orders/enriched-orders.service";

describe("EnrichedOrdersController - Create & Update endpoints", () => {
  let controller: EnrichedOrdersController;
  let service: jest.Mocked<EnrichedOrdersService>;

  beforeEach(async () => {
    const mockService = {
      getEnrichedOrders: jest.fn(),
      getOrderDetail: jest.fn(),
      updateOrder: jest.fn(),
      createOrder: jest.fn(),
      updateOrderStatus: jest.fn(),
      bulkUpdateOrderStatus: jest.fn(),
      getEditFormOptions: jest.fn(),
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

  describe("createOrder", () => {
    it("should create an order and pass userId from req.user", async () => {
      const body = { specialNotes: "New order", fitterId: 5 };
      const req = { user: { legacyId: 42 } };
      service.createOrder.mockResolvedValue({ success: true, orderId: 999 });

      const result = await controller.createOrder(body, req);

      expect(service.createOrder).toHaveBeenCalledWith(body, 42);
      expect(result).toEqual({ success: true, orderId: 999 });
    });

    it("should pass undefined userId when req.user is missing", async () => {
      const body = { specialNotes: "New order" };
      const req = {};
      service.createOrder.mockResolvedValue({ success: true, orderId: 1000 });

      await controller.createOrder(body, req);

      expect(service.createOrder).toHaveBeenCalledWith(body, undefined);
    });

    it("should wrap generic errors as HttpException", async () => {
      const body = { specialNotes: "New order" };
      const req = { user: { legacyId: 1 } };
      service.createOrder.mockRejectedValue(new Error("Database error"));

      await expect(controller.createOrder(body, req)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe("updateOrderStatus", () => {
    it("should update order status successfully", async () => {
      const body = { status: "Approved" };
      service.updateOrderStatus.mockResolvedValue({
        success: true,
        orderId: 100,
        status: "Approved",
        statusId: 2,
      });

      const result = await controller.updateOrderStatus(100, body);

      expect(service.updateOrderStatus).toHaveBeenCalledWith(100, "Approved");
      expect(result).toEqual({
        success: true,
        orderId: 100,
        status: "Approved",
        statusId: 2,
      });
    });

    it("should propagate NotFoundException from service", async () => {
      const body = { status: "Approved" };
      service.updateOrderStatus.mockRejectedValue(
        new NotFoundException("Order not found"),
      );

      await expect(controller.updateOrderStatus(999, body)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should wrap generic errors as HttpException", async () => {
      const body = { status: "Approved" };
      service.updateOrderStatus.mockRejectedValue(new Error("Database error"));

      await expect(controller.updateOrderStatus(100, body)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe("bulkUpdateOrderStatus", () => {
    it("should bulk update order statuses successfully", async () => {
      const body = { orderIds: [1, 2, 3], status: "Approved" };
      const mockResult = {
        success: true,
        updated: 3,
        failed: 0,
        results: [
          { orderId: 1, success: true },
          { orderId: 2, success: true },
          { orderId: 3, success: true },
        ],
      };
      service.bulkUpdateOrderStatus.mockResolvedValue(mockResult);

      const result = await controller.bulkUpdateOrderStatus(body);

      expect(service.bulkUpdateOrderStatus).toHaveBeenCalledWith(
        [1, 2, 3],
        "Approved",
      );
      expect(result).toEqual(mockResult);
    });

    it("should reject empty orderIds array", async () => {
      const body = { orderIds: [], status: "Approved" };

      await expect(controller.bulkUpdateOrderStatus(body)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.bulkUpdateOrderStatus(body);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(400);
      }
    });

    it("should reject non-array orderIds", async () => {
      const body = { orderIds: null as any, status: "Approved" };

      await expect(controller.bulkUpdateOrderStatus(body)).rejects.toThrow(
        HttpException,
      );
    });

    it("should reject more than 100 orderIds", async () => {
      const orderIds = Array.from({ length: 101 }, (_, i) => i + 1);
      const body = { orderIds, status: "Approved" };

      await expect(controller.bulkUpdateOrderStatus(body)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.bulkUpdateOrderStatus(body);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(400);
      }
    });

    it("should wrap generic errors as HttpException", async () => {
      const body = { orderIds: [1, 2], status: "Approved" };
      service.bulkUpdateOrderStatus.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(controller.bulkUpdateOrderStatus(body)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe("getEditFormOptions", () => {
    const mockOptions = {
      fitters: [{ id: 1, username: "fitter1", fullName: "Test Fitter" }],
      saddles: [{ id: 1, brand: "Brand", modelName: "Model" }],
      leatherTypes: [{ id: 1, name: "Leather" }],
      options: [{ optionId: 1, optionName: "Size" }],
      optionItems: [{ id: 1, name: "Small", optionId: 1 }],
      statuses: [{ id: 1, name: "Unordered" }],
    };

    it("should return edit form options without saddleId", async () => {
      service.getEditFormOptions.mockResolvedValue(mockOptions);

      const result = await controller.getEditFormOptions();

      expect(service.getEditFormOptions).toHaveBeenCalledWith(undefined, false);
      expect(result).toEqual(mockOptions);
    });

    it("should return edit form options with valid saddleId", async () => {
      service.getEditFormOptions.mockResolvedValue(mockOptions);

      const result = await controller.getEditFormOptions("5");

      expect(service.getEditFormOptions).toHaveBeenCalledWith(5, false);
      expect(result).toEqual(mockOptions);
    });

    it("should pass undefined for invalid saddleId string", async () => {
      service.getEditFormOptions.mockResolvedValue(mockOptions);

      await controller.getEditFormOptions("abc");

      expect(service.getEditFormOptions).toHaveBeenCalledWith(undefined, false);
    });

    it("should pass includeDiscontinued=true through to the service", async () => {
      service.getEditFormOptions.mockResolvedValue(mockOptions);

      await controller.getEditFormOptions(undefined, "true");

      expect(service.getEditFormOptions).toHaveBeenCalledWith(undefined, true);
    });

    it("should treat includeDiscontinued values other than 'true' as false", async () => {
      service.getEditFormOptions.mockResolvedValue(mockOptions);

      await controller.getEditFormOptions("5", "yes");

      expect(service.getEditFormOptions).toHaveBeenCalledWith(5, false);
    });

    it("should wrap errors as HttpException", async () => {
      service.getEditFormOptions.mockRejectedValue(new Error("Database error"));

      await expect(controller.getEditFormOptions()).rejects.toThrow(
        HttpException,
      );
    });
  });
});
