import { Test, TestingModule } from "@nestjs/testing";
import { WarehouseController } from "../../../src/warehouses/warehouse.controller";
import { WarehouseService } from "../../../src/warehouses/warehouse.service";
import { WarehouseEntity } from "../../../src/warehouses/infrastructure/persistence/relational/entities/warehouse.entity";
import { CreateWarehouseDto } from "../../../src/warehouses/dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "../../../src/warehouses/dto/update-warehouse.dto";
import { QueryWarehouseDto } from "../../../src/warehouses/dto/query-warehouse.dto";

describe("WarehouseController", () => {
  let controller: WarehouseController;
  let service: jest.Mocked<WarehouseService>;

  const mockWarehouse = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Main Warehouse",
    code: "WH001",
    address: "123 Storage St",
    city: "London",
    country: "United Kingdom",
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    deletedAt: null,
  } as WarehouseEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WarehouseController],
      providers: [
        {
          provide: WarehouseService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            restore: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WarehouseController>(WarehouseController);
    service = module.get(WarehouseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should create a new warehouse", async () => {
      // Arrange
      const createDto: CreateWarehouseDto = {
        name: "Main Warehouse",
        code: "WH001",
        city: "London",
        country: "United Kingdom",
      };
      service.create.mockResolvedValue(mockWarehouse as WarehouseEntity);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockWarehouse);
    });
  });

  describe("findAll", () => {
    it("should return paginated warehouses", async () => {
      // Arrange
      const query: QueryWarehouseDto = {};
      const paginatedResult = {
        data: [mockWarehouse],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(paginatedResult);
      expect(result.data).toHaveLength(1);
    });

    it("should filter by name", async () => {
      // Arrange
      const query: QueryWarehouseDto = { name: "Main" };
      const paginatedResult = {
        data: [mockWarehouse],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
    });

    it("should filter by city and country", async () => {
      // Arrange
      const query: QueryWarehouseDto = {
        city: "London",
        country: "United Kingdom",
      };
      const paginatedResult = {
        data: [mockWarehouse],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
    });

    it("should filter by active status", async () => {
      // Arrange
      const query: QueryWarehouseDto = { is_active: true };
      const paginatedResult = {
        data: [mockWarehouse],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      await controller.findAll(query);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it("should return empty array when no warehouses found", async () => {
      // Arrange
      const query: QueryWarehouseDto = {};
      const paginatedResult = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll(query);

      // Assert
      expect(result.data).toEqual([]);
    });
  });

  describe("findOne", () => {
    it("should return a warehouse by id", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440000";
      service.findOne.mockResolvedValue(mockWarehouse as WarehouseEntity);

      // Act
      const result = await controller.findOne(id);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(mockWarehouse);
    });
  });

  describe("update", () => {
    it("should update a warehouse", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440000";
      const updateDto: UpdateWarehouseDto = {
        name: "Updated Warehouse",
        city: "Manchester",
      };
      const updatedWarehouse = {
        ...mockWarehouse,
        name: "Updated Warehouse",
        city: "Manchester",
      };
      service.update.mockResolvedValue(updatedWarehouse as WarehouseEntity);

      // Act
      const result = await controller.update(id, updateDto);

      // Assert
      expect(service.update).toHaveBeenCalledWith(id, updateDto);
      expect(result.name).toBe("Updated Warehouse");
      expect(result.city).toBe("Manchester");
    });

    it("should update only provided fields", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440000";
      const updateDto: UpdateWarehouseDto = { is_active: false };
      const updatedWarehouse = { ...mockWarehouse, isActive: false };
      service.update.mockResolvedValue(updatedWarehouse as WarehouseEntity);

      // Act
      const result = await controller.update(id, updateDto);

      // Assert
      expect(result.isActive).toBe(false);
      expect(result.name).toBe("Main Warehouse");
    });
  });

  describe("remove", () => {
    it("should soft delete a warehouse", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440000";
      service.remove.mockResolvedValue(undefined);

      // Act
      await controller.remove(id);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(id);
    });
  });

  describe("restore", () => {
    it("should restore a soft-deleted warehouse", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440000";
      service.restore.mockResolvedValue(mockWarehouse as WarehouseEntity);

      // Act
      const result = await controller.restore(id);

      // Assert
      expect(service.restore).toHaveBeenCalledWith(id);
      expect(result).toEqual(mockWarehouse);
    });
  });
});
