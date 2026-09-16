import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { SaddleOptionsItemService } from "../../../src/saddle-options-items/saddle-options-item.service";
import { SaddleOptionsItemEntity } from "../../../src/saddle-options-items/infrastructure/persistence/relational/entities/saddle-options-item.entity";
import { CreateSaddleOptionsItemDto } from "../../../src/saddle-options-items/dto/create-saddle-options-item.dto";
import { UpdateSaddleOptionsItemDto } from "../../../src/saddle-options-items/dto/update-saddle-options-item.dto";

describe("SaddleOptionsItemService", () => {
  let service: SaddleOptionsItemService;
  let repository: jest.Mocked<Repository<SaddleOptionsItemEntity>>;

  const mockSaddleOptionsItemEntity: SaddleOptionsItemEntity = {
    id: 1,
    saddleId: 100,
    optionId: 10,
    optionItemId: 20,
    leatherId: 5,
    sequence: 1,
    deleted: 0,
  } as SaddleOptionsItemEntity;

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
        SaddleOptionsItemService,
        {
          provide: getRepositoryToken(SaddleOptionsItemEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SaddleOptionsItemService>(SaddleOptionsItemService);
    repository = module.get(getRepositoryToken(SaddleOptionsItemEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new saddle-options-item association successfully", async () => {
      // Arrange
      const createDto: CreateSaddleOptionsItemDto = {
        saddleId: 100,
        optionId: 10,
        optionItemId: 20,
        leatherId: 5,
        sequence: 1,
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockSaddleOptionsItemEntity);
      repository.save.mockResolvedValue(mockSaddleOptionsItemEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toMatchObject({
        id: 1,
        saddleId: 100,
        optionId: 10,
        optionItemId: 20,
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          saddleId: 100,
          optionId: 10,
          optionItemId: 20,
          leatherId: 5,
        },
      });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          saddleId: 100,
          optionId: 10,
          deleted: 0,
        }),
      );
    });

    it("should create association with default sequence", async () => {
      // Arrange
      const createDto: CreateSaddleOptionsItemDto = {
        saddleId: 100,
        optionId: 10,
        optionItemId: 20,
        leatherId: 5,
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockSaddleOptionsItemEntity);
      repository.save.mockResolvedValue(mockSaddleOptionsItemEntity);

      // Act
      await service.create(createDto);

      // Assert
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sequence: 0,
          deleted: 0,
        }),
      );
    });

    it("should revive a soft-deleted association instead of inserting a duplicate", async () => {
      // Arrange — legacy keeps unchecked rows with deleted=1; re-checking must reuse them
      const createDto: CreateSaddleOptionsItemDto = {
        saddleId: 100,
        optionId: 10,
        optionItemId: 20,
        leatherId: 5,
      };
      const softDeleted = { ...mockSaddleOptionsItemEntity, deleted: 1 };
      repository.findOne.mockResolvedValue(
        softDeleted as SaddleOptionsItemEntity,
      );
      repository.save.mockImplementation((e) =>
        Promise.resolve(e as SaddleOptionsItemEntity),
      );

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, deleted: 0 }),
      );
      expect(result).toMatchObject({ id: 1, deleted: 0, isActive: true });
    });

    it("should throw ConflictException when association already exists", async () => {
      // Arrange
      const createDto: CreateSaddleOptionsItemDto = {
        saddleId: 100,
        optionId: 10,
        optionItemId: 20,
        leatherId: 5,
      };

      repository.findOne.mockResolvedValue(mockSaddleOptionsItemEntity);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should find association by ID", async () => {
      // Arrange
      const id = 1;
      repository.findOne.mockResolvedValue(mockSaddleOptionsItemEntity);

      // Act
      const result = await service.findOne(id);

      // Assert
      expect(result).toMatchObject({
        id: 1,
        saddleId: 100,
        optionId: 10,
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id, deleted: 0 },
      });
    });

    it("should throw NotFoundException when association not found", async () => {
      // Arrange
      const id = 999;
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("should return all associations with pagination", async () => {
      // Arrange
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSaddleOptionsItemEntity]),
      } as unknown as SelectQueryBuilder<SaddleOptionsItemEntity>;

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            saddleId: 100,
          }),
        ]),
        total: 1,
        pages: 1,
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("soi.deleted = 0");
    });

    it("should filter by saddleId", async () => {
      // Arrange
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSaddleOptionsItemEntity]),
      } as unknown as SelectQueryBuilder<SaddleOptionsItemEntity>;

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await service.findAll(1, 10, 100);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "soi.saddle_id = :saddleId",
        { saddleId: 100 },
      );
    });

    it("should filter by optionId", async () => {
      // Arrange
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSaddleOptionsItemEntity]),
      } as unknown as SelectQueryBuilder<SaddleOptionsItemEntity>;

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await service.findAll(1, 10, undefined, 10);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "soi.option_id = :optionId",
        { optionId: 10 },
      );
    });
  });

  describe("findBySaddleId", () => {
    it("should find all associations for a saddle", async () => {
      // Arrange
      const saddleId = 100;
      repository.find.mockResolvedValue([mockSaddleOptionsItemEntity]);

      // Act
      const result = await service.findBySaddleId(saddleId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        saddleId: 100,
      });
      expect(repository.find).toHaveBeenCalledWith({
        where: { saddleId, deleted: 0 },
        order: { sequence: "ASC" },
      });
    });

    it("should return empty array when no associations found", async () => {
      // Arrange
      const saddleId = 999;
      repository.find.mockResolvedValue([]);

      // Act
      const result = await service.findBySaddleId(saddleId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findByOptionId", () => {
    it("should find all associations for an option", async () => {
      // Arrange
      const optionId = 10;
      repository.find.mockResolvedValue([mockSaddleOptionsItemEntity]);

      // Act
      const result = await service.findByOptionId(optionId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        optionId: 10,
      });
      expect(repository.find).toHaveBeenCalledWith({
        where: { optionId, deleted: 0 },
        order: { sequence: "ASC" },
      });
    });
  });

  describe("findBySaddleAndOption", () => {
    it("should find all associations for a saddle and option combination", async () => {
      // Arrange
      const saddleId = 100;
      const optionId = 10;
      repository.find.mockResolvedValue([mockSaddleOptionsItemEntity]);

      // Act
      const result = await service.findBySaddleAndOption(saddleId, optionId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        saddleId: 100,
        optionId: 10,
      });
      expect(repository.find).toHaveBeenCalledWith({
        where: { saddleId, optionId, deleted: 0 },
        order: { sequence: "ASC" },
      });
    });
  });

  describe("update", () => {
    it("should update association successfully", async () => {
      // Arrange
      const id = 1;
      const updateDto: UpdateSaddleOptionsItemDto = {
        sequence: 5,
        leatherId: 10,
      };

      const updatedEntity = {
        ...mockSaddleOptionsItemEntity,
        sequence: 5,
        leatherId: 10,
      };

      repository.findOne.mockResolvedValue(mockSaddleOptionsItemEntity);
      repository.save.mockResolvedValue(
        updatedEntity as SaddleOptionsItemEntity,
      );

      // Act
      const result = await service.update(id, updateDto);

      // Assert
      expect(result).toMatchObject({
        sequence: 5,
        leatherId: 10,
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it("should throw NotFoundException when association not found", async () => {
      // Arrange
      const id = 999;
      const updateDto: UpdateSaddleOptionsItemDto = { sequence: 5 };
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(id, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should soft delete association successfully", async () => {
      // Arrange
      const id = 1;
      const deletedEntity = { ...mockSaddleOptionsItemEntity, deleted: 1 };
      repository.findOne.mockResolvedValue(mockSaddleOptionsItemEntity);
      repository.save.mockResolvedValue(
        deletedEntity as SaddleOptionsItemEntity,
      );

      // Act
      await service.remove(id);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id, deleted: 0 },
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleted: 1 }),
      );
    });

    it("should throw NotFoundException when association not found", async () => {
      // Arrange
      const id = 999;
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(id)).rejects.toThrow(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("bulkCreateForSaddle", () => {
    it("should bulk create associations for a saddle", async () => {
      // Arrange
      const saddleId = 100;
      const items = [
        {
          optionId: 10,
          optionItemId: 20,
          leatherId: 5,
          sequence: 1,
        },
        {
          optionId: 11,
          optionItemId: 21,
          leatherId: 6,
          sequence: 2,
        },
      ];

      const entities = [
        mockSaddleOptionsItemEntity,
        { ...mockSaddleOptionsItemEntity, id: 2, optionId: 11 },
      ];

      repository.create.mockImplementation(
        (data) => data as SaddleOptionsItemEntity,
      );
      repository.save.mockResolvedValue(entities as any);

      // Act
      const result = await service.bulkCreateForSaddle(saddleId, items);

      // Assert
      expect(result).toHaveLength(2);
      expect(repository.create).toHaveBeenCalledTimes(2);
      expect(repository.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            saddleId: 100,
            optionId: 10,
            deleted: 0,
          }),
          expect.objectContaining({
            saddleId: 100,
            optionId: 11,
            deleted: 0,
          }),
        ]),
      );
    });

    it("should bulk create with default sequence values", async () => {
      // Arrange
      const saddleId = 100;
      const items = [
        {
          optionId: 10,
          optionItemId: 20,
          leatherId: 5,
        },
      ];

      repository.create.mockImplementation(
        (data) => data as SaddleOptionsItemEntity,
      );
      repository.save.mockResolvedValue([mockSaddleOptionsItemEntity] as any);

      // Act
      await service.bulkCreateForSaddle(saddleId, items);

      // Assert
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sequence: 0,
        }),
      );
    });
  });
});
