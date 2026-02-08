import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { ExtraService } from "../../../src/extras/extra.service";
import { IExtraRepository } from "../../../src/extras/domain/extra.repository";
import { Extra } from "../../../src/extras/domain/extra";
import { ExtraId } from "../../../src/extras/domain/value-objects/extra-id.value-object";
import { CreateExtraDto } from "../../../src/extras/dto/create-extra.dto";
import { UpdateExtraDto } from "../../../src/extras/dto/update-extra.dto";

describe("ExtraService", () => {
  let service: ExtraService;
  let repository: jest.Mocked<IExtraRepository>;

  const mockExtraId = ExtraId.fromString(
    "123e4567-e89b-12d3-a456-426614174000",
  );
  const mockExtra = new Extra(
    mockExtraId,
    "Complete Re-Flock",
    "Complete re-flocking service",
    250,
    150,
    135,
    290,
    290,
    0,
    0,
    1,
    new Date("2024-01-01"),
    new Date("2024-01-01"),
    null,
  );

  beforeEach(async () => {
    const mockRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtraService,
        {
          provide: IExtraRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ExtraService>(ExtraService);
    repository = module.get(IExtraRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new extra successfully", async () => {
      const createDto: CreateExtraDto = {
        name: "New Extra",
        description: "New description",
        price1: 100,
        price2: 80,
        price3: 70,
        price4: 120,
        price5: 120,
        sequence: 2,
      };

      repository.findByName.mockResolvedValue(null);
      repository.save.mockImplementation((extra: Extra) =>
        Promise.resolve(extra),
      );

      const result = await service.create(createDto);

      expect(result).toMatchObject({
        name: createDto.name,
        price1: createDto.price1,
        price2: createDto.price2,
      });
      expect(repository.findByName).toHaveBeenCalledWith(createDto.name);
      expect(repository.save).toHaveBeenCalled();
    });

    it("should default missing prices to 0", async () => {
      const createDto: CreateExtraDto = {
        name: "Minimal Extra",
        price1: 50,
      };

      repository.findByName.mockResolvedValue(null);
      repository.save.mockImplementation((extra: Extra) =>
        Promise.resolve(extra),
      );

      const result = await service.create(createDto);

      expect(result.price1).toBe(50);
      expect(result.price2).toBe(0);
      expect(result.price3).toBe(0);
      expect(result.price4).toBe(0);
      expect(result.price5).toBe(0);
      expect(result.price6).toBe(0);
      expect(result.price7).toBe(0);
      expect(result.sequence).toBe(0);
    });

    it("should throw ConflictException when extra name already exists", async () => {
      const createDto: CreateExtraDto = {
        name: "Existing Extra",
      };

      repository.findByName.mockResolvedValue(mockExtra);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should find extra by UUID", async () => {
      repository.findById.mockResolvedValue(mockExtra);

      const result = await service.findOne(mockExtraId.value);

      expect(result).toMatchObject({
        id: mockExtra.id.value,
        name: mockExtra.name,
        price1: mockExtra.price1,
      });
      expect(repository.findById).toHaveBeenCalled();
    });

    it("should throw NotFoundException when extra not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findOne("999e4567-e89b-12d3-a456-426614174000"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll", () => {
    it("should return paginated extras with default parameters", async () => {
      repository.findAll.mockResolvedValue({
        extras: [mockExtra],
        total: 1,
      });

      const result = await service.findAll();

      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: mockExtra.id.value,
            name: mockExtra.name,
            price1: mockExtra.price1,
          }),
        ]),
        total: 1,
        pages: 1,
      });
      expect(repository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: undefined,
      });
    });

    it("should search by name", async () => {
      repository.findAll.mockResolvedValue({
        extras: [mockExtra],
        total: 1,
      });

      const result = await service.findAll(1, 10, "Flock");

      expect(result.data).toHaveLength(1);
      expect(repository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: "Flock",
      });
    });

    it("should handle pagination", async () => {
      repository.findAll.mockResolvedValue({
        extras: [mockExtra],
        total: 25,
      });

      const result = await service.findAll(2, 10);

      expect(result.pages).toBe(3);
      expect(repository.findAll).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        search: undefined,
      });
    });

    it("should return empty array when no extras found", async () => {
      repository.findAll.mockResolvedValue({ extras: [], total: 0 });

      const result = await service.findAll();

      expect(result).toEqual({ data: [], total: 0, pages: 0 });
    });
  });

  describe("update", () => {
    it("should update extra prices successfully", async () => {
      const updateDto: UpdateExtraDto = {
        price1: 300,
        price2: 200,
      };

      const updatedExtra = new Extra(
        mockExtraId,
        mockExtra.name,
        mockExtra.description,
        300,
        200,
        mockExtra.price3,
        mockExtra.price4,
        mockExtra.price5,
        mockExtra.price6,
        mockExtra.price7,
        mockExtra.sequence,
        mockExtra.createdAt,
        new Date(),
        null,
      );

      repository.findById.mockResolvedValue(mockExtra);
      repository.save.mockResolvedValue(updatedExtra);

      const result = await service.update(mockExtraId.value, updateDto);

      expect(result).toMatchObject({
        price1: 300,
        price2: 200,
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it("should throw NotFoundException when extra not found", async () => {
      const updateDto: UpdateExtraDto = { name: "New name" };
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update("999e4567-e89b-12d3-a456-426614174000", updateDto),
      ).rejects.toThrow(NotFoundException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("should check for name conflicts when updating name", async () => {
      const updateDto: UpdateExtraDto = { name: "New Unique Name" };

      repository.findById.mockResolvedValue(mockExtra);
      repository.findByName.mockResolvedValue(null);
      repository.save.mockImplementation((extra: Extra) =>
        Promise.resolve(extra),
      );

      const result = await service.update(mockExtraId.value, updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(repository.findByName).toHaveBeenCalledWith("New Unique Name");
    });

    it("should throw ConflictException when updating to existing name", async () => {
      const updateDto: UpdateExtraDto = { name: "Existing Name" };
      const existingExtra = new Extra(
        ExtraId.fromString("999e4567-e89b-12d3-a456-426614174000"),
        "Existing Name",
        null,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        new Date(),
        new Date(),
        null,
      );

      repository.findById.mockResolvedValue(mockExtra);
      repository.findByName.mockResolvedValue(existingExtra);

      await expect(
        service.update(mockExtraId.value, updateDto),
      ).rejects.toThrow(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it("should not check for conflicts when name is not changed", async () => {
      const updateDto: UpdateExtraDto = { price1: 999, sequence: 5 };

      repository.findById.mockResolvedValue(mockExtra);
      repository.save.mockImplementation((extra: Extra) =>
        Promise.resolve(extra),
      );

      await service.update(mockExtraId.value, updateDto);

      expect(repository.findByName).not.toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should soft delete extra successfully", async () => {
      repository.findById.mockResolvedValue(mockExtra);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove(mockExtraId.value);

      expect(repository.findById).toHaveBeenCalled();
      expect(repository.softDelete).toHaveBeenCalled();
    });

    it("should throw NotFoundException when extra not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.remove("999e4567-e89b-12d3-a456-426614174000"),
      ).rejects.toThrow(NotFoundException);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe("findActiveExtras", () => {
    it("should return all active extras", async () => {
      repository.findActive.mockResolvedValue([mockExtra]);

      const result = await service.findActiveExtras();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockExtra.id.value,
        name: mockExtra.name,
        price1: mockExtra.price1,
      });
      expect(repository.findActive).toHaveBeenCalled();
    });

    it("should return empty array when no active extras", async () => {
      repository.findActive.mockResolvedValue([]);

      const result = await service.findActiveExtras();

      expect(result).toEqual([]);
    });
  });
});
