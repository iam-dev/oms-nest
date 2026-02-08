import { Test, TestingModule } from "@nestjs/testing";
import {
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { FactoryEmployeeService } from "../../../src/factory-employees/factory-employee.service";
import { FactoryEmployeeRepository } from "../../../src/factory-employees/domain/factory-employee.repository";
import { FactoryEmployee } from "../../../src/factory-employees/domain/factory-employee";
import { FactoryEmployeeId } from "../../../src/factory-employees/domain/value-objects/factory-employee-id.value-object";

// Mock the mapper module
jest.mock(
  "../../../src/factory-employees/mappers/factory-employee-dto.mapper",
  () => ({
    FactoryEmployeeDtoMapper: {
      mapPaginationParams: jest.fn().mockReturnValue({ limit: 20, offset: 0 }),
      fromUpdateDto: jest.fn().mockImplementation((dto) => dto),
      toDto: jest.fn().mockImplementation((entity) => entity),
      toDtoArray: jest.fn().mockImplementation((entities) => entities),
    },
  }),
);

describe("FactoryEmployeeService", () => {
  let service: FactoryEmployeeService;
  let repository: jest.Mocked<FactoryEmployeeRepository>;

  const mockFactoryEmployeeId = FactoryEmployeeId.fromNumber(1);
  const mockFactoryEmployee = new FactoryEmployee(
    mockFactoryEmployeeId,
    100,
    "John Doe",
  );

  beforeEach(async () => {
    const mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      findByFactoryId: jest.fn(),
      existsByNameAndFactory: jest.fn(),
      exists: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FactoryEmployeeService,
        {
          provide: "FactoryEmployeeRepository",
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<FactoryEmployeeService>(FactoryEmployeeService);
    repository = module.get("FactoryEmployeeRepository");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a new factory employee successfully", async () => {
      // Arrange
      const createDto = {
        factoryId: 100,
        name: "John Doe",
      };
      repository.existsByNameAndFactory.mockResolvedValue(false);
      repository.save.mockResolvedValue(mockFactoryEmployee);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(repository.existsByNameAndFactory).toHaveBeenCalledWith(
        "John Doe",
        100,
      );
      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(mockFactoryEmployee);
    });

    it("should throw ConflictException when employee name already exists in factory", async () => {
      // Arrange
      const createDto = {
        factoryId: 100,
        name: "John Doe",
      };
      repository.existsByNameAndFactory.mockResolvedValue(true);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        "Employee with name 'John Doe' already exists in factory 100",
      );
    });

    it("should throw BadRequestException when factory id is invalid", async () => {
      // Arrange
      const createDto = {
        factoryId: 0,
        name: "John Doe",
      };

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        "Factory ID must be a positive number",
      );
    });

    it("should throw BadRequestException when name is empty", async () => {
      // Arrange
      const createDto = {
        factoryId: 100,
        name: "",
      };

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        "Employee name cannot be empty",
      );
    });

    it("should throw BadRequestException when name exceeds 255 characters", async () => {
      // Arrange
      const createDto = {
        factoryId: 100,
        name: "a".repeat(256),
      };

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        "Employee name cannot exceed 255 characters",
      );
    });
  });

  describe("findAll", () => {
    it("should find all factory employees with pagination", async () => {
      // Arrange
      const query = { page: 1, limit: 20 };
      repository.findAll.mockResolvedValue([mockFactoryEmployee]);
      repository.count.mockResolvedValue(1);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(repository.findAll).toHaveBeenCalledWith({
        factoryId: undefined,
        name: undefined,
        limit: 20,
        offset: 0,
      });
      expect(repository.count).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("should filter by factoryId", async () => {
      // Arrange
      const query = { factoryId: 100, page: 1, limit: 20 };
      repository.findAll.mockResolvedValue([mockFactoryEmployee]);
      repository.count.mockResolvedValue(1);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(repository.findAll).toHaveBeenCalledWith({
        factoryId: 100,
        name: undefined,
        limit: 20,
        offset: 0,
      });
      expect(result.data).toHaveLength(1);
    });

    it("should filter by name", async () => {
      // Arrange
      const query = { name: "John", page: 1, limit: 20 };
      repository.findAll.mockResolvedValue([mockFactoryEmployee]);
      repository.count.mockResolvedValue(1);

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(repository.count).toHaveBeenCalledWith({
        factoryId: undefined,
        name: "John",
      });
      expect(result.data).toHaveLength(1);
    });
  });

  describe("findOne", () => {
    it("should find a factory employee by id", async () => {
      // Arrange
      repository.findById.mockResolvedValue(mockFactoryEmployee);

      // Act
      const result = await service.findOne(1);

      // Assert
      expect(repository.findById).toHaveBeenCalledWith(
        expect.objectContaining({ value: 1 }),
      );
      expect(result).toEqual(mockFactoryEmployee);
    });

    it("should throw NotFoundException when employee not found", async () => {
      // Arrange
      repository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(
        "Factory Employee with ID 999 not found",
      );
    });
  });

  describe("findByFactoryId", () => {
    it("should find employees by factory id", async () => {
      // Arrange
      repository.findByFactoryId.mockResolvedValue([mockFactoryEmployee]);

      // Act
      const result = await service.findByFactoryId(100);

      // Assert
      expect(repository.findByFactoryId).toHaveBeenCalledWith(100);
      expect(result).toHaveLength(1);
    });

    it("should throw BadRequestException when factory id is invalid", async () => {
      // Act & Assert
      await expect(service.findByFactoryId(0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findByFactoryId(-1)).rejects.toThrow(
        "Factory ID must be a positive number",
      );
    });

    it("should return empty array when no employees found", async () => {
      // Arrange
      repository.findByFactoryId.mockResolvedValue([]);

      // Act
      const result = await service.findByFactoryId(100);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update a factory employee successfully", async () => {
      // Arrange
      const updateDto = { name: "Jane Doe" };
      const updatedEmployee = new FactoryEmployee(
        mockFactoryEmployeeId,
        100,
        "Jane Doe",
      );
      repository.findById.mockResolvedValue(mockFactoryEmployee);
      repository.existsByNameAndFactory.mockResolvedValue(false);
      repository.update.mockResolvedValue(updatedEmployee);

      // Act
      const result = await service.update(1, updateDto);

      // Assert
      expect(repository.findById).toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalled();
      expect(result.name).toBe("Jane Doe");
    });

    it("should throw NotFoundException when employee not found", async () => {
      // Arrange
      repository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(999, { name: "Jane" })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw ConflictException when name already exists in factory", async () => {
      // Arrange
      const updateDto = { name: "Existing Name" };
      repository.findById.mockResolvedValue(mockFactoryEmployee);
      repository.existsByNameAndFactory.mockResolvedValue(true);

      // Act & Assert
      await expect(service.update(1, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("should allow updating to same name", async () => {
      // Arrange
      const updateDto = { name: "John Doe" };
      repository.findById.mockResolvedValue(mockFactoryEmployee);
      repository.existsByNameAndFactory.mockResolvedValue(true);
      repository.update.mockResolvedValue(mockFactoryEmployee);

      // Act
      const result = await service.update(1, updateDto);

      // Assert
      expect(result).toEqual(mockFactoryEmployee);
    });
  });

  describe("remove", () => {
    it("should remove a factory employee", async () => {
      // Arrange
      repository.exists.mockResolvedValue(true);
      repository.delete.mockResolvedValue(undefined);

      // Act
      await service.remove(1);

      // Assert
      expect(repository.exists).toHaveBeenCalledWith(
        expect.objectContaining({ value: 1 }),
      );
      expect(repository.delete).toHaveBeenCalled();
    });

    it("should throw NotFoundException when employee not found", async () => {
      // Arrange
      repository.exists.mockResolvedValue(false);

      // Act & Assert
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe("getEmployeeCountByFactory", () => {
    it("should return employee count by factory", async () => {
      // Arrange
      repository.count.mockResolvedValue(5);

      // Act
      const result = await service.getEmployeeCountByFactory(100);

      // Assert
      expect(repository.count).toHaveBeenCalledWith({ factoryId: 100 });
      expect(result).toBe(5);
    });

    it("should throw BadRequestException when factory id is invalid", async () => {
      // Act & Assert
      await expect(service.getEmployeeCountByFactory(0)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("exists", () => {
    it("should return true when employee exists", async () => {
      // Arrange
      repository.exists.mockResolvedValue(true);

      // Act
      const result = await service.exists(1);

      // Assert
      expect(repository.exists).toHaveBeenCalledWith(
        expect.objectContaining({ value: 1 }),
      );
      expect(result).toBe(true);
    });

    it("should return false when employee does not exist", async () => {
      // Arrange
      repository.exists.mockResolvedValue(false);

      // Act
      const result = await service.exists(999);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("bulkTransferToFactory", () => {
    it("should transfer multiple employees to new factory", async () => {
      // Arrange
      const employeeIds = [1, 2, 3];
      const newFactoryId = 200;
      repository.findById.mockResolvedValue(mockFactoryEmployee);
      repository.existsByNameAndFactory.mockResolvedValue(false);
      repository.update.mockResolvedValue(mockFactoryEmployee);

      // Act
      const result = await service.bulkTransferToFactory(
        employeeIds,
        newFactoryId,
      );

      // Assert
      expect(result).toHaveLength(3);
    });

    it("should throw BadRequestException when employee ids is empty", async () => {
      // Act & Assert
      await expect(service.bulkTransferToFactory([], 100)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.bulkTransferToFactory([], 100)).rejects.toThrow(
        "Employee IDs cannot be empty",
      );
    });

    it("should throw BadRequestException when factory id is invalid", async () => {
      // Act & Assert
      await expect(service.bulkTransferToFactory([1, 2], 0)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should continue with other employees if one fails", async () => {
      // Arrange
      const employeeIds = [1, 2, 3];
      const newFactoryId = 200;
      const loggerWarnSpy = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => {});

      repository.findById
        .mockResolvedValueOnce(mockFactoryEmployee)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockFactoryEmployee);
      repository.existsByNameAndFactory.mockResolvedValue(false);
      repository.update.mockResolvedValue(mockFactoryEmployee);

      // Act
      const result = await service.bulkTransferToFactory(
        employeeIds,
        newFactoryId,
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(loggerWarnSpy).toHaveBeenCalled();

      loggerWarnSpy.mockRestore();
    });
  });
});
