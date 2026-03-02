import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { FitterService } from "../../../src/fitters/fitter.service";
import { IFitterRepository } from "../../../src/fitters/domain/fitter.repository";
import { Fitter } from "../../../src/fitters/domain/fitter";
import { UserEntity } from "../../../src/users/infrastructure/persistence/relational/entities/user.entity";
import { MailService } from "../../../src/mail/mail.service";

describe("FitterService", () => {
  let service: FitterService;
  let repository: jest.Mocked<IFitterRepository>;

  const mockFitter = new Fitter(
    1,
    100,
    "123 Main St",
    "12345",
    "California",
    "Los Angeles",
    "United States",
    "555-1234",
    "555-5678",
    1,
    "fitter@example.com",
    0,
  );

  beforeEach(async () => {
    const mockRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findAllPaginated: jest.fn(),
      findActive: jest.fn(),
      findByCountry: jest.fn(),
      findByCity: jest.fn(),
      countByCountry: jest.fn(),
      countActive: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FitterService,
        {
          provide: IFitterRepository,
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: MailService,
          useValue: {
            welcomeFitter: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue("mock-hash"),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("test-value"),
            getOrThrow: jest.fn().mockReturnValue("30m"),
          },
        },
      ],
    }).compile();

    service = module.get<FitterService>(FitterService);
    repository = module.get(IFitterRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a new fitter successfully", async () => {
      const createDto = {
        userId: 100,
        address: "123 Main St",
        city: "Los Angeles",
        country: "United States",
      };
      repository.save.mockResolvedValue(mockFitter);

      const result = await service.create(createDto);

      expect(repository.save).toHaveBeenCalled();
      expect(result.id).toBe(1);
      expect(result.city).toBe("Los Angeles");
    });

    it("should create fitter with all fields", async () => {
      const createDto = {
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
      };
      repository.save.mockResolvedValue(mockFitter);

      const result = await service.create(createDto);

      expect(repository.save).toHaveBeenCalled();
      expect(result.emailaddress).toBe("fitter@example.com");
    });
  });

  describe("findOne", () => {
    it("should find a fitter by id", async () => {
      repository.findById.mockResolvedValue(mockFitter);

      const result = await service.findOne(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
      expect(result.city).toBe("Los Angeles");
    });

    it("should throw NotFoundException when fitter not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow("Fitter not found");
    });
  });

  describe("findAll", () => {
    it("should find all fitters with pagination", async () => {
      repository.findAllPaginated.mockResolvedValue({
        fitters: [mockFitter],
        total: 1,
      });

      const result = await service.findAll(1, 10);

      expect(repository.findAllPaginated).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        city: undefined,
        country: undefined,
      });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.pages).toBe(1);
    });

    it("should filter by city", async () => {
      repository.findAllPaginated.mockResolvedValue({
        fitters: [mockFitter],
        total: 1,
      });

      const result = await service.findAll(1, 10, "Los Angeles");

      expect(repository.findAllPaginated).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        city: "Los Angeles",
        country: undefined,
      });
      expect(result.data).toHaveLength(1);
    });

    it("should filter by country", async () => {
      repository.findAllPaginated.mockResolvedValue({
        fitters: [mockFitter],
        total: 1,
      });

      const result = await service.findAll(1, 10, undefined, "United States");

      expect(repository.findAllPaginated).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        city: undefined,
        country: "United States",
      });
      expect(result.data).toHaveLength(1);
    });

    it("should filter by both city and country", async () => {
      repository.findAllPaginated.mockResolvedValue({
        fitters: [mockFitter],
        total: 1,
      });

      const result = await service.findAll(
        1,
        10,
        "Los Angeles",
        "United States",
      );

      expect(repository.findAllPaginated).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        city: "Los Angeles",
        country: "United States",
      });
      expect(result.data).toHaveLength(1);
    });

    it("should handle pagination correctly", async () => {
      repository.findAllPaginated.mockResolvedValue({
        fitters: [mockFitter],
        total: 25,
      });

      const result = await service.findAll(2, 10);

      expect(repository.findAllPaginated).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        city: undefined,
        country: undefined,
      });
      expect(result.pages).toBe(3);
    });
  });

  describe("update", () => {
    it("should update a fitter successfully", async () => {
      const updateDto = {
        city: "San Francisco",
        state: "California",
      };
      const updatedFitter = new Fitter(
        1,
        100,
        "123 Main St",
        "12345",
        "California",
        "San Francisco",
        "United States",
        "555-1234",
        "555-5678",
        1,
        "fitter@example.com",
        0,
      );
      repository.findById.mockResolvedValue(mockFitter);
      repository.save.mockResolvedValue(updatedFitter);

      const result = await service.update(1, updateDto);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(repository.save).toHaveBeenCalled();
      expect(result.city).toBe("San Francisco");
    });

    it("should update only provided fields", async () => {
      const updateDto = { phoneNo: "555-9999" };
      const updatedFitter = new Fitter(
        1,
        100,
        "123 Main St",
        "12345",
        "California",
        "Los Angeles",
        "United States",
        "555-9999",
        "555-5678",
        1,
        "fitter@example.com",
        0,
      );
      repository.findById.mockResolvedValue(mockFitter);
      repository.save.mockResolvedValue(updatedFitter);

      const result = await service.update(1, updateDto);

      expect(result.phoneNo).toBe("555-9999");
      expect(result.city).toBe("Los Angeles");
    });

    it("should throw NotFoundException when fitter not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(999, { city: "New York" })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("remove", () => {
    it("should soft delete a fitter", async () => {
      repository.findById.mockResolvedValue(mockFitter);
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove(1);

      expect(repository.findById).toHaveBeenCalledWith(1);
      expect(repository.softDelete).toHaveBeenCalledWith(1);
    });

    it("should throw NotFoundException when fitter not found", async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByUserId", () => {
    it("should find fitter by user id", async () => {
      repository.findByUserId.mockResolvedValue(mockFitter);

      const result = await service.findByUserId(100);

      expect(repository.findByUserId).toHaveBeenCalledWith(100);
      expect(result).toBeDefined();
      expect(result!.userId).toBe(100);
    });

    it("should return null when fitter not found", async () => {
      repository.findByUserId.mockResolvedValue(null);

      const result = await service.findByUserId(999);

      expect(result).toBeNull();
    });
  });

  describe("findActiveFitters", () => {
    it("should find all active fitters", async () => {
      repository.findActive.mockResolvedValue([mockFitter]);

      const result = await service.findActiveFitters();

      expect(repository.findActive).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it("should return empty array when no active fitters", async () => {
      repository.findActive.mockResolvedValue([]);

      const result = await service.findActiveFitters();

      expect(result).toEqual([]);
    });
  });

  describe("findByCountry", () => {
    it("should find fitters by country", async () => {
      repository.findByCountry.mockResolvedValue([mockFitter]);

      const result = await service.findByCountry("United States");

      expect(repository.findByCountry).toHaveBeenCalledWith("United States");
      expect(result).toHaveLength(1);
    });

    it("should return empty array when no fitters in country", async () => {
      repository.findByCountry.mockResolvedValue([]);

      const result = await service.findByCountry("Canada");

      expect(result).toEqual([]);
    });
  });

  describe("findByCity", () => {
    it("should find fitters by city", async () => {
      repository.findByCity.mockResolvedValue([mockFitter]);

      const result = await service.findByCity("Los Angeles");

      expect(repository.findByCity).toHaveBeenCalledWith("Los Angeles");
      expect(result).toHaveLength(1);
    });

    it("should return empty array when no fitters in city", async () => {
      repository.findByCity.mockResolvedValue([]);

      const result = await service.findByCity("New York");

      expect(result).toEqual([]);
    });
  });

  describe("getCountByCountry", () => {
    it("should return count of fitters by country", async () => {
      repository.countByCountry.mockResolvedValue(5);

      const result = await service.getCountByCountry("United States");

      expect(repository.countByCountry).toHaveBeenCalledWith("United States");
      expect(result).toBe(5);
    });

    it("should return 0 when no fitters in country", async () => {
      repository.countByCountry.mockResolvedValue(0);

      const result = await service.getCountByCountry("Canada");

      expect(result).toBe(0);
    });
  });

  describe("getActiveCount", () => {
    it("should return count of active fitters", async () => {
      repository.countActive.mockResolvedValue(10);

      const result = await service.getActiveCount();

      expect(repository.countActive).toHaveBeenCalled();
      expect(result).toBe(10);
    });

    it("should return 0 when no active fitters", async () => {
      repository.countActive.mockResolvedValue(0);

      const result = await service.getActiveCount();

      expect(result).toBe(0);
    });
  });
});
