import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { SaddleLeatherController } from "../../../src/saddle-leathers/saddle-leather.controller";
import { SaddleLeatherService } from "../../../src/saddle-leathers/saddle-leather.service";
import { CreateSaddleLeatherDto } from "../../../src/saddle-leathers/dto/create-saddle-leather.dto";
import { UpdateSaddleLeatherDto } from "../../../src/saddle-leathers/dto/update-saddle-leather.dto";
import { SaddleLeatherDto } from "../../../src/saddle-leathers/dto/saddle-leather.dto";

describe("SaddleLeatherController", () => {
  let controller: SaddleLeatherController;
  let service: jest.Mocked<SaddleLeatherService>;

  const mockSaddleLeatherDto: SaddleLeatherDto = {
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
    isActive: true,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findBySaddleId: jest.fn(),
      findByLeatherId: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaddleLeatherController],
      providers: [{ provide: SaddleLeatherService, useValue: mockService }],
    }).compile();

    controller = module.get<SaddleLeatherController>(SaddleLeatherController);
    service = module.get(SaddleLeatherService);
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
      };
      service.create.mockResolvedValue(mockSaddleLeatherDto);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(mockSaddleLeatherDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it("should handle conflict when association already exists", async () => {
      // Arrange
      const createDto: CreateSaddleLeatherDto = {
        saddleId: 100,
        leatherId: 50,
      };
      service.create.mockRejectedValue(
        new ConflictException("Saddle-leather association already exists"),
      );

      // Act & Assert
      await expect(controller.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("findAll", () => {
    it("should return all associations with pagination", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockSaddleLeatherDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll(1, 10);

      // Assert
      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(1, 10, undefined, undefined);
    });

    it("should filter by saddleId", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockSaddleLeatherDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      await controller.findAll(1, 10, 100);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(1, 10, 100, undefined);
    });

    it("should filter by leatherId", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockSaddleLeatherDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      await controller.findAll(1, 10, undefined, 50);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(1, 10, undefined, 50);
    });
  });

  describe("findBySaddleId", () => {
    it("should return associations for a specific saddle", async () => {
      // Arrange
      const saddleId = 100;
      const associations = [mockSaddleLeatherDto];
      service.findBySaddleId.mockResolvedValue(associations);

      // Act
      const result = await controller.findBySaddleId(saddleId);

      // Assert
      expect(result).toEqual(associations);
      expect(service.findBySaddleId).toHaveBeenCalledWith(saddleId, false);
    });

    it("should pass includeDeleted=true through to the service", async () => {
      // Arrange
      service.findBySaddleId.mockResolvedValue([]);

      // Act
      await controller.findBySaddleId(100, "true");

      // Assert
      expect(service.findBySaddleId).toHaveBeenCalledWith(100, true);
    });
  });

  describe("findByLeatherId", () => {
    it("should return associations for a specific leather", async () => {
      // Arrange
      const leatherId = 50;
      const associations = [mockSaddleLeatherDto];
      service.findByLeatherId.mockResolvedValue(associations);

      // Act
      const result = await controller.findByLeatherId(leatherId);

      // Assert
      expect(result).toEqual(associations);
      expect(service.findByLeatherId).toHaveBeenCalledWith(leatherId);
    });
  });

  describe("findOne", () => {
    it("should return association by ID", async () => {
      // Arrange
      const id = 1;
      service.findOne.mockResolvedValue(mockSaddleLeatherDto);

      // Act
      const result = await controller.findOne(id);

      // Assert
      expect(result).toEqual(mockSaddleLeatherDto);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });

    it("should handle association not found", async () => {
      // Arrange
      const id = 999;
      service.findOne.mockRejectedValue(
        new NotFoundException("Saddle-leather association not found"),
      );

      // Act & Assert
      await expect(controller.findOne(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("should update association successfully", async () => {
      // Arrange
      const id = 1;
      const updateDto: UpdateSaddleLeatherDto = {
        price1: 2000,
        sequence: 5,
      };
      const updatedAssociation = { ...mockSaddleLeatherDto, ...updateDto };
      service.update.mockResolvedValue(updatedAssociation);

      // Act
      const result = await controller.update(id, updateDto);

      // Assert
      expect(result).toEqual(updatedAssociation);
      expect(service.update).toHaveBeenCalledWith(id, updateDto);
    });

    it("should handle association not found during update", async () => {
      // Arrange
      const id = 999;
      const updateDto: UpdateSaddleLeatherDto = { price1: 2000 };
      service.update.mockRejectedValue(
        new NotFoundException("Saddle-leather association not found"),
      );

      // Act & Assert
      await expect(controller.update(id, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("remove", () => {
    it("should remove association successfully", async () => {
      // Arrange
      const id = 1;
      service.remove.mockResolvedValue();

      // Act
      await controller.remove(id);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(id);
      expect(service.remove).toHaveBeenCalledTimes(1);
    });

    it("should handle association not found during removal", async () => {
      // Arrange
      const id = 999;
      service.remove.mockRejectedValue(
        new NotFoundException("Saddle-leather association not found"),
      );

      // Act & Assert
      await expect(controller.remove(id)).rejects.toThrow(NotFoundException);
    });
  });
});
