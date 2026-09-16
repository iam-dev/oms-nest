import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ConflictException } from "@nestjs/common";
import { OptionController } from "../../../src/options/option.controller";
import { OptionService } from "../../../src/options/option.service";
import { CreateOptionDto } from "../../../src/options/dto/create-option.dto";
import { UpdateOptionDto } from "../../../src/options/dto/update-option.dto";
import { OptionDto } from "../../../src/options/dto/option.dto";

describe("OptionController", () => {
  let controller: OptionController;
  let service: jest.Mocked<OptionService>;

  const mockOptionDto: OptionDto = {
    id: 1,
    name: "Premium Stitching",
    group: "Stitching",
    type: 1,
    price1: 50,
    price2: 55,
    price3: 60,
    price4: 65,
    price5: 70,
    price6: 75,
    price7: 80,
    priceContrast1: 10,
    priceContrast2: 12,
    priceContrast3: 14,
    priceContrast4: 16,
    priceContrast5: 18,
    priceContrast6: 20,
    priceContrast7: 22,
    sequence: 1,
    extraAllowed: 1,
    deleted: 0,
    isActive: true,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findActiveOptions: jest.fn(),
      findByGroup: jest.fn(),
      findByType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OptionController],
      providers: [{ provide: OptionService, useValue: mockService }],
    }).compile();

    controller = module.get<OptionController>(OptionController);
    service = module.get(OptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new option successfully", async () => {
      // Arrange
      const createDto: CreateOptionDto = {
        name: "Premium Stitching",
        group: "Stitching",
        type: 1,
        price1: 50,
      };
      service.create.mockResolvedValue(mockOptionDto);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(mockOptionDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it("should handle conflict when option name already exists", async () => {
      // Arrange
      const createDto: CreateOptionDto = {
        name: "Existing Option",
        group: "Stitching",
      };
      service.create.mockRejectedValue(
        new ConflictException("Option with this name already exists"),
      );

      // Act & Assert
      await expect(controller.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("findAll", () => {
    it("should return all options with pagination", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockOptionDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll(1, 10);

      // Assert
      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });

    it("should pass excludeType through to the service", async () => {
      // Arrange
      service.findAll.mockResolvedValue({ data: [], total: 0, pages: 0 });

      // Act
      await controller.findAll(1, 10, undefined, undefined, undefined, 2);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        undefined,
        2,
      );
    });

    it("should filter by search term", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockOptionDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      await controller.findAll(1, 10, "Premium");

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(
        1,
        10,
        "Premium",
        undefined,
        undefined,
        undefined,
      );
    });

    it("should filter by group", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockOptionDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      await controller.findAll(1, 10, undefined, "Stitching");

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        "Stitching",
        undefined,
        undefined,
      );
    });

    it("should filter by type", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockOptionDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      await controller.findAll(1, 10, undefined, undefined, 1);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(
        1,
        10,
        undefined,
        undefined,
        1,
        undefined,
      );
    });

    it("should filter by all parameters", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockOptionDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      await controller.findAll(1, 10, "Premium", "Stitching", 1);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(
        1,
        10,
        "Premium",
        "Stitching",
        1,
        undefined,
      );
    });
  });

  describe("findActiveOptions", () => {
    it("should return all active options", async () => {
      // Arrange
      const activeOptions = [mockOptionDto];
      service.findActiveOptions.mockResolvedValue(activeOptions);

      // Act
      const result = await controller.findActiveOptions();

      // Assert
      expect(result).toEqual(activeOptions);
      expect(service.findActiveOptions).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no active options", async () => {
      // Arrange
      service.findActiveOptions.mockResolvedValue([]);

      // Act
      const result = await controller.findActiveOptions();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findByGroup", () => {
    it("should return options for a specific group", async () => {
      // Arrange
      const group = "Stitching";
      const options = [mockOptionDto];
      service.findByGroup.mockResolvedValue(options);

      // Act
      const result = await controller.findByGroup(group);

      // Assert
      expect(result).toEqual(options);
      expect(service.findByGroup).toHaveBeenCalledWith(group);
    });

    it("should return empty array when no options in group", async () => {
      // Arrange
      const group = "NonExistent";
      service.findByGroup.mockResolvedValue([]);

      // Act
      const result = await controller.findByGroup(group);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findByType", () => {
    it("should return options for a specific type", async () => {
      // Arrange
      const type = 1;
      const options = [mockOptionDto];
      service.findByType.mockResolvedValue(options);

      // Act
      const result = await controller.findByType(type);

      // Assert
      expect(result).toEqual(options);
      expect(service.findByType).toHaveBeenCalledWith(type);
    });

    it("should return empty array when no options of type", async () => {
      // Arrange
      const type = 999;
      service.findByType.mockResolvedValue([]);

      // Act
      const result = await controller.findByType(type);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findOne", () => {
    it("should return option by ID", async () => {
      // Arrange
      const optionId = 1;
      service.findOne.mockResolvedValue(mockOptionDto);

      // Act
      const result = await controller.findOne(optionId);

      // Assert
      expect(result).toEqual(mockOptionDto);
      expect(service.findOne).toHaveBeenCalledWith(optionId);
    });

    it("should handle option not found", async () => {
      // Arrange
      const optionId = 999;
      service.findOne.mockRejectedValue(
        new NotFoundException("Option not found"),
      );

      // Act & Assert
      await expect(controller.findOne(optionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("should update option successfully", async () => {
      // Arrange
      const optionId = 1;
      const updateDto: UpdateOptionDto = {
        name: "Updated Option Name",
        price1: 100,
      };
      const updatedOption = { ...mockOptionDto, ...updateDto };
      service.update.mockResolvedValue(updatedOption);

      // Act
      const result = await controller.update(optionId, updateDto);

      // Assert
      expect(result).toEqual(updatedOption);
      expect(service.update).toHaveBeenCalledWith(optionId, updateDto);
    });

    it("should handle option not found during update", async () => {
      // Arrange
      const optionId = 999;
      const updateDto: UpdateOptionDto = { name: "New Name" };
      service.update.mockRejectedValue(
        new NotFoundException("Option not found"),
      );

      // Act & Assert
      await expect(controller.update(optionId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should handle name conflict during update", async () => {
      // Arrange
      const optionId = 1;
      const updateDto: UpdateOptionDto = {
        name: "Existing Name",
      };
      service.update.mockRejectedValue(
        new ConflictException("Option with this name already exists"),
      );

      // Act & Assert
      await expect(controller.update(optionId, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("remove", () => {
    it("should remove option successfully", async () => {
      // Arrange
      const optionId = 1;
      service.remove.mockResolvedValue();

      // Act
      await controller.remove(optionId);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(optionId);
      expect(service.remove).toHaveBeenCalledTimes(1);
    });

    it("should handle option not found during removal", async () => {
      // Arrange
      const optionId = 999;
      service.remove.mockRejectedValue(
        new NotFoundException("Option not found"),
      );

      // Act & Assert
      await expect(controller.remove(optionId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
