import { Test, TestingModule } from "@nestjs/testing";
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ReportSavedFilterController } from "../../../src/report-saved-filters/report-saved-filter.controller";
import { ReportSavedFilterService } from "../../../src/report-saved-filters/report-saved-filter.service";
import { CreateReportSavedFilterDto } from "../../../src/report-saved-filters/dto/create-report-saved-filter.dto";
import { UpdateReportSavedFilterDto } from "../../../src/report-saved-filters/dto/update-report-saved-filter.dto";
import { RolesGuard } from "../../../src/roles/roles.guard";

describe("ReportSavedFilterController", () => {
  let controller: ReportSavedFilterController;
  let service: jest.Mocked<ReportSavedFilterService>;

  const mockEntity = {
    id: 1,
    userId: 42,
    name: "Test Filter",
    filters: { fitters: ["John"] },
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReq = { user: { legacyId: 42 } };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findDefault: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportSavedFilterController],
      providers: [{ provide: ReportSavedFilterService, useValue: mockService }],
    })
      .overrideGuard(AuthGuard("jwt"))
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReportSavedFilterController>(
      ReportSavedFilterController,
    );
    service = module.get(ReportSavedFilterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should call service.create with userId from req and dto, returning the entity", async () => {
      // Arrange
      const dto: CreateReportSavedFilterDto = {
        name: "Test Filter",
        filters: { fitters: ["John"] },
        isDefault: false,
      };
      service.create.mockResolvedValue(mockEntity as any);

      // Act
      const result = await controller.create(mockReq, dto);

      // Assert
      expect(result).toEqual(mockEntity);
      expect(service.create).toHaveBeenCalledTimes(1);
      expect(service.create).toHaveBeenCalledWith(42, dto);
    });

    it("should call service.create with isDefault=true when dto specifies it", async () => {
      // Arrange
      const dto: CreateReportSavedFilterDto = {
        name: "Default Filter",
        filters: { statuses: ["In Production"] },
        isDefault: true,
      };
      const defaultEntity = { ...mockEntity, isDefault: true };
      service.create.mockResolvedValue(defaultEntity as any);

      // Act
      const result = await controller.create(mockReq, dto);

      // Assert
      expect(result).toEqual(defaultEntity);
      expect(service.create).toHaveBeenCalledWith(42, dto);
    });

    it("should propagate errors thrown by service.create", async () => {
      // Arrange
      const dto: CreateReportSavedFilterDto = {
        name: "Filter",
        filters: {},
      };
      service.create.mockRejectedValue(new Error("DB write failed"));

      // Act & Assert
      await expect(controller.create(mockReq, dto)).rejects.toThrow(
        "DB write failed",
      );
      expect(service.create).toHaveBeenCalledWith(42, dto);
    });
  });

  describe("findAll", () => {
    it("should call service.findAll with userId from req and return the list", async () => {
      // Arrange
      service.findAll.mockResolvedValue([mockEntity] as any);

      // Act
      const result = await controller.findAll(mockReq);

      // Assert
      expect(result).toEqual([mockEntity]);
      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(service.findAll).toHaveBeenCalledWith(42);
    });

    it("should return an empty array when user has no saved filters", async () => {
      // Arrange
      service.findAll.mockResolvedValue([]);

      // Act
      const result = await controller.findAll(mockReq);

      // Assert
      expect(result).toEqual([]);
      expect(service.findAll).toHaveBeenCalledWith(42);
    });

    it("should return multiple filters belonging to the user", async () => {
      // Arrange
      const secondEntity = { ...mockEntity, id: 2, name: "Second Filter" };
      service.findAll.mockResolvedValue([mockEntity, secondEntity] as any);

      // Act
      const result = await controller.findAll(mockReq);

      // Assert
      expect(result).toHaveLength(2);
      expect(service.findAll).toHaveBeenCalledWith(42);
    });
  });

  describe("findDefault", () => {
    it("should call service.findDefault with userId from req and return the default filter", async () => {
      // Arrange
      const defaultEntity = { ...mockEntity, isDefault: true };
      service.findDefault.mockResolvedValue(defaultEntity as any);

      // Act
      const result = await controller.findDefault(mockReq);

      // Assert
      expect(result).toEqual(defaultEntity);
      expect(service.findDefault).toHaveBeenCalledTimes(1);
      expect(service.findDefault).toHaveBeenCalledWith(42);
    });

    it("should return null when no default filter exists for user", async () => {
      // Arrange
      service.findDefault.mockResolvedValue(null);

      // Act
      const result = await controller.findDefault(mockReq);

      // Assert
      expect(result).toBeNull();
      expect(service.findDefault).toHaveBeenCalledWith(42);
    });
  });

  describe("update", () => {
    it("should call service.update with id, userId, and dto, returning the updated entity", async () => {
      // Arrange
      const filterId = 1;
      const dto: UpdateReportSavedFilterDto = { name: "Renamed Filter" };
      const updatedEntity = { ...mockEntity, name: "Renamed Filter" };
      service.update.mockResolvedValue(updatedEntity as any);

      // Act
      const result = await controller.update(mockReq, filterId, dto);

      // Assert
      expect(result).toEqual(updatedEntity);
      expect(service.update).toHaveBeenCalledTimes(1);
      expect(service.update).toHaveBeenCalledWith(filterId, 42, dto);
    });

    it("should call service.update with updated filters payload", async () => {
      // Arrange
      const filterId = 1;
      const dto: UpdateReportSavedFilterDto = {
        filters: { fitters: ["Jane"], statuses: ["Completed"] },
      };
      const updatedEntity = { ...mockEntity, ...dto };
      service.update.mockResolvedValue(updatedEntity as any);

      // Act
      const result = await controller.update(mockReq, filterId, dto);

      // Assert
      expect(result).toEqual(updatedEntity);
      expect(service.update).toHaveBeenCalledWith(filterId, 42, dto);
    });

    it("should propagate NotFoundException thrown by service.update", async () => {
      // Arrange
      const filterId = 999;
      const dto: UpdateReportSavedFilterDto = { name: "Ghost Filter" };
      service.update.mockRejectedValue(
        new NotFoundException(`Saved filter with ID "${filterId}" not found`),
      );

      // Act & Assert
      await expect(controller.update(mockReq, filterId, dto)).rejects.toThrow(
        `Saved filter with ID "${filterId}" not found`,
      );
      expect(service.update).toHaveBeenCalledWith(filterId, 42, dto);
    });

    it("should propagate ForbiddenException when updating another user's filter", async () => {
      // Arrange
      const filterId = 7;
      const dto: UpdateReportSavedFilterDto = { name: "Stolen Name" };
      service.update.mockRejectedValue(
        new ForbiddenException("Cannot modify another user's saved filter"),
      );

      // Act & Assert
      await expect(controller.update(mockReq, filterId, dto)).rejects.toThrow(
        "Cannot modify another user's saved filter",
      );
      expect(service.update).toHaveBeenCalledWith(filterId, 42, dto);
    });
  });

  describe("remove", () => {
    it("should call service.remove with id and userId, returning undefined", async () => {
      // Arrange
      const filterId = 1;
      service.remove.mockResolvedValue(undefined);

      // Act
      const result = await controller.remove(mockReq, filterId);

      // Assert
      expect(result).toBeUndefined();
      expect(service.remove).toHaveBeenCalledTimes(1);
      expect(service.remove).toHaveBeenCalledWith(filterId, 42);
    });

    it("should propagate NotFoundException thrown by service.remove", async () => {
      // Arrange
      const filterId = 999;
      service.remove.mockRejectedValue(
        new NotFoundException(`Saved filter with ID "${filterId}" not found`),
      );

      // Act & Assert
      await expect(controller.remove(mockReq, filterId)).rejects.toThrow(
        `Saved filter with ID "${filterId}" not found`,
      );
      expect(service.remove).toHaveBeenCalledWith(filterId, 42);
    });

    it("should propagate ForbiddenException when deleting another user's filter", async () => {
      // Arrange
      const filterId = 5;
      service.remove.mockRejectedValue(
        new ForbiddenException("Cannot delete another user's saved filter"),
      );

      // Act & Assert
      await expect(controller.remove(mockReq, filterId)).rejects.toThrow(
        "Cannot delete another user's saved filter",
      );
      expect(service.remove).toHaveBeenCalledWith(filterId, 42);
    });
  });

  describe("getUserId (via create with missing legacyId)", () => {
    it("should throw UnauthorizedException when req.user has no legacyId", async () => {
      // Arrange
      const reqWithoutLegacyId = { user: {} };
      const dto: CreateReportSavedFilterDto = {
        name: "Filter",
        filters: {},
      };

      // Act & Assert
      await expect(controller.create(reqWithoutLegacyId, dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.create).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException with the correct message", async () => {
      // Arrange
      const reqWithoutLegacyId = { user: {} };
      const dto: CreateReportSavedFilterDto = {
        name: "Filter",
        filters: {},
      };

      // Act & Assert
      await expect(controller.create(reqWithoutLegacyId, dto)).rejects.toThrow(
        "User legacyId not found in JWT payload",
      );
    });

    it("should throw UnauthorizedException when req.user is undefined", async () => {
      // Arrange
      const reqWithNoUser = {};
      const dto: CreateReportSavedFilterDto = {
        name: "Filter",
        filters: {},
      };

      // Act & Assert
      await expect(controller.create(reqWithNoUser, dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.create).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when legacyId is zero (falsy)", async () => {
      // Arrange — legacyId=0 is falsy and must also be rejected
      const reqWithZeroId = { user: { legacyId: 0 } };
      const dto: CreateReportSavedFilterDto = {
        name: "Filter",
        filters: {},
      };

      // Act & Assert
      await expect(controller.create(reqWithZeroId, dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(service.create).not.toHaveBeenCalled();
    });
  });
});
