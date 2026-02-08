import { Test, TestingModule } from "@nestjs/testing";
import { HttpException, HttpStatus, ForbiddenException } from "@nestjs/common";
import { SaddleStockController } from "../../../src/saddle-stock/saddle-stock.controller";
import { SaddleStockService } from "../../../src/saddle-stock/saddle-stock.service";
import { RoleEnum } from "../../../src/roles/roles.enum";

describe("SaddleStockController", () => {
  let controller: SaddleStockController;
  let service: jest.Mocked<SaddleStockService>;

  const mockServiceResult = {
    data: [
      {
        id: 1,
        serial: "SN-001",
        name: "TestBrand ModelX",
        stock: 1,
        stockOwner: { id: 42, name: "John Doe" },
        model: { name: "ModelX" },
        leatherType: { name: "Full Grain" },
        demo: false,
        customizableProduct: false,
        productHasBeenOrdered: true,
        sponsored: false,
        createdAt: "2023-11-14T22:13:20.000Z",
      },
    ],
    total: 1,
    page: 1,
    pages: 1,
  };

  const createMockRequest = (userId?: number, roleId?: number) => ({
    user: userId
      ? {
          id: userId,
          role: roleId !== undefined ? { id: roleId } : undefined,
        }
      : undefined,
  });

  beforeEach(async () => {
    const mockService = {
      getSaddleStock: jest.fn(),
      findFitterByUserId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaddleStockController],
      providers: [{ provide: SaddleStockService, useValue: mockService }],
    }).compile();

    controller = module.get<SaddleStockController>(SaddleStockController);
    service = module.get(SaddleStockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getSaddleStock", () => {
    it("should return Hydra format response", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.fitter);
      const query = { type: "my" as const };
      service.getSaddleStock.mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getSaddleStock(query, req);

      // Assert
      expect(result["@context"]).toBe("/api/contexts/SaddleStock");
      expect(result["@type"]).toBe("hydra:Collection");
      expect(result["@id"]).toContain("/api/v1/saddle-stock");
      expect(result["hydra:member"]).toEqual(mockServiceResult.data);
      expect(result["hydra:totalItems"]).toBe(1);
      expect(result["hydra:view"]).toBeDefined();
    });

    it("should throw Unauthorized when no userId", async () => {
      // Arrange
      const req = { user: undefined };
      const query = { type: "my" as const };

      // Act & Assert
      await expect(controller.getSaddleStock(query, req)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getSaddleStock(query, req);
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        expect((e as HttpException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }
    });

    it("should throw ForbiddenException for non-fitter requesting 'my'", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.admin);
      const query = { type: "my" as const };

      // Act & Assert
      await expect(controller.getSaddleStock(query, req)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw ForbiddenException for non-fitter requesting 'available'", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.admin);
      const query = { type: "available" as const };

      // Act & Assert
      await expect(controller.getSaddleStock(query, req)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw ForbiddenException for non-admin requesting 'all'", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.fitter);
      const query = { type: "all" as const };

      // Act & Assert
      await expect(controller.getSaddleStock(query, req)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should allow fitter to request 'my'", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.fitter);
      const query = { type: "my" as const };
      service.getSaddleStock.mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getSaddleStock(query, req);

      // Assert
      expect(result["hydra:member"]).toBeDefined();
      expect(service.getSaddleStock).toHaveBeenCalledWith(
        "my",
        10,
        1,
        30,
        undefined,
      );
    });

    it("should allow admin to request 'all'", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.admin);
      const query = { type: "all" as const };
      service.getSaddleStock.mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getSaddleStock(query, req);

      // Assert
      expect(result["hydra:member"]).toBeDefined();
      expect(service.getSaddleStock).toHaveBeenCalledWith(
        "all",
        10,
        1,
        30,
        undefined,
      );
    });

    it("should allow supervisor to request 'all'", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.supervisor);
      const query = { type: "all" as const };
      service.getSaddleStock.mockResolvedValue(mockServiceResult);

      // Act
      const result = await controller.getSaddleStock(query, req);

      // Assert
      expect(result["hydra:member"]).toBeDefined();
      expect(service.getSaddleStock).toHaveBeenCalledWith(
        "all",
        10,
        1,
        30,
        undefined,
      );
    });

    it("should cap limit at 100", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.fitter);
      const query = { type: "my" as const, limit: 500 };
      service.getSaddleStock.mockResolvedValue(mockServiceResult);

      // Act
      await controller.getSaddleStock(query, req);

      // Assert
      expect(service.getSaddleStock).toHaveBeenCalledWith(
        "my",
        10,
        1,
        100,
        undefined,
      );
    });

    it("should default page to 1 and limit to 30", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.fitter);
      const query = { type: "my" as const };
      service.getSaddleStock.mockResolvedValue(mockServiceResult);

      // Act
      await controller.getSaddleStock(query, req);

      // Assert
      expect(service.getSaddleStock).toHaveBeenCalledWith(
        "my",
        10,
        1,
        30,
        undefined,
      );
    });

    it("should pass search parameter", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.fitter);
      const query = { type: "my" as const, search: "  test  " };
      service.getSaddleStock.mockResolvedValue(mockServiceResult);

      // Act
      await controller.getSaddleStock(query, req);

      // Assert
      expect(service.getSaddleStock).toHaveBeenCalledWith(
        "my",
        10,
        1,
        30,
        "test",
      );
    });

    it("should include hydra:next when not on last page", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.fitter);
      const query = { type: "my" as const };
      const multiPageResult = {
        ...mockServiceResult,
        page: 1,
        pages: 3,
        total: 90,
      };
      service.getSaddleStock.mockResolvedValue(multiPageResult);

      // Act
      const result = await controller.getSaddleStock(query, req);

      // Assert
      expect(result["hydra:view"]["hydra:next"]).toContain("page=2");
    });

    it("should include hydra:previous when not on first page", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.fitter);
      const query = { type: "my" as const, page: 2 };
      const multiPageResult = {
        ...mockServiceResult,
        page: 2,
        pages: 3,
        total: 90,
      };
      service.getSaddleStock.mockResolvedValue(multiPageResult);

      // Act
      const result = await controller.getSaddleStock(query, req);

      // Assert
      expect(result["hydra:view"]["hydra:previous"]).toContain("page=1");
    });

    it("should wrap non-HttpException errors in HttpException", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.fitter);
      const query = { type: "my" as const };
      service.getSaddleStock.mockRejectedValue(new Error("Unexpected error"));

      // Act & Assert
      await expect(controller.getSaddleStock(query, req)).rejects.toThrow(
        HttpException,
      );

      try {
        await controller.getSaddleStock(query, req);
      } catch (e) {
        expect((e as HttpException).getStatus()).toBe(
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });

    it("should re-throw HttpExceptions without wrapping", async () => {
      // Arrange
      const req = createMockRequest(10, RoleEnum.fitter);
      const query = { type: "my" as const };
      const forbidden = new ForbiddenException("Custom forbidden");
      service.getSaddleStock.mockRejectedValue(forbidden);

      // Act & Assert
      await expect(controller.getSaddleStock(query, req)).rejects.toThrow(
        ForbiddenException,
      );

      try {
        await controller.getSaddleStock(query, req);
      } catch (e) {
        expect((e as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect((e as HttpException).message).toBe("Custom forbidden");
      }
    });
  });
});
