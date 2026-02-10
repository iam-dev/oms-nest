import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { SaddleStockService } from "../../../src/saddle-stock/saddle-stock.service";
import { createMockDataSource } from "../../unit/helpers/test-helpers";

describe("SaddleStockService", () => {
  let service: SaddleStockService;
  let dataSource: any;

  beforeEach(async () => {
    dataSource = createMockDataSource();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaddleStockService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<SaddleStockService>(SaddleStockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findFitterByUserId", () => {
    it("should return fitter id when found", async () => {
      // Arrange
      dataSource.query.mockResolvedValue([{ id: 42 }]);

      // Act
      const result = await service.findFitterByUserId(10);

      // Assert
      expect(result).toBe(42);
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM fitters"),
        [10],
      );
    });

    it("should return null when fitter not found", async () => {
      // Arrange
      dataSource.query.mockResolvedValue([]);

      // Act
      const result = await service.findFitterByUserId(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getSaddleStock", () => {
    const mockRow = {
      id: 1,
      serial_number: "SN-001",
      fitter_stock: true,
      demo: true,
      custom_order: false,
      order_status: 2,
      sponsored: true,
      order_time: 1700000000,
      created_at: "2023-11-15T10:00:00Z",
      saddle_brand: "TestBrand",
      saddle_model_name: "ModelX",
      leather_type_name: "Full Grain",
      fitter_id: 42,
      owner_name: "John Doe",
    };

    it("should return data without fitter filter for type=all", async () => {
      // Arrange
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }]) // count query
        .mockResolvedValueOnce([mockRow]); // data query

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      // Assert
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
      // For type=all, no fitterId lookup should happen (only 2 queries: count + data)
      expect(dataSource.query).toHaveBeenCalledTimes(2);
    });

    it("should filter by fitter_id for type=my", async () => {
      // Arrange
      dataSource.query
        .mockResolvedValueOnce([{ id: 42 }]) // findFitterByUserId
        .mockResolvedValueOnce([{ total: "1" }]) // count query
        .mockResolvedValueOnce([mockRow]); // data query

      // Act
      const result = await service.getSaddleStock("my", 10, 1, 30);

      // Assert
      expect(result.data).toHaveLength(1);
      // fitter lookup + count + data = 3 queries
      expect(dataSource.query).toHaveBeenCalledTimes(3);
      // The count and data queries should include fitter_id filter
      const countQuery = dataSource.query.mock.calls[1][0];
      expect(countQuery).toContain("fitter_id = $1");
      const dataQuery = dataSource.query.mock.calls[2][0];
      expect(dataQuery).toContain("fitter_id = $1");
    });

    it("should filter by fitter_id != for type=available", async () => {
      // Arrange
      dataSource.query
        .mockResolvedValueOnce([{ id: 42 }]) // findFitterByUserId
        .mockResolvedValueOnce([{ total: "1" }]) // count query
        .mockResolvedValueOnce([mockRow]); // data query

      // Act
      const result = await service.getSaddleStock("available", 10, 1, 30);

      // Assert
      expect(result.data).toHaveLength(1);
      const countQuery = dataSource.query.mock.calls[1][0];
      expect(countQuery).toContain("fitter_id != $1");
    });

    it("should add ILIKE conditions when search is provided", async () => {
      // Arrange
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }]) // count query
        .mockResolvedValueOnce([mockRow]); // data query

      // Act
      await service.getSaddleStock("all", 10, 1, 30, "test");

      // Assert
      const countQuery = dataSource.query.mock.calls[0][0];
      expect(countQuery).toContain("ILIKE");
      expect(countQuery).toContain("serial_number");
      expect(countQuery).toContain("brand");
      expect(countQuery).toContain("model_name");
      // The search param should be "%test%"
      const countParams = dataSource.query.mock.calls[0][1];
      expect(countParams).toContain("%test%");
    });

    it("should apply correct LIMIT and OFFSET for pagination", async () => {
      // Arrange
      dataSource.query
        .mockResolvedValueOnce([{ total: "50" }]) // count query
        .mockResolvedValueOnce([]); // data query

      // Act
      const result = await service.getSaddleStock("all", 10, 3, 15);

      // Assert
      expect(result.page).toBe(3);
      expect(result.pages).toBe(4); // ceil(50/15) = 4
      // Data query params should include limit and offset
      const dataParams = dataSource.query.mock.calls[1][1];
      expect(dataParams).toContain(15); // limit
      expect(dataParams).toContain(30); // offset = (3-1) * 15
    });

    it("should map timestamp from order_time (unix epoch)", async () => {
      // Arrange
      const rowWithOrderTime = {
        ...mockRow,
        order_time: 1700000000,
        created_at: null,
      };
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }])
        .mockResolvedValueOnce([rowWithOrderTime]);

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      // Assert
      const expected = new Date(1700000000 * 1000).toISOString();
      expect(result.data[0].createdAt).toBe(expected);
    });

    it("should map timestamp from created_at when order_time is absent", async () => {
      // Arrange
      const rowWithCreatedAt = {
        ...mockRow,
        order_time: null,
        created_at: "2023-11-15T10:00:00Z",
      };
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }])
        .mockResolvedValueOnce([rowWithCreatedAt]);

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      // Assert
      const expected = new Date("2023-11-15T10:00:00Z").toISOString();
      expect(result.data[0].createdAt).toBe(expected);
    });

    it("should fallback to current time when both order_time and created_at are absent", async () => {
      // Arrange
      const rowWithNoTime = {
        ...mockRow,
        order_time: null,
        created_at: null,
      };
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }])
        .mockResolvedValueOnce([rowWithNoTime]);

      const beforeTest = new Date();

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      const afterTest = new Date();

      // Assert
      const createdAtDate = new Date(result.data[0].createdAt);
      expect(createdAtDate.getTime()).toBeGreaterThanOrEqual(
        beforeTest.getTime() - 1000,
      );
      expect(createdAtDate.getTime()).toBeLessThanOrEqual(
        afterTest.getTime() + 1000,
      );
    });

    it("should map boolean fields correctly", async () => {
      // Arrange
      const rowWithBooleans = {
        ...mockRow,
        demo: true,
        custom_order: false,
        sponsored: true,
      };
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }])
        .mockResolvedValueOnce([rowWithBooleans]);

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      // Assert
      expect(result.data[0].demo).toBe(true);
      expect(result.data[0].customizableProduct).toBe(false);
      expect(result.data[0].sponsored).toBe(true);
    });

    it("should map boolean fields for falsy values", async () => {
      // Arrange
      const rowWithFalsyBooleans = {
        ...mockRow,
        demo: 0,
        custom_order: 0,
        sponsored: 0,
      };
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }])
        .mockResolvedValueOnce([rowWithFalsyBooleans]);

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      // Assert
      expect(result.data[0].demo).toBe(false);
      expect(result.data[0].customizableProduct).toBe(false);
      expect(result.data[0].sponsored).toBe(false);
    });

    it("should include stockOwner when fitter_id is present", async () => {
      // Arrange
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }])
        .mockResolvedValueOnce([mockRow]);

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      // Assert
      expect(result.data[0].stockOwner).toEqual({
        id: 42,
        name: "John Doe",
      });
    });

    it("should set stockOwner to undefined when fitter_id is absent", async () => {
      // Arrange
      const rowWithoutFitter = {
        ...mockRow,
        fitter_id: null,
        owner_name: null,
      };
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }])
        .mockResolvedValueOnce([rowWithoutFitter]);

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      // Assert
      expect(result.data[0].stockOwner).toBeUndefined();
    });

    it("should construct name from brand and model_name", async () => {
      // Arrange
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }])
        .mockResolvedValueOnce([mockRow]);

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      // Assert
      expect(result.data[0].name).toBe("TestBrand ModelX");
    });

    it("should handle missing brand in name construction", async () => {
      // Arrange
      const rowNoBrand = { ...mockRow, saddle_brand: null };
      dataSource.query
        .mockResolvedValueOnce([{ total: "1" }])
        .mockResolvedValueOnce([rowNoBrand]);

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      // Assert
      expect(result.data[0].name).toBe("ModelX");
    });

    it("should map productHasBeenOrdered based on order_status > 0", async () => {
      // Arrange
      const rowOrdered = { ...mockRow, order_status: 2 };
      const rowNotOrdered = { ...mockRow, order_status: 0 };
      dataSource.query
        .mockResolvedValueOnce([{ total: "2" }])
        .mockResolvedValueOnce([rowOrdered, rowNotOrdered]);

      // Act
      const result = await service.getSaddleStock("all", 10, 1, 30);

      // Assert
      expect(result.data[0].productHasBeenOrdered).toBe(true);
      expect(result.data[1].productHasBeenOrdered).toBe(false);
    });

    it("should throw on query failure", async () => {
      // Arrange
      dataSource.query.mockRejectedValue(new Error("DB connection failed"));

      // Act & Assert
      await expect(service.getSaddleStock("all", 10, 1, 30)).rejects.toThrow(
        "DB connection failed",
      );
    });
  });
});
