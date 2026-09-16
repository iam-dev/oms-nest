import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { LeathertypeService } from "../../../src/leathertypes/leathertype.service";
import { LeathertypeEntity } from "../../../src/leathertypes/infrastructure/persistence/relational/entities/leathertype.entity";
import { CreateLeathertypeDto } from "../../../src/leathertypes/dto/create-leathertype.dto";
import { UpdateLeathertypeDto } from "../../../src/leathertypes/dto/update-leathertype.dto";

describe("LeathertypeService", () => {
  let service: LeathertypeService;
  let repository: jest.Mocked<Repository<LeathertypeEntity>>;

  const mockLeathertypeEntity: LeathertypeEntity = {
    id: 1,
    name: "Full Grain Leather",
    sequence: 1,
    deleted: 0,
  } as LeathertypeEntity;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeathertypeService,
        {
          provide: getRepositoryToken(LeathertypeEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LeathertypeService>(LeathertypeService);
    repository = module.get(getRepositoryToken(LeathertypeEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new leathertype successfully", async () => {
      // Arrange
      const createDto: CreateLeathertypeDto = {
        name: "New Leather",
        sequence: 5,
      };

      const newLeathertypeEntity = {
        ...createDto,
        id: 2,
        deleted: 0,
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(
        newLeathertypeEntity as LeathertypeEntity,
      );
      repository.save.mockResolvedValue(
        newLeathertypeEntity as LeathertypeEntity,
      );

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toMatchObject({
        name: createDto.name,
        sequence: createDto.sequence,
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { name: createDto.name, deleted: 0 },
      });
      expect(repository.create).toHaveBeenCalledWith({
        name: createDto.name,
        sequence: createDto.sequence,
        deleted: 0,
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it("should apply default sequence when not provided", async () => {
      // Arrange
      const createDto: CreateLeathertypeDto = {
        name: "Test Leather",
      };

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue({} as LeathertypeEntity);
      repository.save.mockResolvedValue(mockLeathertypeEntity);

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

    it("should throw ConflictException when leathertype name already exists", async () => {
      // Arrange
      const createDto: CreateLeathertypeDto = {
        name: "Existing Leather",
      };

      repository.findOne.mockResolvedValue(mockLeathertypeEntity);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { name: createDto.name, deleted: 0 },
      });
      expect(repository.create).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should find leathertype by ID", async () => {
      // Arrange
      const leathertypeId = 1;
      repository.findOne.mockResolvedValue(mockLeathertypeEntity);

      // Act
      const result = await service.findOne(leathertypeId);

      // Assert
      expect(result).toMatchObject({
        id: mockLeathertypeEntity.id,
        name: mockLeathertypeEntity.name,
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: leathertypeId, deleted: 0 },
      });
    });

    it("should throw NotFoundException when leathertype not found", async () => {
      // Arrange
      const leathertypeId = 999;
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(leathertypeId)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: leathertypeId, deleted: 0 },
      });
    });
  });

  describe("findAll", () => {
    beforeEach(() => {
      repository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as unknown as SelectQueryBuilder<LeathertypeEntity>,
      );
    });

    it("should return paginated leathertypes with default parameters", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockLeathertypeEntity]);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: mockLeathertypeEntity.id,
            name: mockLeathertypeEntity.name,
          }),
        ]),
        total: 1,
        pages: 1,
      });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "leathertype.deleted = 0",
      );
    });

    it("should include soft-deleted leathertypes when includeDeleted is true", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockLeathertypeEntity]);

      // Act
      await service.findAll(1, 10, undefined, true);

      // Assert
      expect(mockQueryBuilder.where).toHaveBeenCalledWith("1 = 1");
      expect(mockQueryBuilder.where).not.toHaveBeenCalledWith(
        "leathertype.deleted = 0",
      );
    });

    it("should search by name", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockLeathertypeEntity]);

      // Act
      await service.findAll(1, 10, "Grain");

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "leathertype.name ILIKE :search",
        { search: "%Grain%" },
      );
    });

    it("should handle pagination", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(25);
      mockQueryBuilder.getMany.mockResolvedValue([mockLeathertypeEntity]);

      // Act
      const result = await service.findAll(2, 10);

      // Assert
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.pages).toBe(3);
    });

    it("should apply proper ordering", async () => {
      // Arrange
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([mockLeathertypeEntity]);

      // Act
      await service.findAll();

      // Assert
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        "leathertype.sequence",
        "ASC",
      );
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        "leathertype.name",
        "ASC",
      );
    });

    it("should return empty array when no leathertypes found", async () => {
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
  });

  describe("update", () => {
    it("should update leathertype successfully", async () => {
      // Arrange
      const leathertypeId = 1;
      const updateDto: UpdateLeathertypeDto = {
        name: "Updated Leather",
        sequence: 10,
      };

      const updatedEntity = {
        ...mockLeathertypeEntity,
        ...updateDto,
      };

      repository.findOne
        .mockResolvedValueOnce(mockLeathertypeEntity)
        .mockResolvedValueOnce(null);
      repository.save.mockResolvedValue(updatedEntity as LeathertypeEntity);

      // Act
      const result = await service.update(leathertypeId, updateDto);

      // Assert
      expect(result).toMatchObject({
        name: updateDto.name,
        sequence: updateDto.sequence,
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it("should throw NotFoundException when leathertype not found", async () => {
      // Arrange
      const leathertypeId = 999;
      const updateDto: UpdateLeathertypeDto = { name: "New name" };
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(leathertypeId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("should check for name conflicts when updating name", async () => {
      // Arrange
      const leathertypeId = 1;
      const updateDto: UpdateLeathertypeDto = {
        name: "New Unique Name",
      };

      repository.findOne
        .mockResolvedValueOnce(mockLeathertypeEntity)
        .mockResolvedValueOnce(null);

      repository.save.mockResolvedValue({
        ...mockLeathertypeEntity,
        ...updateDto,
      } as LeathertypeEntity);

      // Act
      const result = await service.update(leathertypeId, updateDto);

      // Assert
      expect(result.name).toBe(updateDto.name);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: leathertypeId, deleted: 0 },
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          name: updateDto.name,
          deleted: 0,
        },
      });
    });

    it("should throw ConflictException when updating to existing name", async () => {
      // Arrange
      const leathertypeId = 1;
      const updateDto: UpdateLeathertypeDto = { name: "Existing Name" };
      const existingLeathertypeWithSameName = {
        ...mockLeathertypeEntity,
        id: 2,
        name: "Existing Name",
      };

      repository.findOne
        .mockResolvedValueOnce(mockLeathertypeEntity)
        .mockResolvedValueOnce(
          existingLeathertypeWithSameName as LeathertypeEntity,
        );

      // Act & Assert
      await expect(service.update(leathertypeId, updateDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("should not check for conflicts when name is not changed", async () => {
      // Arrange
      const leathertypeId = 1;
      const updateDto: UpdateLeathertypeDto = {
        sequence: 15,
      };

      repository.findOne.mockResolvedValue(mockLeathertypeEntity);
      repository.save.mockResolvedValue({
        ...mockLeathertypeEntity,
        ...updateDto,
      } as LeathertypeEntity);

      // Act
      await service.update(leathertypeId, updateDto);

      // Assert
      expect(repository.findOne).toHaveBeenCalledTimes(1);
      expect(repository.save).toHaveBeenCalled();
    });

    it("should update only provided fields", async () => {
      // Arrange
      const leathertypeId = 1;
      const updateDto: UpdateLeathertypeDto = {
        name: "Partially Updated",
      };

      repository.findOne
        .mockResolvedValueOnce(mockLeathertypeEntity)
        .mockResolvedValueOnce(null);
      repository.save.mockResolvedValue({
        ...mockLeathertypeEntity,
        name: updateDto.name,
      } as LeathertypeEntity);

      // Act
      await service.update(leathertypeId, updateDto);

      // Assert
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: updateDto.name,
          sequence: mockLeathertypeEntity.sequence,
        }),
      );
    });
  });

  describe("remove", () => {
    it("should soft delete leathertype successfully", async () => {
      // Arrange
      const leathertypeId = 1;
      repository.findOne.mockResolvedValue(mockLeathertypeEntity);
      repository.save.mockResolvedValue({
        ...mockLeathertypeEntity,
        deleted: 1,
      } as LeathertypeEntity);

      // Act
      await service.remove(leathertypeId);

      // Assert
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: leathertypeId, deleted: 0 },
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleted: 1 }),
      );
    });

    it("should throw NotFoundException when leathertype not found", async () => {
      // Arrange
      const leathertypeId = 999;
      repository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(leathertypeId)).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("findActiveLeathertypes", () => {
    it("should return all active leathertypes", async () => {
      // Arrange
      const activeLeathertypes = [mockLeathertypeEntity];
      repository.find.mockResolvedValue(activeLeathertypes);

      // Act
      const result = await service.findActiveLeathertypes();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockLeathertypeEntity.id,
        name: mockLeathertypeEntity.name,
      });
      expect(repository.find).toHaveBeenCalledWith({
        where: { deleted: 0 },
        order: { sequence: "ASC", name: "ASC" },
      });
    });

    it("should return empty array when no active leathertypes", async () => {
      // Arrange
      repository.find.mockResolvedValue([]);

      // Act
      const result = await service.findActiveLeathertypes();

      // Assert
      expect(result).toEqual([]);
    });

    it("should return leathertypes sorted by sequence and name", async () => {
      // Arrange
      const leathertypes = [
        { ...mockLeathertypeEntity, sequence: 2, name: "B Leather" },
        { ...mockLeathertypeEntity, sequence: 1, name: "A Leather" },
      ];
      repository.find.mockResolvedValue(leathertypes as LeathertypeEntity[]);

      // Act
      const result = await service.findActiveLeathertypes();

      // Assert
      expect(result).toHaveLength(2);
      expect(repository.find).toHaveBeenCalledWith({
        where: { deleted: 0 },
        order: { sequence: "ASC", name: "ASC" },
      });
    });
  });
});
