import { Test, TestingModule } from "@nestjs/testing";
import { SaddleExtraController } from "../../../src/saddle-extras/saddle-extra.controller";
import { SaddleExtraService } from "../../../src/saddle-extras/saddle-extra.service";
import { CreateSaddleExtraDto } from "../../../src/saddle-extras/dto/create-saddle-extra.dto";
import { UpdateSaddleExtraDto } from "../../../src/saddle-extras/dto/update-saddle-extra.dto";
import { SaddleExtraDto } from "../../../src/saddle-extras/dto/saddle-extra.dto";

describe("SaddleExtraController", () => {
  let controller: SaddleExtraController;
  let service: jest.Mocked<SaddleExtraService>;

  const mockSaddleExtraDto: SaddleExtraDto = {
    id: 1,
    saddleId: 100,
    extraId: 5,
    deleted: 0,
    isActive: true,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findBySaddleId: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaddleExtraController],
      providers: [{ provide: SaddleExtraService, useValue: mockService }],
    }).compile();

    controller = module.get<SaddleExtraController>(SaddleExtraController);
    service = module.get(SaddleExtraService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should call service.create and return result", async () => {
      // Arrange
      const createDto: CreateSaddleExtraDto = {
        saddleId: 100,
        extraId: 5,
      };
      service.create.mockResolvedValue(mockSaddleExtraDto);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(mockSaddleExtraDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("findAll", () => {
    it("should call service.findAll with query params", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockSaddleExtraDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll(1, 10, 100, 5);

      // Assert
      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(1, 10, 100, 5);
    });
  });

  describe("findBySaddleId", () => {
    it("should call service.findBySaddleId", async () => {
      // Arrange
      const associations = [mockSaddleExtraDto];
      service.findBySaddleId.mockResolvedValue(associations);

      // Act
      const result = await controller.findBySaddleId(100);

      // Assert
      expect(result).toEqual(associations);
      expect(service.findBySaddleId).toHaveBeenCalledWith(100);
    });
  });

  describe("findOne", () => {
    it("should call service.findOne", async () => {
      // Arrange
      service.findOne.mockResolvedValue(mockSaddleExtraDto);

      // Act
      const result = await controller.findOne(1);

      // Assert
      expect(result).toEqual(mockSaddleExtraDto);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe("update", () => {
    it("should call service.update", async () => {
      // Arrange
      const updateDto: UpdateSaddleExtraDto = { saddleId: 200 };
      const updatedDto = { ...mockSaddleExtraDto, saddleId: 200 };
      service.update.mockResolvedValue(updatedDto);

      // Act
      const result = await controller.update(1, updateDto);

      // Assert
      expect(result).toEqual(updatedDto);
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe("remove", () => {
    it("should call service.remove", async () => {
      // Arrange
      service.remove.mockResolvedValue();

      // Act
      await controller.remove(1);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(1);
      expect(service.remove).toHaveBeenCalledTimes(1);
    });
  });
});
