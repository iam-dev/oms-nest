import { Test, TestingModule } from "@nestjs/testing";
import { TimestampableBehavior } from "../../../src/behaviors/services/timestampable-behavior.service";
import { BehaviorContext } from "../../../src/behaviors/interfaces";
import {
  getTimestampableConfig,
  isTimestampable,
} from "../../../src/behaviors/decorators";

jest.mock("../../../src/behaviors/decorators", () => ({
  getTimestampableConfig: jest.fn(),
  isTimestampable: jest.fn(),
}));

describe("TimestampableBehavior", () => {
  let behavior: TimestampableBehavior;

  const mockGetTimestampableConfig =
    getTimestampableConfig as jest.MockedFunction<
      typeof getTimestampableConfig
    >;
  const mockIsTimestampable = isTimestampable as jest.MockedFunction<
    typeof isTimestampable
  >;

  const defaultConfig = {
    trackCreation: true,
    trackUpdates: true,
    trackDeletions: true,
    trackAccess: false,
    createdAtField: "createdAt",
    updatedAtField: "updatedAt",
    deletedAtField: "deletedAt",
    lastAccessedAtField: "lastAccessedAt",
    keepHistory: false,
    historyField: "modificationHistory",
  };

  const mockContext: BehaviorContext = {
    userId: "user123",
    entityType: "Order",
    operation: "create",
    isNewEntity: true,
    metadata: {
      timestamp: new Date("2023-01-01T10:00:00Z"),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimestampableBehavior],
    }).compile();

    behavior = module.get<TimestampableBehavior>(TimestampableBehavior);

    mockGetTimestampableConfig.mockReturnValue(defaultConfig);
    mockIsTimestampable.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("behavior properties", () => {
    it("should have correct name, priority, and autoApply", () => {
      expect(behavior.name).toBe("TimestampableBehavior");
      expect(behavior.priority).toBe(10);
      expect(behavior.autoApply).toBe(true);
    });
  });

  describe("beforeSave", () => {
    it("should set createdAt for new entities on create", async () => {
      const entity = { name: "Test" };
      const context = { ...mockContext, operation: "create" as const };

      await behavior.beforeSave(entity, context);

      expect(entity["createdAt"]).toBeInstanceOf(Date);
    });

    it("should not overwrite existing createdAt", async () => {
      const existingDate = new Date("2020-01-01");
      const entity = { name: "Test", createdAt: existingDate };
      const context = { ...mockContext, operation: "create" as const };

      await behavior.beforeSave(entity, context);

      expect(entity.createdAt).toBe(existingDate);
    });

    it("should set updatedAt for create operations", async () => {
      const entity = { name: "Test" };
      const context = { ...mockContext, operation: "create" as const };

      await behavior.beforeSave(entity, context);

      expect(entity["updatedAt"]).toBeInstanceOf(Date);
    });

    it("should set updatedAt for update operations", async () => {
      const entity = { id: 1, name: "Updated" };
      const context = { ...mockContext, operation: "update" as const };

      await behavior.beforeSave(entity, context);

      expect(entity["updatedAt"]).toBeInstanceOf(Date);
    });

    it("should not set createdAt for update operations", async () => {
      const entity = { id: 1, name: "Updated" };
      const context = { ...mockContext, operation: "update" as const };

      await behavior.beforeSave(entity, context);

      expect(entity["createdAt"]).toBeUndefined();
    });

    it("should set deletedAt for delete operations", async () => {
      const entity = { id: 1, name: "Deleted" };
      const context = { ...mockContext, operation: "delete" as const };

      await behavior.beforeSave(entity, context);

      expect(entity["deletedAt"]).toBeInstanceOf(Date);
    });

    it("should use custom dateProvider when provided", async () => {
      const fixedDate = new Date("2024-06-15T12:00:00Z");
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        dateProvider: () => fixedDate,
      });

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "create",
      });

      expect(entity["createdAt"]).toBe(fixedDate);
      expect(entity["updatedAt"]).toBe(fixedDate);
    });

    it("should skip when entity is not timestampable", async () => {
      mockIsTimestampable.mockReturnValue(false);

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, mockContext);

      expect(entity["createdAt"]).toBeUndefined();
      expect(entity["updatedAt"]).toBeUndefined();
    });

    it("should skip when no config is available", async () => {
      mockGetTimestampableConfig.mockReturnValue(undefined);

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, mockContext);

      expect(entity["createdAt"]).toBeUndefined();
    });

    it("should skip createdAt when trackCreation is false", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        trackCreation: false,
      });

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "create",
      });

      expect(entity["createdAt"]).toBeUndefined();
      expect(entity["updatedAt"]).toBeInstanceOf(Date);
    });

    it("should skip updatedAt when trackUpdates is false", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        trackUpdates: false,
      });

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "create",
      });

      expect(entity["createdAt"]).toBeInstanceOf(Date);
      expect(entity["updatedAt"]).toBeUndefined();
    });

    it("should skip deletedAt when trackDeletions is false", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        trackDeletions: false,
      });

      const entity = { id: 1 };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "delete",
      });

      expect(entity["deletedAt"]).toBeUndefined();
    });

    it("should update modification history when keepHistory is enabled", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: true,
      });

      const entity = { name: "New Name" };
      const context: BehaviorContext = {
        ...mockContext,
        operation: "create",
        metadata: {
          timestamp: new Date(),
          originalEntity: { name: "Old Name" },
        },
      };

      await behavior.beforeSave(entity, context);

      expect(entity["modificationHistory"]).toBeDefined();
      expect(entity["modificationHistory"]).toHaveLength(1);
      expect(entity["modificationHistory"][0]).toEqual(
        expect.objectContaining({
          action: "create",
          userId: "user123",
          timestamp: expect.any(Date),
          changes: expect.any(Array),
        }),
      );
    });

    it("should track field changes in history", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: true,
      });

      const entity = { name: "New Name", email: "new@test.com" };
      const context: BehaviorContext = {
        ...mockContext,
        operation: "update",
        metadata: {
          timestamp: new Date(),
          originalEntity: { name: "Old Name", email: "old@test.com" },
        },
      };

      await behavior.beforeSave(entity, context);

      const history = entity["modificationHistory"];
      expect(history).toHaveLength(1);
      const changes = history[0].changes;
      expect(changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: "name",
            oldValue: "Old Name",
            newValue: "New Name",
          }),
          expect.objectContaining({
            field: "email",
            oldValue: "old@test.com",
            newValue: "new@test.com",
          }),
        ]),
      );
    });

    it("should limit history size to 100 entries", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: true,
      });

      const existingHistory = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(),
        action: "update",
        userId: `user${i}`,
        changes: [],
      }));

      const entity = { name: "Test", modificationHistory: existingHistory };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "update",
      });

      expect(entity.modificationHistory).toHaveLength(100);
      // The last entry should be the newest
      expect(entity.modificationHistory[99].userId).toBe("user123");
    });
  });

  describe("afterSave", () => {
    it("should update lastAccessedAt when trackAccess is enabled", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        trackAccess: true,
      });

      const entity = { id: 1, lastAccessedAt: null };
      await behavior.afterSave(entity, mockContext);

      expect(entity.lastAccessedAt).toBeInstanceOf(Date);
    });

    it("should skip when trackAccess is false", async () => {
      const entity = { id: 1, lastAccessedAt: null };
      await behavior.afterSave(entity, mockContext);

      expect(entity.lastAccessedAt).toBeNull();
    });

    it("should skip when entity is not timestampable", async () => {
      mockIsTimestampable.mockReturnValue(false);

      const entity = { id: 1, lastAccessedAt: null };
      await behavior.afterSave(entity, mockContext);

      expect(entity.lastAccessedAt).toBeNull();
    });

    it("should skip when lastAccessedAtField is not in entity", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        trackAccess: true,
      });

      const entity = { id: 1 }; // No lastAccessedAt field
      await behavior.afterSave(entity, mockContext);

      expect(entity["lastAccessedAt"]).toBeUndefined();
    });
  });

  describe("beforeDelete", () => {
    it("should set deletedAt timestamp", async () => {
      const entity = { id: 1 };
      const context = { ...mockContext, operation: "delete" as const };

      await behavior.beforeDelete(entity, context);

      expect(entity["deletedAt"]).toBeInstanceOf(Date);
    });

    it("should skip when trackDeletions is false", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        trackDeletions: false,
      });

      const entity = { id: 1 };
      await behavior.beforeDelete(entity, {
        ...mockContext,
        operation: "delete",
      });

      expect(entity["deletedAt"]).toBeUndefined();
    });

    it("should update modification history on delete", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: true,
      });

      const entity = { id: 1 };
      await behavior.beforeDelete(entity, {
        ...mockContext,
        operation: "delete",
      });

      expect(entity["modificationHistory"]).toHaveLength(1);
      expect(entity["modificationHistory"][0].action).toBe("delete");
    });

    it("should skip when entity is not timestampable", async () => {
      mockIsTimestampable.mockReturnValue(false);

      const entity = { id: 1 };
      await behavior.beforeDelete(entity, {
        ...mockContext,
        operation: "delete",
      });

      expect(entity["deletedAt"]).toBeUndefined();
    });
  });

  describe("onLoad", () => {
    it("should update lastAccessedAt when trackAccess is enabled", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        trackAccess: true,
      });

      const entity = { id: 1, lastAccessedAt: new Date("2020-01-01") };
      await behavior.onLoad(entity, {
        ...mockContext,
        operation: "load",
      });

      expect(entity.lastAccessedAt).toBeInstanceOf(Date);
      expect(entity.lastAccessedAt.getTime()).toBeGreaterThan(
        new Date("2020-01-01").getTime(),
      );
    });

    it("should skip when trackAccess is false", async () => {
      const oldDate = new Date("2020-01-01");
      const entity = { id: 1, lastAccessedAt: oldDate };
      await behavior.onLoad(entity, { ...mockContext, operation: "load" });

      expect(entity.lastAccessedAt).toBe(oldDate);
    });

    it("should skip when lastAccessedAtField is not in entity", async () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        trackAccess: true,
      });

      const entity = { id: 1 };
      await behavior.onLoad(entity, { ...mockContext, operation: "load" });

      expect(entity["lastAccessedAt"]).toBeUndefined();
    });

    it("should skip when entity is not timestampable", async () => {
      mockIsTimestampable.mockReturnValue(false);

      const entity = { id: 1, lastAccessedAt: null };
      await behavior.onLoad(entity, { ...mockContext, operation: "load" });

      expect(entity.lastAccessedAt).toBeNull();
    });
  });

  describe("isApplicable", () => {
    it("should return true when entity is timestampable", () => {
      const entityClass = class TestEntity {};
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.isApplicable(entityClass, {}, mockContext);
      expect(result).toBe(true);
      expect(mockIsTimestampable).toHaveBeenCalledWith(entityClass);
    });

    it("should return false when entity is not timestampable", () => {
      const entityClass = class TestEntity {};
      mockIsTimestampable.mockReturnValue(false);

      const result = behavior.isApplicable(entityClass, {}, mockContext);
      expect(result).toBe(false);
    });
  });

  describe("getTimestamp", () => {
    it("should return createdAt timestamp", () => {
      const date = new Date("2023-06-01");
      const entity = {
        createdAt: date,
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.getTimestamp(entity, "created");
      expect(result).toBe(date);
    });

    it("should return updatedAt timestamp", () => {
      const date = new Date("2023-06-02");
      const entity = {
        updatedAt: date,
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.getTimestamp(entity, "updated");
      expect(result).toBe(date);
    });

    it("should return deletedAt timestamp", () => {
      const date = new Date("2023-06-03");
      const entity = {
        deletedAt: date,
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.getTimestamp(entity, "deleted");
      expect(result).toBe(date);
    });

    it("should return null when entity is not timestampable", () => {
      const entity = {
        createdAt: new Date(),
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(false);

      const result = behavior.getTimestamp(entity, "created");
      expect(result).toBeNull();
    });

    it("should return null when field does not exist on entity", () => {
      const entity = {
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.getTimestamp(entity, "created");
      expect(result).toBeNull();
    });

    it("should return null when config is not available", () => {
      mockGetTimestampableConfig.mockReturnValue(undefined);
      const entity = {
        createdAt: new Date(),
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.getTimestamp(entity, "created");
      expect(result).toBeNull();
    });
  });

  describe("isModifiedSince", () => {
    it("should return true when entity was modified after the given date", () => {
      const entity = {
        updatedAt: new Date("2023-06-15"),
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.isModifiedSince(entity, new Date("2023-06-01"));
      expect(result).toBe(true);
    });

    it("should return false when entity was modified before the given date", () => {
      const entity = {
        updatedAt: new Date("2023-05-01"),
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.isModifiedSince(entity, new Date("2023-06-01"));
      expect(result).toBe(false);
    });

    it("should return false when entity has no updatedAt", () => {
      const entity = {
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.isModifiedSince(entity, new Date("2023-06-01"));
      expect(result).toBe(false);
    });

    it("should return false when entity is not timestampable", () => {
      const entity = {
        updatedAt: new Date("2023-06-15"),
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(false);

      const result = behavior.isModifiedSince(entity, new Date("2023-06-01"));
      expect(result).toBe(false);
    });
  });

  describe("getModificationHistory", () => {
    it("should return history array when present", () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: true,
      });

      const history = [
        { timestamp: new Date(), action: "create", userId: "user1" },
      ];
      const entity = {
        modificationHistory: history,
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.getModificationHistory(entity);
      expect(result).toBe(history);
    });

    it("should return empty array when no history exists", () => {
      mockGetTimestampableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: true,
      });

      const entity = {
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.getModificationHistory(entity);
      expect(result).toEqual([]);
    });

    it("should return null when keepHistory is false", () => {
      const entity = {
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(true);

      const result = behavior.getModificationHistory(entity);
      expect(result).toBeNull();
    });

    it("should return null when entity is not timestampable", () => {
      const entity = {
        modificationHistory: [],
        constructor: class TestEntity {},
      };
      mockIsTimestampable.mockReturnValue(false);

      const result = behavior.getModificationHistory(entity);
      expect(result).toBeNull();
    });
  });
});
