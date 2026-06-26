import { Test, TestingModule } from "@nestjs/testing";
import {
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ReportSavedFilterController } from "../../../src/report-saved-filters/report-saved-filter.controller";
import { ReportSavedFilterService } from "../../../src/report-saved-filters/report-saved-filter.service";
import { CreateReportSavedFilterDto } from "../../../src/report-saved-filters/dto/create-report-saved-filter.dto";
import { UpdateReportSavedFilterDto } from "../../../src/report-saved-filters/dto/update-report-saved-filter.dto";
import { RolesGuard } from "../../../src/roles/roles.guard";

// Note: @CurrentUserId() is a param decorator; in unit tests NestJS does not execute
// decorators — controller methods receive the final extracted value (a number).
// The decorator's own auth-failure behavior is covered in current-user-id.decorator.spec.ts.

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

  const userId = 42;

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
    it("should call service.create with userId and dto, returning the entity", async () => {
      const dto: CreateReportSavedFilterDto = {
        name: "Test Filter",
        filters: { fitters: ["John"] },
        isDefault: false,
      };
      service.create.mockResolvedValue(mockEntity as any);

      const result = await controller.create(userId, dto);

      expect(result).toEqual(mockEntity);
      expect(service.create).toHaveBeenCalledTimes(1);
      expect(service.create).toHaveBeenCalledWith(42, dto);
    });

    it("should call service.create with isDefault=true when dto specifies it", async () => {
      const dto: CreateReportSavedFilterDto = {
        name: "Default Filter",
        filters: { statuses: ["In Production"] },
        isDefault: true,
      };
      const defaultEntity = { ...mockEntity, isDefault: true };
      service.create.mockResolvedValue(defaultEntity as any);

      const result = await controller.create(userId, dto);

      expect(result).toEqual(defaultEntity);
      expect(service.create).toHaveBeenCalledWith(42, dto);
    });

    it("should propagate errors thrown by service.create", async () => {
      const dto: CreateReportSavedFilterDto = {
        name: "Filter",
        filters: {},
      };
      service.create.mockRejectedValue(new Error("DB write failed"));

      await expect(controller.create(userId, dto)).rejects.toThrow(
        "DB write failed",
      );
      expect(service.create).toHaveBeenCalledWith(42, dto);
    });
  });

  describe("findAll", () => {
    it("should call service.findAll with userId and return the list", async () => {
      service.findAll.mockResolvedValue([mockEntity] as any);

      const result = await controller.findAll(userId);

      expect(result).toEqual([mockEntity]);
      expect(service.findAll).toHaveBeenCalledTimes(1);
      expect(service.findAll).toHaveBeenCalledWith(42);
    });

    it("should return an empty array when user has no saved filters", async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll(userId);

      expect(result).toEqual([]);
      expect(service.findAll).toHaveBeenCalledWith(42);
    });

    it("should return multiple filters belonging to the user", async () => {
      const secondEntity = { ...mockEntity, id: 2, name: "Second Filter" };
      service.findAll.mockResolvedValue([mockEntity, secondEntity] as any);

      const result = await controller.findAll(userId);

      expect(result).toHaveLength(2);
      expect(service.findAll).toHaveBeenCalledWith(42);
    });
  });

  describe("findDefault", () => {
    it("should call service.findDefault with userId and return the default filter", async () => {
      const defaultEntity = { ...mockEntity, isDefault: true };
      service.findDefault.mockResolvedValue(defaultEntity as any);

      const result = await controller.findDefault(userId);

      expect(result).toEqual(defaultEntity);
      expect(service.findDefault).toHaveBeenCalledTimes(1);
      expect(service.findDefault).toHaveBeenCalledWith(42);
    });

    it("should return null when no default filter exists for user", async () => {
      service.findDefault.mockResolvedValue(null);

      const result = await controller.findDefault(userId);

      expect(result).toBeNull();
      expect(service.findDefault).toHaveBeenCalledWith(42);
    });
  });

  describe("update", () => {
    it("should call service.update with id, userId, and dto, returning the updated entity", async () => {
      const filterId = 1;
      const dto: UpdateReportSavedFilterDto = { name: "Renamed Filter" };
      const updatedEntity = { ...mockEntity, name: "Renamed Filter" };
      service.update.mockResolvedValue(updatedEntity as any);

      const result = await controller.update(userId, filterId, dto);

      expect(result).toEqual(updatedEntity);
      expect(service.update).toHaveBeenCalledTimes(1);
      expect(service.update).toHaveBeenCalledWith(filterId, 42, dto);
    });

    it("should call service.update with updated filters payload", async () => {
      const filterId = 1;
      const dto: UpdateReportSavedFilterDto = {
        filters: { fitters: ["Jane"], statuses: ["Completed"] },
      };
      const updatedEntity = { ...mockEntity, ...dto };
      service.update.mockResolvedValue(updatedEntity as any);

      const result = await controller.update(userId, filterId, dto);

      expect(result).toEqual(updatedEntity);
      expect(service.update).toHaveBeenCalledWith(filterId, 42, dto);
    });

    it("should propagate NotFoundException thrown by service.update", async () => {
      const filterId = 999;
      const dto: UpdateReportSavedFilterDto = { name: "Ghost Filter" };
      service.update.mockRejectedValue(
        new NotFoundException(`Saved filter with ID "${filterId}" not found`),
      );

      await expect(controller.update(userId, filterId, dto)).rejects.toThrow(
        `Saved filter with ID "${filterId}" not found`,
      );
      expect(service.update).toHaveBeenCalledWith(filterId, 42, dto);
    });

    it("should propagate ForbiddenException when updating another user's filter", async () => {
      const filterId = 7;
      const dto: UpdateReportSavedFilterDto = { name: "Stolen Name" };
      service.update.mockRejectedValue(
        new ForbiddenException("Cannot modify another user's saved filter"),
      );

      await expect(controller.update(userId, filterId, dto)).rejects.toThrow(
        "Cannot modify another user's saved filter",
      );
      expect(service.update).toHaveBeenCalledWith(filterId, 42, dto);
    });
  });

  describe("remove", () => {
    it("should call service.remove with id and userId, returning undefined", async () => {
      const filterId = 1;
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(userId, filterId);

      expect(result).toBeUndefined();
      expect(service.remove).toHaveBeenCalledTimes(1);
      expect(service.remove).toHaveBeenCalledWith(filterId, 42);
    });

    it("should propagate NotFoundException thrown by service.remove", async () => {
      const filterId = 999;
      service.remove.mockRejectedValue(
        new NotFoundException(`Saved filter with ID "${filterId}" not found`),
      );

      await expect(controller.remove(userId, filterId)).rejects.toThrow(
        `Saved filter with ID "${filterId}" not found`,
      );
      expect(service.remove).toHaveBeenCalledWith(filterId, 42);
    });

    it("should propagate ForbiddenException when deleting another user's filter", async () => {
      const filterId = 5;
      service.remove.mockRejectedValue(
        new ForbiddenException("Cannot delete another user's saved filter"),
      );

      await expect(controller.remove(userId, filterId)).rejects.toThrow(
        "Cannot delete another user's saved filter",
      );
      expect(service.remove).toHaveBeenCalledWith(filterId, 42);
    });
  });
});
