import { Test, TestingModule } from "@nestjs/testing";
import { FitterController } from "../../../src/fitters/fitter.controller";
import { FitterService } from "../../../src/fitters/fitter.service";
import { FitterDto } from "../../../src/fitters/dto/fitter.dto";
import { CreateFitterDto } from "../../../src/fitters/dto/create-fitter.dto";
import { UpdateFitterDto } from "../../../src/fitters/dto/update-fitter.dto";

describe("FitterController", () => {
  let controller: FitterController;
  let service: jest.Mocked<FitterService>;

  const mockFitterDto: FitterDto = {
    id: 1,
    userId: 100,
    address: "123 Main St",
    zipcode: "12345",
    state: "California",
    city: "Los Angeles",
    country: "United States",
    phoneNo: "555-1234",
    cellNo: "555-5678",
    currency: 1,
    emailaddress: "fitter@example.com",
    deleted: 0,
    isActive: true,
    fullAddress: "123 Main St, Los Angeles, California, 12345, United States",
    displayName: "Fitter in Los Angeles",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FitterController],
      providers: [
        {
          provide: FitterService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findActiveFitters: jest.fn(),
            findByCountry: jest.fn(),
            findByCity: jest.fn(),
            getCountByCountry: jest.fn(),
            getActiveCount: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FitterController>(FitterController);
    service = module.get(FitterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should create a new fitter", async () => {
      // Arrange
      const createDto: CreateFitterDto = {
        userId: 100,
        city: "Los Angeles",
        country: "United States",
      };
      service.create.mockResolvedValue(mockFitterDto);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockFitterDto);
    });
  });

  describe("findAll", () => {
    it("should return paginated fitters", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockFitterDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(paginatedResult);
    });

    it("should pass pagination parameters", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockFitterDto],
        total: 10,
        pages: 2,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      const result = await controller.findAll(2, 5);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(
        2,
        5,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      expect(result.pages).toBe(2);
    });

    it("should pass filter parameters", async () => {
      // Arrange
      const paginatedResult = {
        data: [mockFitterDto],
        total: 1,
        pages: 1,
      };
      service.findAll.mockResolvedValue(paginatedResult);

      // Act
      await controller.findAll(1, 10, "Los Angeles", "United States");

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(
        1,
        10,
        "Los Angeles",
        "United States",
        undefined,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe("findActive", () => {
    it("should return active fitters", async () => {
      // Arrange
      service.findActiveFitters.mockResolvedValue([mockFitterDto]);

      // Act
      const result = await controller.findActive();

      // Assert
      expect(service.findActiveFitters).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });

    it("should return empty array when no active fitters", async () => {
      // Arrange
      service.findActiveFitters.mockResolvedValue([]);

      // Act
      const result = await controller.findActive();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findByCountry", () => {
    it("should return fitters by country", async () => {
      // Arrange
      service.findByCountry.mockResolvedValue([mockFitterDto]);

      // Act
      const result = await controller.findByCountry("United States");

      // Assert
      expect(service.findByCountry).toHaveBeenCalledWith("United States");
      expect(result).toHaveLength(1);
      expect(result[0].country).toBe("United States");
    });

    it("should return empty array when no fitters in country", async () => {
      // Arrange
      service.findByCountry.mockResolvedValue([]);

      // Act
      const result = await controller.findByCountry("Canada");

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findByCity", () => {
    it("should return fitters by city", async () => {
      // Arrange
      service.findByCity.mockResolvedValue([mockFitterDto]);

      // Act
      const result = await controller.findByCity("Los Angeles");

      // Assert
      expect(service.findByCity).toHaveBeenCalledWith("Los Angeles");
      expect(result).toHaveLength(1);
      expect(result[0].city).toBe("Los Angeles");
    });

    it("should return empty array when no fitters in city", async () => {
      // Arrange
      service.findByCity.mockResolvedValue([]);

      // Act
      const result = await controller.findByCity("New York");

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getCountByCountry", () => {
    it("should return fitter count by country", async () => {
      // Arrange
      service.getCountByCountry.mockResolvedValue(5);

      // Act
      const result = await controller.getCountByCountry("United States");

      // Assert
      expect(service.getCountByCountry).toHaveBeenCalledWith("United States");
      expect(result).toEqual({ count: 5 });
    });

    it("should return 0 when no fitters in country", async () => {
      // Arrange
      service.getCountByCountry.mockResolvedValue(0);

      // Act
      const result = await controller.getCountByCountry("Canada");

      // Assert
      expect(result).toEqual({ count: 0 });
    });
  });

  describe("getActiveCount", () => {
    it("should return active fitter count", async () => {
      // Arrange
      service.getActiveCount.mockResolvedValue(10);

      // Act
      const result = await controller.getActiveCount();

      // Assert
      expect(service.getActiveCount).toHaveBeenCalled();
      expect(result).toEqual({ count: 10 });
    });

    it("should return 0 when no active fitters", async () => {
      // Arrange
      service.getActiveCount.mockResolvedValue(0);

      // Act
      const result = await controller.getActiveCount();

      // Assert
      expect(result).toEqual({ count: 0 });
    });
  });

  describe("findOne", () => {
    it("should return a fitter by id", async () => {
      // Arrange
      service.findOne.mockResolvedValue(mockFitterDto);

      // Act
      const result = await controller.findOne(1);

      // Assert
      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockFitterDto);
    });
  });

  describe("update", () => {
    it("should update a fitter", async () => {
      // Arrange
      const updateDto: UpdateFitterDto = {
        city: "San Francisco",
      };
      const updatedFitter = { ...mockFitterDto, city: "San Francisco" };
      service.update.mockResolvedValue(updatedFitter);

      // Act
      const result = await controller.update(1, updateDto);

      // Assert
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
      expect(result.city).toBe("San Francisco");
    });
  });

  describe("remove", () => {
    it("should remove a fitter", async () => {
      // Arrange
      service.remove.mockResolvedValue(undefined);

      // Act
      await controller.remove(1);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
