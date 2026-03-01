import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { ReportSavedFilterService } from "../../../src/report-saved-filters/report-saved-filter.service";
import { ReportSavedFilterRepository } from "../../../src/report-saved-filters/infrastructure/persistence/relational/repositories/report-saved-filter.repository";
import { ReportSavedFilterEntity } from "../../../src/report-saved-filters/infrastructure/persistence/relational/entities/report-saved-filter.entity";
import { CreateReportSavedFilterDto } from "../../../src/report-saved-filters/dto/create-report-saved-filter.dto";
import { UpdateReportSavedFilterDto } from "../../../src/report-saved-filters/dto/update-report-saved-filter.dto";

describe("ReportSavedFilterService", () => {
  let service: ReportSavedFilterService;
  let repository: jest.Mocked<ReportSavedFilterRepository>;

  const USER_ID = 42;
  const OTHER_USER_ID = 99;
  const FILTER_ID = 1;

  const mockEntity: ReportSavedFilterEntity = {
    id: FILTER_ID,
    userId: USER_ID,
    name: "Test Filter",
    filters: { fitters: ["John"], statuses: ["In Production"] },
    isDefault: false,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  } as ReportSavedFilterEntity;

  const mockDefaultEntity: ReportSavedFilterEntity = {
    ...mockEntity,
    id: 2,
    name: "Default Filter",
    isDefault: true,
  } as ReportSavedFilterEntity;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      findAllByUser: jest.fn(),
      findById: jest.fn(),
      findDefault: jest.fn(),
      clearDefaults: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportSavedFilterService,
        {
          provide: ReportSavedFilterRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ReportSavedFilterService>(ReportSavedFilterService);
    repository = module.get(ReportSavedFilterRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a filter with isDefault=false when not specified", async () => {
      // Arrange
      const dto: CreateReportSavedFilterDto = {
        name: "Test Filter",
        filters: { fitters: ["John"], statuses: ["In Production"] },
      };
      repository.create.mockResolvedValue(mockEntity);

      // Act
      const result = await service.create(USER_ID, dto);

      // Assert
      expect(repository.clearDefaults).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith({
        userId: USER_ID,
        name: dto.name,
        filters: dto.filters,
        isDefault: false,
      });
      expect(result).toEqual(mockEntity);
    });

    it("should create a filter with isDefault=false when explicitly set to false", async () => {
      // Arrange
      const dto: CreateReportSavedFilterDto = {
        name: "Non-Default Filter",
        filters: { statuses: ["Completed"] },
        isDefault: false,
      };
      repository.create.mockResolvedValue(mockEntity);

      // Act
      const result = await service.create(USER_ID, dto);

      // Assert
      expect(repository.clearDefaults).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalledWith({
        userId: USER_ID,
        name: dto.name,
        filters: dto.filters,
        isDefault: false,
      });
      expect(result).toEqual(mockEntity);
    });

    it("should clear existing defaults before creating when isDefault=true", async () => {
      // Arrange
      const dto: CreateReportSavedFilterDto = {
        name: "New Default Filter",
        filters: { fitters: ["Jane"] },
        isDefault: true,
      };
      const newDefaultEntity = {
        ...mockEntity,
        isDefault: true,
      } as ReportSavedFilterEntity;
      repository.clearDefaults.mockResolvedValue(undefined);
      repository.create.mockResolvedValue(newDefaultEntity);

      // Act
      const result = await service.create(USER_ID, dto);

      // Assert
      expect(repository.clearDefaults).toHaveBeenCalledWith(USER_ID);
      expect(repository.create).toHaveBeenCalledWith({
        userId: USER_ID,
        name: dto.name,
        filters: dto.filters,
        isDefault: true,
      });
      expect(result.isDefault).toBe(true);
    });

    it("should call clearDefaults before create (order matters)", async () => {
      // Arrange
      const dto: CreateReportSavedFilterDto = {
        name: "Ordered Default",
        filters: {},
        isDefault: true,
      };
      const callOrder: string[] = [];
      repository.clearDefaults.mockImplementation(() => {
        callOrder.push("clearDefaults");
        return Promise.resolve(undefined);
      });
      repository.create.mockImplementation(() => {
        callOrder.push("create");
        return Promise.resolve(mockEntity);
      });

      // Act
      await service.create(USER_ID, dto);

      // Assert
      expect(callOrder).toEqual(["clearDefaults", "create"]);
    });
  });

  describe("findAll", () => {
    it("should return all saved filters for the user", async () => {
      // Arrange
      const filters = [mockEntity, mockDefaultEntity];
      repository.findAllByUser.mockResolvedValue(filters);

      // Act
      const result = await service.findAll(USER_ID);

      // Assert
      expect(repository.findAllByUser).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(filters);
      expect(result).toHaveLength(2);
    });

    it("should return empty array when user has no saved filters", async () => {
      // Arrange
      repository.findAllByUser.mockResolvedValue([]);

      // Act
      const result = await service.findAll(USER_ID);

      // Assert
      expect(repository.findAllByUser).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual([]);
    });

    it("should only return filters for the requested user", async () => {
      // Arrange
      repository.findAllByUser.mockResolvedValue([mockEntity]);

      // Act
      await service.findAll(USER_ID);

      // Assert
      expect(repository.findAllByUser).toHaveBeenCalledWith(USER_ID);
      expect(repository.findAllByUser).not.toHaveBeenCalledWith(OTHER_USER_ID);
    });
  });

  describe("findDefault", () => {
    it("should return the default filter when one exists", async () => {
      // Arrange
      repository.findDefault.mockResolvedValue(mockDefaultEntity);

      // Act
      const result = await service.findDefault(USER_ID);

      // Assert
      expect(repository.findDefault).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual(mockDefaultEntity);
      expect(result?.isDefault).toBe(true);
    });

    it("should return null when no default filter exists", async () => {
      // Arrange
      repository.findDefault.mockResolvedValue(null);

      // Act
      const result = await service.findDefault(USER_ID);

      // Assert
      expect(repository.findDefault).toHaveBeenCalledWith(USER_ID);
      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update a filter owned by the user", async () => {
      // Arrange
      const dto: UpdateReportSavedFilterDto = {
        name: "Updated Filter Name",
        filters: { fitters: ["Alice", "Bob"] },
      };
      const updatedEntity = {
        ...mockEntity,
        name: dto.name!,
        filters: dto.filters!,
      } as ReportSavedFilterEntity;
      repository.findById.mockResolvedValue(mockEntity);
      repository.update.mockResolvedValue(updatedEntity);

      // Act
      const result = await service.update(FILTER_ID, USER_ID, dto);

      // Assert
      expect(repository.findById).toHaveBeenCalledWith(FILTER_ID);
      expect(repository.update).toHaveBeenCalledWith(FILTER_ID, {
        name: dto.name,
        filters: dto.filters,
      });
      expect(result.name).toBe(dto.name);
      expect(result.filters).toEqual(dto.filters);
    });

    it("should throw NotFoundException when filter does not exist", async () => {
      // Arrange
      const dto: UpdateReportSavedFilterDto = { name: "Anything" };
      repository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(FILTER_ID, USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update(FILTER_ID, USER_ID, dto)).rejects.toThrow(
        `Saved filter with ID "${FILTER_ID}" not found`,
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when user does not own the filter", async () => {
      // Arrange
      const dto: UpdateReportSavedFilterDto = { name: "Hijacked" };
      const otherUsersFilter = {
        ...mockEntity,
        userId: OTHER_USER_ID,
      } as ReportSavedFilterEntity;
      repository.findById.mockResolvedValue(otherUsersFilter);

      // Act & Assert
      await expect(service.update(FILTER_ID, USER_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.update(FILTER_ID, USER_ID, dto)).rejects.toThrow(
        "Cannot modify another user's saved filter",
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it("should clear other defaults when setting isDefault=true", async () => {
      // Arrange
      const dto: UpdateReportSavedFilterDto = { isDefault: true };
      const updatedEntity = {
        ...mockEntity,
        isDefault: true,
      } as ReportSavedFilterEntity;
      repository.findById.mockResolvedValue(mockEntity);
      repository.clearDefaults.mockResolvedValue(undefined);
      repository.update.mockResolvedValue(updatedEntity);

      // Act
      const result = await service.update(FILTER_ID, USER_ID, dto);

      // Assert
      expect(repository.clearDefaults).toHaveBeenCalledWith(USER_ID);
      expect(repository.update).toHaveBeenCalledWith(FILTER_ID, {
        isDefault: true,
      });
      expect(result.isDefault).toBe(true);
    });

    it("should not clear defaults when isDefault is not set to true", async () => {
      // Arrange
      const dto: UpdateReportSavedFilterDto = { name: "Just a rename" };
      const updatedEntity = {
        ...mockEntity,
        name: "Just a rename",
      } as ReportSavedFilterEntity;
      repository.findById.mockResolvedValue(mockEntity);
      repository.update.mockResolvedValue(updatedEntity);

      // Act
      await service.update(FILTER_ID, USER_ID, dto);

      // Assert
      expect(repository.clearDefaults).not.toHaveBeenCalled();
    });

    it("should not clear defaults when isDefault is explicitly false", async () => {
      // Arrange
      const dto: UpdateReportSavedFilterDto = { isDefault: false };
      const updatedEntity = {
        ...mockEntity,
        isDefault: false,
      } as ReportSavedFilterEntity;
      repository.findById.mockResolvedValue(mockEntity);
      repository.update.mockResolvedValue(updatedEntity);

      // Act
      await service.update(FILTER_ID, USER_ID, dto);

      // Assert
      expect(repository.clearDefaults).not.toHaveBeenCalled();
    });

    it("should only pass defined fields to repository update", async () => {
      // Arrange — only name is provided, not filters or isDefault
      const dto: UpdateReportSavedFilterDto = { name: "Partial Update" };
      const updatedEntity = {
        ...mockEntity,
        name: "Partial Update",
      } as ReportSavedFilterEntity;
      repository.findById.mockResolvedValue(mockEntity);
      repository.update.mockResolvedValue(updatedEntity);

      // Act
      await service.update(FILTER_ID, USER_ID, dto);

      // Assert — filters and isDefault should NOT appear in the update payload
      expect(repository.update).toHaveBeenCalledWith(FILTER_ID, {
        name: "Partial Update",
      });
    });

    it("should throw NotFoundException when repository update returns null", async () => {
      // Arrange — repository.update returns null (race condition / record deleted)
      const dto: UpdateReportSavedFilterDto = { name: "Ghost Update" };
      repository.findById.mockResolvedValue(mockEntity);
      repository.update.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(FILTER_ID, USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.update(FILTER_ID, USER_ID, dto)).rejects.toThrow(
        `Failed to update saved filter with ID "${FILTER_ID}"`,
      );
    });
  });

  describe("remove", () => {
    it("should remove a filter owned by the user", async () => {
      // Arrange
      repository.findById.mockResolvedValue(mockEntity);
      repository.delete.mockResolvedValue(undefined);

      // Act
      await service.remove(FILTER_ID, USER_ID);

      // Assert
      expect(repository.findById).toHaveBeenCalledWith(FILTER_ID);
      expect(repository.delete).toHaveBeenCalledWith(FILTER_ID);
    });

    it("should return void on successful deletion", async () => {
      // Arrange
      repository.findById.mockResolvedValue(mockEntity);
      repository.delete.mockResolvedValue(undefined);

      // Act
      const result = await service.remove(FILTER_ID, USER_ID);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should throw NotFoundException when filter does not exist", async () => {
      // Arrange
      repository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove(FILTER_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(FILTER_ID, USER_ID)).rejects.toThrow(
        `Saved filter with ID "${FILTER_ID}" not found`,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it("should throw ForbiddenException when user does not own the filter", async () => {
      // Arrange
      const otherUsersFilter = {
        ...mockEntity,
        userId: OTHER_USER_ID,
      } as ReportSavedFilterEntity;
      repository.findById.mockResolvedValue(otherUsersFilter);

      // Act & Assert
      await expect(service.remove(FILTER_ID, USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove(FILTER_ID, USER_ID)).rejects.toThrow(
        "Cannot delete another user's saved filter",
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
