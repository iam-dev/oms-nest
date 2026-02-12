import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { WarehouseService } from "../../../src/warehouses/warehouse.service";
import { WarehouseEntity } from "../../../src/warehouses/infrastructure/persistence/relational/entities/warehouse.entity";

describe("WarehouseService", () => {
  let service: WarehouseService;
  let repository: jest.Mocked<Repository<WarehouseEntity>>;

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
      providers: [
        WarehouseService,
        {
          provide: getRepositoryToken(WarehouseEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            softRemove: jest.fn(),
            recover: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WarehouseService>(WarehouseService);
    repository = module.get(getRepositoryToken(WarehouseEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a new warehouse successfully", async () => {
      // Arrange
      const createDto = {
        name: "Main Warehouse",
        code: "WH001",
        city: "London",
        country: "United Kingdom",
      };
      repository.create.mockReturnValue(mockWarehouse as WarehouseEntity);
      repository.save.mockResolvedValue(mockWarehouse as WarehouseEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(repository.save).toHaveBeenCalledWith(mockWarehouse);
      expect(result).toEqual(mockWarehouse);
    });

    it("should create warehouse with all fields", async () => {
      // Arrange
      const createDto = {
        name: "Main Warehouse",
        code: "WH001",
        address: "123 Storage St",
        city: "London",
        country: "United Kingdom",
        is_active: true,
      };
      repository.create.mockReturnValue(mockWarehouse as WarehouseEntity);
      repository.save.mockResolvedValue(mockWarehouse as WarehouseEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(repository.save).toHaveBeenCalled();
      expect(result.name).toBe("Main Warehouse");
    });
  });

  describe("findAll", () => {
    it("should find all warehouses with pagination", async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 20,
        sortBy: "name",
        sortOrder: "ASC" as const,
      };
      repository.findAndCount.mockResolvedValue([
        [mockWarehouse as WarehouseEntity],
        1,
      ]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(repository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { name: "ASC" },
        skip: 0,
        take: 20,
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it("should filter by name", async () => {
      // Arrange
      const query = { name: "Main" };
      repository.findAndCount.mockResolvedValue([
        [mockWarehouse as WarehouseEntity],
        1,
      ]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.anything(),
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it("should filter by city", async () => {
      // Arrange
      const query = { city: "London" };
      repository.findAndCount.mockResolvedValue([
        [mockWarehouse as WarehouseEntity],
        1,
      ]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            city: expect.anything(),
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it("should filter by country", async () => {
      // Arrange
      const query = { country: "United Kingdom" };
      repository.findAndCount.mockResolvedValue([
        [mockWarehouse as WarehouseEntity],
        1,
      ]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            country: expect.anything(),
          }),
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it("should filter by active status", async () => {
      // Arrange
      const query = { is_active: true };
      repository.findAndCount.mockResolvedValue([
        [mockWarehouse as WarehouseEntity],
        1,
      ]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
      expect(result.data).toHaveLength(1);
    });

    it("should handle pagination correctly", async () => {
      // Arrange
      const query = { page: 3, limit: 10 };
      repository.findAndCount.mockResolvedValue([
        [mockWarehouse as WarehouseEntity],
        25,
      ]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
      expect(result.meta.totalPages).toBe(3);
    });

    it("should support custom sorting", async () => {
      // Arrange
      const query = { sortBy: "city", sortOrder: "DESC" as const };
      repository.findAndCount.mockResolvedValue([
        [mockWarehouse as WarehouseEntity],
        1,
      ]);

      // Act
      await service.findAll(query);

      // Assert
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { city: "DESC" },
        }),
      );
    });

    it("should return empty array when no warehouses found", async () => {
      // Arrange
      const query = {};
      repository.findAndCount.mockResolvedValue([[], 0]);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe("findOne", () => {
    it("should find a warehouse by id", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440000";
      repository.findOne.mockResolvedValue(mockWarehouse as WarehouseEntity);

      // Act
      const result = await service.findOne(id);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(result).toEqual(mockWarehouse);
    });

    it("should throw NotFoundException when warehouse not found", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440001";
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(id)).rejects.toThrow(
        `Warehouse with ID ${id} not found`,
      );
    });
  });

  describe("update", () => {
    it("should update a warehouse successfully", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440000";
      const updateDto = {
        name: "Updated Warehouse",
        city: "Manchester",
      };
      const updatedWarehouse = {
        ...mockWarehouse,
        name: "Updated Warehouse",
        city: "Manchester",
      };
      repository.findOne.mockResolvedValue({
        ...mockWarehouse,
      } as WarehouseEntity);
      repository.save.mockResolvedValue(updatedWarehouse as WarehouseEntity);

      // Act
      const result = await service.update(id, updateDto);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(repository.save).toHaveBeenCalled();
      expect(result.name).toBe("Updated Warehouse");
      expect(result.city).toBe("Manchester");
    });

    it("should throw NotFoundException when warehouse not found", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440001";
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(id, { name: "Updated" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should update only provided fields", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440000";
      const updateDto = { is_active: false };
      const updatedWarehouse = { ...mockWarehouse, isActive: false };
      repository.findOne.mockResolvedValue({
        ...mockWarehouse,
      } as WarehouseEntity);
      repository.save.mockResolvedValue(updatedWarehouse as WarehouseEntity);

      // Act
      const result = await service.update(id, updateDto);

      // Assert
      expect(result.isActive).toBe(false);
      expect(result.name).toBe("Main Warehouse");
    });
  });

  describe("remove", () => {
    it("should soft delete a warehouse", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440000";
      repository.findOne.mockResolvedValue(mockWarehouse as WarehouseEntity);
      repository.softRemove.mockResolvedValue(mockWarehouse as WarehouseEntity);

      // Act
      await service.remove(id);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(repository.softRemove).toHaveBeenCalledWith(mockWarehouse);
    });

    it("should throw NotFoundException when warehouse not found", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440001";
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe("restore", () => {
    it("should restore a soft-deleted warehouse", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440000";
      const deletedWarehouse = {
        ...mockWarehouse,
        deletedAt: new Date("2024-01-02"),
      };
      repository.findOne.mockResolvedValue(deletedWarehouse as WarehouseEntity);
      repository.recover.mockResolvedValue(mockWarehouse as WarehouseEntity);

      // Act
      const result = await service.restore(id);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id },
        withDeleted: true,
      });
      expect(repository.recover).toHaveBeenCalledWith(deletedWarehouse);
      expect(result).toEqual(mockWarehouse);
    });

    it("should throw NotFoundException when warehouse not found", async () => {
      // Arrange
      const id = "550e8400-e29b-41d4-a716-446655440001";
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.restore(id)).rejects.toThrow(NotFoundException);
      await expect(service.restore(id)).rejects.toThrow(
        `Warehouse with ID ${id} not found`,
      );
    });
  });
});
