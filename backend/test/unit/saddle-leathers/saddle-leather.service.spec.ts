import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { SaddleLeatherService } from "../../../src/saddle-leathers/saddle-leather.service";
import { SaddleLeatherEntity } from "../../../src/saddle-leathers/infrastructure/persistence/relational/entities/saddle-leather.entity";
import { CreateSaddleLeatherDto } from "../../../src/saddle-leathers/dto/create-saddle-leather.dto";
import { UpdateSaddleLeatherDto } from "../../../src/saddle-leathers/dto/update-saddle-leather.dto";

describe("SaddleLeatherService", () => {
  let service: SaddleLeatherService;
  let repository: jest.Mocked<Repository<SaddleLeatherEntity>>;

  const mockSaddleLeatherEntity: SaddleLeatherEntity = {
    id: 1,
    saddleId: 100,
    leatherId: 50,
    price1: 1000,
    price2: 1100,
    price3: 1200,
    price4: 1300,
    price5: 1400,
    price6: 1500,
    price7: 1600,
    sequence: 1,
    deleted: 0,
  } as SaddleLeatherEntity;

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
        SaddleLeatherService,
        {
          provide: getRepositoryToken(SaddleLeatherEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SaddleLeatherService>(SaddleLeatherService);
    repository = module.get(getRepositoryToken(SaddleLeatherEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new saddle-leather association successfully", async () => {
      // Arrange
      const createDto: CreateSaddleLeatherDto = {
        saddleId: 100,
        leatherId: 50,
        price1: 1000,
        price2: 1100,
        price3: 1200,
        sequence: 1,
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockSaddleLeatherEntity);
      repository.save.mockResolvedValue(mockSaddleLeatherEntity);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toMatchObject({
        id: 1,
        saddleId: 100,
        leatherId: 50,
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          saddleId: 100,
          leatherId: 50,
        },
      });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          saddleId: 100,
          leatherId: 50,
          deleted: 0,
        }),
      );
      expect(repository.save).toHaveBeenCalledWith(mockSaddleLeatherEntity);
    });

    it("should create association with default values", async () => {
      // Arrange
      const createDto: CreateSaddleLeatherDto = {
        saddleId: 100,
        leatherId: 50,
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockSaddleLeatherEntity);
      repository.save.mockResolvedValue(mockSaddleLeatherEntity);

      // Act
      await service.create(createDto);

      // Assert
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          price1: 0,
          price2: 0,
          price3: 0,
          price4: 0,
          price5: 0,
          price6: 0,
          price7: 0,
          sequence: 0,
          deleted: 0,
        }),
      );
    });

    it("should revive a soft-deleted association and keep its prices", async () => {
      // Arrange — legacy keeps the row (with prices) when a leather is unchecked,
      // so re-checking must restore that row instead of inserting a zero-priced copy
      const createDto: CreateSaddleLeatherDto = {
        saddleId: 100,
        leatherId: 50,
      };
      const softDeleted = { ...mockSaddleLeatherEntity, deleted: 1 };
      repository.findOne.mockResolvedValue(softDeleted as SaddleLeatherEntity);
      repository.save.mockImplementation((e) =>
        Promise.resolve(e as SaddleLeatherEntity),
      );

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          deleted: 0,
          price1: 1000,
          price7: 1600,
        }),
      );
      expect(result).toMatchObject({ id: 1, deleted: 0, price1: 1000 });
    });

    it("should apply supplied prices when reviving a soft-deleted association", async () => {
      // Arrange
      const createDto: CreateSaddleLeatherDto = {
        saddleId: 100,
        leatherId: 50,
        price1: 5,
      };
      const softDeleted = { ...mockSaddleLeatherEntity, deleted: 1 };
      repository.findOne.mockResolvedValue(softDeleted as SaddleLeatherEntity);
      repository.save.mockImplementation((e) =>
        Promise.resolve(e as SaddleLeatherEntity),
      );

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toMatchObject({ deleted: 0, price1: 5, price2: 1100 });
    });

    it("should throw ConflictException when association already exists", async () => {
      // Arrange
      const createDto: CreateSaddleLeatherDto = {
        saddleId: 100,
        leatherId: 50,
      };

      repository.findOne.mockResolvedValue(mockSaddleLeatherEntity);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          saddleId: 100,
          leatherId: 50,
        },
      });
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should find association by ID", async () => {
      // Arrange
      const id = 1;
      repository.findOne.mockResolvedValue(mockSaddleLeatherEntity);

      // Act
      const result = await service.findOne(id);

      // Assert
      expect(result).toMatchObject({
        id: 1,
        saddleId: 100,
        leatherId: 50,
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
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id, deleted: 0 },
      });
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
        getMany: jest.fn().mockResolvedValue([mockSaddleLeatherEntity]),
      } as unknown as SelectQueryBuilder<SaddleLeatherEntity>;

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.findAll(1, 10);

      // Assert
      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            saddleId: 100,
            leatherId: 50,
          }),
        ]),
        total: 1,
        pages: 1,
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("sl.deleted = 0");
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "sl.sequence",
        "ASC",
      );
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
        getMany: jest.fn().mockResolvedValue([mockSaddleLeatherEntity]),
      } as unknown as SelectQueryBuilder<SaddleLeatherEntity>;

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await service.findAll(1, 10, 100);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "sl.saddle_id = :saddleId",
        { saddleId: 100 },
      );
    });

    it("should filter by leatherId", async () => {
      // Arrange
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSaddleLeatherEntity]),
      } as unknown as SelectQueryBuilder<SaddleLeatherEntity>;

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await service.findAll(1, 10, undefined, 50);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "sl.leather_id = :leatherId",
        { leatherId: 50 },
      );
    });
  });

  describe("findBySaddleId", () => {
    it("should include soft-deleted associations when includeDeleted is true", async () => {
      // Arrange
      const softDeleted = { ...mockSaddleLeatherEntity, id: 2, deleted: 1 };
      repository.find.mockResolvedValue([
        mockSaddleLeatherEntity,
        softDeleted as SaddleLeatherEntity,
      ]);

      // Act
      const result = await service.findBySaddleId(100, true);

      // Assert
      expect(repository.find).toHaveBeenCalledWith({
        where: { saddleId: 100 },
        order: { sequence: "ASC" },
      });
      expect(result).toHaveLength(2);
      expect(result[1]).toMatchObject({ id: 2, deleted: 1, isActive: false });
    });

    it("should find all associations for a saddle", async () => {
      // Arrange
      const saddleId = 100;
      repository.find.mockResolvedValue([mockSaddleLeatherEntity]);

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

  describe("findByLeatherId", () => {
    it("should find all associations for a leather", async () => {
      // Arrange
      const leatherId = 50;
      repository.find.mockResolvedValue([mockSaddleLeatherEntity]);

      // Act
      const result = await service.findByLeatherId(leatherId);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        leatherId: 50,
      });
      expect(repository.find).toHaveBeenCalledWith({
        where: { leatherId, deleted: 0 },
        order: { sequence: "ASC" },
      });
    });

    it("should return empty array when no associations found", async () => {
      // Arrange
      const leatherId = 999;
      repository.find.mockResolvedValue([]);

      // Act
      const result = await service.findByLeatherId(leatherId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("should update association successfully", async () => {
      // Arrange
      const id = 1;
      const updateDto: UpdateSaddleLeatherDto = {
        price1: 2000,
        price2: 2100,
        sequence: 5,
      };

      const updatedEntity = {
        ...mockSaddleLeatherEntity,
        price1: 2000,
        price2: 2100,
        sequence: 5,
      };

      repository.findOne.mockResolvedValue(mockSaddleLeatherEntity);
      repository.save.mockResolvedValue(updatedEntity as SaddleLeatherEntity);

      // Act
      const result = await service.update(id, updateDto);

      // Assert
      expect(result).toMatchObject({
        price1: 2000,
        price2: 2100,
        sequence: 5,
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it("should throw NotFoundException when association not found", async () => {
      // Arrange
      const id = 999;
      const updateDto: UpdateSaddleLeatherDto = { price1: 2000 };
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
      const deletedEntity = { ...mockSaddleLeatherEntity, deleted: 1 };
      repository.findOne.mockResolvedValue(mockSaddleLeatherEntity);
      repository.save.mockResolvedValue(deletedEntity as SaddleLeatherEntity);

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
});
