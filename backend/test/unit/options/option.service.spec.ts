import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { OptionService } from "../../../src/options/option.service";
import { OptionEntity } from "../../../src/options/infrastructure/persistence/relational/entities/option.entity";
import { CreateOptionDto } from "../../../src/options/dto/create-option.dto";
import { UpdateOptionDto } from "../../../src/options/dto/update-option.dto";

describe("OptionService", () => {
  let service: OptionService;
  let repository: jest.Mocked<Repository<OptionEntity>>;

  const createMockOptionEntity = (overrides = {}): OptionEntity => {
    const entity = new OptionEntity();
    Object.assign(entity, {
      id: 1,
      name: "Stirrup Leather Length",
      group: "stirrups",
      type: 1,
      price1: 100,
      price2: 200,
      price3: 300,
      price4: 400,
      price5: 500,
      price6: 600,
      price7: 700,
      priceContrast1: 110,
      priceContrast2: 210,
      priceContrast3: 310,
      priceContrast4: 410,
      priceContrast5: 510,
      priceContrast6: 610,
      priceContrast7: 710,
      sequence: 1,
      extraAllowed: 0,
      deleted: 0,
      createdAt: new Date("2023-01-01"),
      updatedAt: new Date("2023-01-01"),
      ...overrides,
    });
    return entity;
  };

  const mockOptionEntity = createMockOptionEntity();

  beforeEach(async () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getMany: jest.fn().mockResolvedValue([mockOptionEntity]),
    };

    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionService,
        {
          provide: getRepositoryToken(OptionEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<OptionService>(OptionService);
    repository = module.get(getRepositoryToken(OptionEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new option successfully", async () => {
      // Arrange
      const createDto: CreateOptionDto = {
        name: "New Option",
        group: "test",
        type: 1,
        price1: 100,
        sequence: 1,
      };

      repository.findOne.mockResolvedValue(null); // No existing option
      repository.create.mockReturnValue(mockOptionEntity);
      repository.save.mockResolvedValue(mockOptionEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(mockOptionEntity.name);
      expect(repository.findOne).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it("should throw ConflictException when option with same name exists", async () => {
      // Arrange
      const createDto: CreateOptionDto = {
        name: "Existing Option",
        group: "test",
        type: 1,
      };

      repository.findOne.mockResolvedValue(mockOptionEntity);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.findOne).toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return option by ID", async () => {
      // Arrange
      const optionId = 1;
      repository.findOne.mockResolvedValue(mockOptionEntity);

      // Act
      const result = await service.findOne(optionId);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockOptionEntity.id);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: optionId, deleted: 0 },
      });
    });

    it("should throw NotFoundException when option not found", async () => {
      // Arrange
      const optionId = 999;
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(optionId)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: optionId, deleted: 0 },
      });
    });
  });

  describe("findAll", () => {
    it("should return paginated options", async () => {
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

    it("should apply search filter", async () => {
      // Arrange
      const page = 1;
      const limit = 10;
      const search = "Stirrup";

      // Act
      const result = await service.findAll(page, limit, search);

      // Assert
      expect(result).toBeDefined();
      expect(repository.createQueryBuilder).toHaveBeenCalled();
    });

    it("should exclude a type when excludeType is given (e.g. extras = type 2)", async () => {
      // Act
      await service.findAll(1, 10, undefined, undefined, undefined, 2);

      // Assert
      const qb = repository.createQueryBuilder("option");
      expect(qb.andWhere).toHaveBeenCalledWith("option.type <> :excludeType", {
        excludeType: 2,
      });
    });
  });

  describe("update", () => {
    it("should update option successfully", async () => {
      // Arrange
      const optionId = 1;
      const updateDto: UpdateOptionDto = {
        name: "Updated Option",
        price1: 150,
      };

      repository.findOne
        .mockResolvedValueOnce(mockOptionEntity) // First call: find existing
        .mockResolvedValueOnce(null); // Second call: check name conflict
      repository.save.mockResolvedValue(
        createMockOptionEntity({
          name: updateDto.name ?? mockOptionEntity.name,
          price1: updateDto.price1 ?? mockOptionEntity.price1,
        }),
      );

      // Act
      const result = await service.update(optionId, updateDto);

      // Assert
      expect(result).toBeDefined();
      expect(repository.findOne).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it("should throw NotFoundException when option not found for update", async () => {
      // Arrange
      const optionId = 999;
      const updateDto: UpdateOptionDto = { name: "Updated" };

      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(optionId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("should throw ConflictException when updating to existing name", async () => {
      // Arrange
      const optionId = 1;
      const updateDto: UpdateOptionDto = { name: "Another Option" };

      const existingOption = createMockOptionEntity({
        id: 2,
        name: "Another Option",
      });

      repository.findOne
        .mockResolvedValueOnce(mockOptionEntity) // Find option to update
        .mockResolvedValueOnce(existingOption); // Find existing with same name

      // Act & Assert
      await expect(service.update(optionId, updateDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should soft delete option successfully", async () => {
      // Arrange
      const optionId = 1;
      repository.findOne.mockResolvedValue(mockOptionEntity);
      repository.save.mockResolvedValue(createMockOptionEntity({ deleted: 1 }));

      // Act
      await service.remove(optionId);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: optionId, deleted: 0 },
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleted: 1 }),
      );
    });

    it("should throw NotFoundException when option not found for removal", async () => {
      // Arrange
      const optionId = 999;
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(optionId)).rejects.toThrow(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("findActiveOptions", () => {
    it("should return only active options", async () => {
      // Arrange
      repository.find.mockResolvedValue([mockOptionEntity]);

      // Act
      const result = await service.findActiveOptions();

      // Assert
      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { deleted: 0 },
        order: { sequence: "ASC", name: "ASC" },
      });
    });
  });

  describe("findByGroup", () => {
    it("should return options for specific group", async () => {
      // Arrange
      const group = "stirrups";
      repository.find.mockResolvedValue([mockOptionEntity]);

      // Act
      const result = await service.findByGroup(group);

      // Assert
      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { group, deleted: 0 },
        order: { sequence: "ASC", name: "ASC" },
      });
    });
  });

  describe("findByType", () => {
    it("should return options for specific type", async () => {
      // Arrange
      const type = 1;
      repository.find.mockResolvedValue([mockOptionEntity]);

      // Act
      const result = await service.findByType(type);

      // Assert
      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { type, deleted: 0 },
        order: { sequence: "ASC", name: "ASC" },
      });
    });
  });
});
