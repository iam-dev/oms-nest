import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { SaddleExtraService } from "../../../src/saddle-extras/saddle-extra.service";
import { SaddleExtraEntity } from "../../../src/saddle-extras/infrastructure/persistence/relational/entities/saddle-extra.entity";
import { CreateSaddleExtraDto } from "../../../src/saddle-extras/dto/create-saddle-extra.dto";
import { UpdateSaddleExtraDto } from "../../../src/saddle-extras/dto/update-saddle-extra.dto";

describe("SaddleExtraService", () => {
  let service: SaddleExtraService;
  let repository: jest.Mocked<Repository<SaddleExtraEntity>>;

  const createEntity = (
    overrides: Partial<SaddleExtraEntity> = {},
  ): SaddleExtraEntity => {
    const entity = Object.assign(new SaddleExtraEntity(), {
      id: 1,
      saddleId: 100,
      extraId: 5,
      deleted: 0,
      ...overrides,
    });
    return entity;
  };

  const mockSaddleExtraEntity = createEntity();

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaddleExtraService,
        {
          provide: getRepositoryToken(SaddleExtraEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SaddleExtraService>(SaddleExtraService);
    repository = module.get(getRepositoryToken(SaddleExtraEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new saddle-extra association successfully", async () => {
      // Arrange
      const createDto: CreateSaddleExtraDto = {
        saddleId: 100,
        extraId: 5,
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockSaddleExtraEntity);
      repository.save.mockResolvedValue(mockSaddleExtraEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toMatchObject({
        id: 1,
        saddleId: 100,
        extraId: 5,
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          saddleId: 100,
          extraId: 5,
          deleted: 0,
        },
      });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          saddleId: 100,
          extraId: 5,
          deleted: 0,
        }),
      );
      expect(repository.save).toHaveBeenCalledWith(mockSaddleExtraEntity);
    });

    it("should throw ConflictException when association already exists", async () => {
      // Arrange
      const createDto: CreateSaddleExtraDto = {
        saddleId: 100,
        extraId: 5,
      };

      repository.findOne.mockResolvedValue(mockSaddleExtraEntity);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        "Saddle-extra association already exists",
      );
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should find association by ID", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(mockSaddleExtraEntity);

      // Act
      const result = await service.findOne(1);

      // Assert
      expect(result).toMatchObject({
        id: 1,
        saddleId: 100,
        extraId: 5,
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1, deleted: 0 },
      });
    });

    it("should throw NotFoundException when association not found", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow(
        "Saddle-extra association not found",
      );
    });
  });

  describe("findAll", () => {
    let mockQueryBuilder: any;

    beforeEach(() => {
      mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSaddleExtraEntity]),
      } as unknown as SelectQueryBuilder<SaddleExtraEntity>;

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it("should return paginated results with defaults", async () => {
      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            saddleId: 100,
            extraId: 5,
          }),
        ]),
        total: 1,
        pages: 1,
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("se.deleted = 0");
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it("should apply correct pagination offset", async () => {
      // Act
      await service.findAll(3, 20);

      // Assert
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(40);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it("should filter by saddleId when provided", async () => {
      // Act
      await service.findAll(1, 10, 100);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "se.saddle_id = :saddleId",
        { saddleId: 100 },
      );
    });

    it("should filter by extraId when provided", async () => {
      // Act
      await service.findAll(1, 10, undefined, 5);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "se.extra_id = :extraId",
        { extraId: 5 },
      );
    });

    it("should filter by both saddleId and extraId when provided", async () => {
      // Act
      await service.findAll(1, 10, 100, 5);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "se.saddle_id = :saddleId",
        { saddleId: 100 },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "se.extra_id = :extraId",
        { extraId: 5 },
      );
    });

    it("should return empty results when no data found", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual({
        data: [],
        total: 0,
        pages: 0,
      });
    });

    it("should calculate pages correctly", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(25);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(result.total).toBe(25);
      expect(result.pages).toBe(3);
    });
  });

  describe("findBySaddleId", () => {
    it("should return mapped DTOs for a given saddleId", async () => {
      // Arrange
      const entities = [
        createEntity({ id: 1, extraId: 5 }),
        createEntity({ id: 2, extraId: 10 }),
      ];

      repository.find.mockResolvedValue(entities);

      // Act
      const result = await service.findBySaddleId(100);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: 1, saddleId: 100, extraId: 5 });
      expect(result[1]).toMatchObject({ id: 2, saddleId: 100, extraId: 10 });
      expect(repository.find).toHaveBeenCalledWith({
        where: { saddleId: 100, deleted: 0 },
      });
    });

    it("should return empty array when no associations found", async () => {
      // Arrange
      repository.find.mockResolvedValue([]);

      // Act
      const result = await service.findBySaddleId(999);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update association successfully", async () => {
      // Arrange
      const updateDto: UpdateSaddleExtraDto = {
        saddleId: 200,
        extraId: 10,
      };

      const updatedEntity = createEntity({ saddleId: 200, extraId: 10 });

      repository.findOne.mockResolvedValue(createEntity());
      repository.save.mockResolvedValue(updatedEntity);

      // Act
      const result = await service.update(1, updateDto);

      // Assert
      expect(result).toMatchObject({
        saddleId: 200,
        extraId: 10,
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it("should throw NotFoundException when association not found", async () => {
      // Arrange
      const updateDto: UpdateSaddleExtraDto = { saddleId: 200 };
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(999, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("should allow partial update with only saddleId", async () => {
      // Arrange
      const updateDto: UpdateSaddleExtraDto = { saddleId: 200 };

      const updatedEntity = createEntity({ saddleId: 200 });

      repository.findOne.mockResolvedValue(createEntity());
      repository.save.mockResolvedValue(updatedEntity);

      // Act
      const result = await service.update(1, updateDto);

      // Assert
      expect(result).toMatchObject({ saddleId: 200, extraId: 5 });
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should soft delete association by setting deleted=1", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(createEntity());
      repository.save.mockResolvedValue(createEntity({ deleted: 1 }));

      // Act
      await service.remove(1);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1, deleted: 0 },
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleted: 1 }),
      );
    });

    it("should throw NotFoundException when association not found", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("toDto (via public methods)", () => {
    it("should map isActive=true when deleted=0", async () => {
      // Arrange
      repository.findOne.mockResolvedValue(createEntity({ deleted: 0 }));

      // Act
      const result = await service.findOne(1);

      // Assert
      expect(result.isActive).toBe(true);
      expect(result.deleted).toBe(0);
    });

    it("should map isActive=false when deleted=1", async () => {
      // Arrange
      const entity = createEntity({ deleted: 1 });

      // We test toDto through create, which calls toDto on the saved entity
      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(entity);
      repository.save.mockResolvedValue(entity);

      // Act
      const result = await service.create({ saddleId: 100, extraId: 5 });

      // Assert
      expect(result.isActive).toBe(false);
      expect(result.deleted).toBe(1);
    });
  });
});
