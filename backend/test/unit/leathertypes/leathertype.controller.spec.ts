import { Test, TestingModule } from "@nestjs/testing";
import { LeathertypeController } from "../../../src/leathertypes/leathertype.controller";
import { LeathertypeService } from "../../../src/leathertypes/leathertype.service";
import { CreateLeathertypeDto } from "../../../src/leathertypes/dto/create-leathertype.dto";
import { UpdateLeathertypeDto } from "../../../src/leathertypes/dto/update-leathertype.dto";
import { LeathertypeDto } from "../../../src/leathertypes/dto/leathertype.dto";

describe("LeathertypeController", () => {
  let controller: LeathertypeController;
  let service: jest.Mocked<LeathertypeService>;

  const mockLeathertypeDto: LeathertypeDto = {
    id: 1,
    name: "Full Grain Leather",
    sequence: 1,
    deleted: 0,
    isActive: true,
    displayName: "Full Grain Leather",
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findActiveLeathertypes: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeathertypeController],
      providers: [
        {
          provide: LeathertypeService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<LeathertypeController>(LeathertypeController);
    service = module.get(LeathertypeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new leathertype", async () => {
      // Arrange
      const createDto: CreateLeathertypeDto = {
        name: "New Leather",
        sequence: 5,
      };
      service.create.mockResolvedValue(mockLeathertypeDto);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(mockLeathertypeDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(service.create).toHaveBeenCalledTimes(1);
    });

    it("should create leathertype with minimal data", async () => {
      // Arrange
      const createDto: CreateLeathertypeDto = {
        name: "Simple Leather",
      };
      service.create.mockResolvedValue(mockLeathertypeDto);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(mockLeathertypeDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe("findAll", () => {
    it("should return paginated leathertypes with default parameters", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockLeathertypeDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        false,
      );
    });

    it("should pass pagination parameters to service", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockLeathertypeDto],
        total: 50,
        pages: 5,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      await controller.findAll(2, 10);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(2, 10, undefined, false);
    });

    it("should pass includeDeleted=true to the service", async () => {
      // Arrange
      service.findAll.mockResolvedValue({ data: [], total: 0, pages: 0 });

      // Act
      await controller.findAll(1, 10, undefined, "true");

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(1, 10, undefined, true);
    });

    it("should pass search parameter to service", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockLeathertypeDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      await controller.findAll(1, 10, "Grain");

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(1, 10, "Grain", false);
    });

    it("should return empty array when no leathertypes", async () => {
      // Arrange
      const emptyResult = {
        data: [],
        total: 0,
        pages: 0,
      };
      service.findAll.mockResolvedValue(emptyResult);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("findActiveLeathertypes", () => {
    it("should return all active leathertypes", async () => {
      // Arrange
      service.findActiveLeathertypes.mockResolvedValue([mockLeathertypeDto]);

      // Act
      const result = await controller.findActiveLeathertypes();

      // Assert
      expect(result).toEqual([mockLeathertypeDto]);
      expect(service.findActiveLeathertypes).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when no active leathertypes", async () => {
      // Arrange
      service.findActiveLeathertypes.mockResolvedValue([]);

      // Act
      const result = await controller.findActiveLeathertypes();

      // Assert
      expect(result).toEqual([]);
      expect(service.findActiveLeathertypes).toHaveBeenCalledTimes(1);
    });

    it("should return multiple active leathertypes", async () => {
      // Arrange
      const leathertypes = [
        mockLeathertypeDto,
        { ...mockLeathertypeDto, id: 2, name: "Suede Leather" },
      ];
      service.findActiveLeathertypes.mockResolvedValue(leathertypes);

      // Act
      const result = await controller.findActiveLeathertypes();

      // Assert
      expect(result).toHaveLength(2);
      expect(service.findActiveLeathertypes).toHaveBeenCalledTimes(1);
    });
  });

  describe("findOne", () => {
    it("should return leathertype by ID", async () => {
      // Arrange
      service.findOne.mockResolvedValue(mockLeathertypeDto);

      // Act
      const result = await controller.findOne(1);

      // Assert
      expect(result).toEqual(mockLeathertypeDto);
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(service.findOne).toHaveBeenCalledTimes(1);
    });

    it("should handle different ID values", async () => {
      // Arrange
      const differentLeathertype = { ...mockLeathertypeDto, id: 999 };
      service.findOne.mockResolvedValue(differentLeathertype);

      // Act
      const result = await controller.findOne(999);

      // Assert
      expect(result.id).toBe(999);
      expect(service.findOne).toHaveBeenCalledWith(999);
    });
  });

  describe("update", () => {
    it("should update leathertype", async () => {
      // Arrange
      const updateDto: UpdateLeathertypeDto = {
        name: "Updated Leather",
        sequence: 10,
      };
      const updatedLeathertype = { ...mockLeathertypeDto, ...updateDto };
      service.update.mockResolvedValue(updatedLeathertype);

      // Act
      const result = await controller.update(1, updateDto);

      // Assert
      expect(result).toEqual(updatedLeathertype);
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
      expect(service.update).toHaveBeenCalledTimes(1);
    });

    it("should update with partial data", async () => {
      // Arrange
      const updateDto: UpdateLeathertypeDto = {
        sequence: 15,
      };
      const updatedLeathertype = { ...mockLeathertypeDto, sequence: 15 };
      service.update.mockResolvedValue(updatedLeathertype);

      // Act
      const result = await controller.update(1, updateDto);

      // Assert
      expect(result.sequence).toBe(15);
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });

    it("should update only name", async () => {
      // Arrange
      const updateDto: UpdateLeathertypeDto = {
        name: "Premium Leather",
      };
      const updatedLeathertype = {
        ...mockLeathertypeDto,
        name: "Premium Leather",
      };
      service.update.mockResolvedValue(updatedLeathertype);

      // Act
      const result = await controller.update(1, updateDto);

      // Assert
      expect(result.name).toBe("Premium Leather");
    });
  });

  describe("remove", () => {
    it("should remove leathertype", async () => {
      // Arrange
      service.remove.mockResolvedValue(undefined);

      // Act
      await controller.remove(1);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(1);
      expect(service.remove).toHaveBeenCalledTimes(1);
    });

    it("should handle removal of different IDs", async () => {
      // Arrange
      service.remove.mockResolvedValue(undefined);

      // Act
      await controller.remove(999);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(999);
    });
  });
});
