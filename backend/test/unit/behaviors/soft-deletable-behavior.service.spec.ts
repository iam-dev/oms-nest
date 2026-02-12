import { Test, TestingModule } from "@nestjs/testing";
import { SoftDeletableBehavior } from "../../../src/behaviors/services/soft-deletable-behavior.service";
import { BehaviorContext } from "../../../src/behaviors/interfaces";
import {
  getSoftDeletableConfig,
  isSoftDeletable,
} from "../../../src/behaviors/decorators";

jest.mock("../../../src/behaviors/decorators", () => ({
  getSoftDeletableConfig: jest.fn(),
  isSoftDeletable: jest.fn(),
}));

describe("SoftDeletableBehavior", () => {
  let behavior: SoftDeletableBehavior;

  const mockGetSoftDeletableConfig =
    getSoftDeletableConfig as jest.MockedFunction<
      typeof getSoftDeletableConfig
    >;
  const mockIsSoftDeletable = isSoftDeletable as jest.MockedFunction<
    typeof isSoftDeletable
  >;

  const defaultConfig = {
    deletedAtField: "deletedAt",
    deletedByField: "deletedBy",
    isDeletedField: "isDeleted",
    trackDeletedBy: true,
    keepHistory: true,
    historyField: "deletionHistory",
    deleteReasonField: "deleteReason",
  };

  const mockContext: BehaviorContext = {
    userId: "user123",
    entityType: "Order",
    operation: "delete",
    isNewEntity: false,
    metadata: {
      timestamp: new Date("2023-01-01T10:00:00Z"),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SoftDeletableBehavior],
    }).compile();

    behavior = module.get<SoftDeletableBehavior>(SoftDeletableBehavior);

    mockGetSoftDeletableConfig.mockReturnValue(defaultConfig);
    mockIsSoftDeletable.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("behavior properties", () => {
    it("should have correct name, priority, and autoApply", () => {
      expect(behavior.name).toBe("SoftDeletableBehavior");
      expect(behavior.priority).toBe(30);
      expect(behavior.autoApply).toBe(true);
    });
  });

  describe("beforeDelete", () => {
    it("should set deletedAt field with current date", async () => {
      const entity = { id: 1, name: "Test" };
      const context = { ...mockContext };

      await behavior.beforeDelete(entity, context);

      expect(entity["deletedAt"]).toBeInstanceOf(Date);
    });

    it("should set deletedBy field when trackDeletedBy is enabled", async () => {
      const entity = { id: 1, name: "Test" };
      const context = { ...mockContext };

      await behavior.beforeDelete(entity, context);

      expect(entity["deletedBy"]).toBe("user123");
    });

    it("should set isDeleted flag to true", async () => {
      const entity = { id: 1, name: "Test" };
      const context = { ...mockContext };

      await behavior.beforeDelete(entity, context);

      expect(entity["isDeleted"]).toBe(true);
    });

    it("should mark context for soft delete", async () => {
      const entity = { id: 1, name: "Test" };
      const context = { ...mockContext };

      await behavior.beforeDelete(entity, context);

      expect(context.metadata?.softDelete).toBe(true);
      expect(context.metadata?.originalOperation).toBe("delete");
    });

    it("should use custom dateProvider if provided", async () => {
      const fixedDate = new Date("2024-06-15T12:00:00Z");
      mockGetSoftDeletableConfig.mockReturnValue({
        ...defaultConfig,
        dateProvider: () => fixedDate,
      });

      const entity = { id: 1 };
      await behavior.beforeDelete(entity, { ...mockContext });

      expect(entity["deletedAt"]).toBe(fixedDate);
    });

    it("should skip when entity is not soft deletable", async () => {
      mockIsSoftDeletable.mockReturnValue(false);

      const entity = { id: 1, name: "Test" };
      const context = { ...mockContext };

      await behavior.beforeDelete(entity, context);

      expect(entity["deletedAt"]).toBeUndefined();
      expect(entity["deletedBy"]).toBeUndefined();
      expect(entity["isDeleted"]).toBeUndefined();
    });

    it("should skip when no config is available", async () => {
      mockGetSoftDeletableConfig.mockReturnValue(undefined);

      const entity = { id: 1 };
      const context = { ...mockContext };

      await behavior.beforeDelete(entity, context);

      expect(entity["deletedAt"]).toBeUndefined();
    });

    it("should not set deletedBy when trackDeletedBy is false", async () => {
      mockGetSoftDeletableConfig.mockReturnValue({
        ...defaultConfig,
        trackDeletedBy: false,
      });

      const entity = { id: 1 };
      await behavior.beforeDelete(entity, { ...mockContext });

      expect(entity["deletedBy"]).toBeUndefined();
      expect(entity["deletedAt"]).toBeInstanceOf(Date);
    });

    it("should not set deletedBy when no userId in context", async () => {
      const entity = { id: 1 };
      await behavior.beforeDelete(entity, {
        ...mockContext,
        userId: undefined,
      });

      expect(entity["deletedBy"]).toBeUndefined();
    });

    it("should not set isDeleted when isDeletedField is not configured", async () => {
      mockGetSoftDeletableConfig.mockReturnValue({
        ...defaultConfig,
        isDeletedField: undefined,
      });

      const entity = { id: 1 };
      await behavior.beforeDelete(entity, { ...mockContext });

      expect(entity["isDeleted"]).toBeUndefined();
      expect(entity["deletedAt"]).toBeInstanceOf(Date);
    });
  });

  describe("afterDelete", () => {
    it("should update deletion history when keepHistory is true", async () => {
      const entity = { id: 1, deletionHistory: [] };
      const context = { ...mockContext };

      await behavior.afterDelete(entity, context);

      expect(entity.deletionHistory).toHaveLength(1);
      expect(entity.deletionHistory[0]).toEqual(
        expect.objectContaining({
          action: "delete",
          userId: "user123",
          timestamp: expect.any(Date),
        }),
      );
    });

    it("should include deleteReason in history if present", async () => {
      const entity: Record<string, any> = {
        id: 1,
        deletionHistory: [],
        deleteReason: "Duplicate entry",
      };
      const context = { ...mockContext };

      await behavior.afterDelete(entity, context);

      expect(entity.deletionHistory[0].reason).toBe("Duplicate entry");
    });

    it("should initialize history array if not present", async () => {
      const entity = { id: 1 };
      const context = { ...mockContext };

      await behavior.afterDelete(entity, context);

      expect(entity["deletionHistory"]).toBeDefined();
      expect(entity["deletionHistory"]).toHaveLength(1);
    });

    it("should skip when keepHistory is false", async () => {
      mockGetSoftDeletableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: false,
      });

      const entity = { id: 1 };
      const context = { ...mockContext };

      await behavior.afterDelete(entity, context);

      expect(entity["deletionHistory"]).toBeUndefined();
    });

    it("should skip when entity is not soft deletable", async () => {
      mockIsSoftDeletable.mockReturnValue(false);

      const entity = { id: 1 };
      await behavior.afterDelete(entity, { ...mockContext });

      expect(entity["deletionHistory"]).toBeUndefined();
    });
  });

  describe("restore", () => {
    it("should clear deletion fields", async () => {
      const entity = {
        id: 1,
        deletedAt: new Date(),
        deletedBy: "user123",
        isDeleted: true,
        constructor: class TestEntity {},
      };
      mockIsSoftDeletable.mockReturnValue(true);

      await behavior.restore(entity, "admin456");

      expect(entity.deletedAt).toBeNull();
      expect(entity.deletedBy).toBeNull();
      expect(entity.isDeleted).toBe(false);
    });

    it("should add restoration to history", async () => {
      const entity = {
        id: 1,
        deletedAt: new Date(),
        deletedBy: "user123",
        isDeleted: true,
        deletionHistory: [
          { action: "delete", timestamp: new Date(), userId: "user123" },
        ],
        constructor: class TestEntity {},
      };
      mockIsSoftDeletable.mockReturnValue(true);

      await behavior.restore(entity, "admin456");

      expect(entity.deletionHistory).toHaveLength(2);
      expect(entity.deletionHistory[1]).toEqual(
        expect.objectContaining({
          action: "restore",
          userId: "admin456",
          timestamp: expect.any(Date),
        }),
      );
    });

    it("should initialize history array if not present during restore", async () => {
      const entity = {
        id: 1,
        deletedAt: new Date(),
        isDeleted: true,
        constructor: class TestEntity {},
      };
      mockIsSoftDeletable.mockReturnValue(true);

      await behavior.restore(entity, "admin456");

      expect(entity["deletionHistory"]).toHaveLength(1);
      expect(entity["deletionHistory"][0].action).toBe("restore");
    });

    it("should throw when entity does not support soft delete", async () => {
      const entity = {
        id: 1,
        constructor: class TestEntity {},
      };
      mockIsSoftDeletable.mockReturnValue(false);

      await expect(behavior.restore(entity)).rejects.toThrow(
        "Entity does not support soft delete",
      );
    });

    it("should handle restore without userId", async () => {
      const entity = {
        id: 1,
        deletedAt: new Date(),
        isDeleted: true,
        constructor: class TestEntity {},
      };
      mockIsSoftDeletable.mockReturnValue(true);

      await behavior.restore(entity);

      expect(entity.deletedAt).toBeNull();
      expect(entity.isDeleted).toBe(false);
    });

    it("should skip history when keepHistory is false", async () => {
      mockGetSoftDeletableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: false,
      });

      const entity = {
        id: 1,
        deletedAt: new Date(),
        isDeleted: true,
        constructor: class TestEntity {},
      };
      mockIsSoftDeletable.mockReturnValue(true);

      await behavior.restore(entity, "admin456");

      expect(entity["deletionHistory"]).toBeUndefined();
    });
  });

  describe("isApplicable", () => {
    it("should return true when entity is soft deletable", () => {
      const entityClass = class TestEntity {};
      mockIsSoftDeletable.mockReturnValue(true);

      const result = behavior.isApplicable(entityClass, {}, mockContext);

      expect(result).toBe(true);
      expect(mockIsSoftDeletable).toHaveBeenCalledWith(entityClass);
    });

    it("should return false when entity is not soft deletable", () => {
      const entityClass = class TestEntity {};
      mockIsSoftDeletable.mockReturnValue(false);

      const result = behavior.isApplicable(entityClass, {}, mockContext);

      expect(result).toBe(false);
    });
  });
});
