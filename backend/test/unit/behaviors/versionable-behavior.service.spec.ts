import { Test, TestingModule } from "@nestjs/testing";
import { VersionableBehavior } from "../../../src/behaviors/services/versionable-behavior.service";
import { BehaviorContext } from "../../../src/behaviors/interfaces";
import {
  getVersionableConfig,
  isVersionable,
} from "../../../src/behaviors/decorators";

jest.mock("../../../src/behaviors/decorators", () => ({
  getVersionableConfig: jest.fn(),
  isVersionable: jest.fn(),
}));

describe("VersionableBehavior", () => {
  let behavior: VersionableBehavior;

  const mockGetVersionableConfig = getVersionableConfig as jest.MockedFunction<
    typeof getVersionableConfig
  >;
  const mockIsVersionable = isVersionable as jest.MockedFunction<
    typeof isVersionable
  >;

  const defaultConfig = {
    versionField: "version",
    initialVersion: 1,
    autoIncrement: true,
    incrementFunction: (v: number) => v + 1,
    trackContentHash: false,
    contentHashField: "contentHash",
    hashAlgorithm: "sha256" as const,
    trackChecksum: false,
    checksumField: "checksum",
    keepHistory: false,
    historyField: "versionHistory",
    excludeFields: ["version", "createdAt", "updatedAt"],
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
      providers: [VersionableBehavior],
    }).compile();

    behavior = module.get<VersionableBehavior>(VersionableBehavior);

    mockGetVersionableConfig.mockReturnValue(defaultConfig);
    mockIsVersionable.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("behavior properties", () => {
    it("should have correct name, priority, and autoApply", () => {
      expect(behavior.name).toBe("VersionableBehavior");
      expect(behavior.priority).toBe(40);
      expect(behavior.autoApply).toBe(true);
    });
  });

  describe("beforeSave - create", () => {
    it("should set initial version for new entities", async () => {
      const entity = { name: "Test" };
      const context = { ...mockContext, operation: "create" as const };

      await behavior.beforeSave(entity, context);

      expect(entity["version"]).toBe(1);
    });

    it("should not overwrite existing version on create", async () => {
      const entity = { name: "Test", version: 5 };
      const context = { ...mockContext, operation: "create" as const };

      await behavior.beforeSave(entity, context);

      expect(entity.version).toBe(5);
    });

    it("should use configured initialVersion", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        initialVersion: 0,
      });

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "create",
      });

      expect(entity["version"]).toBe(0);
    });
  });

  describe("beforeSave - update", () => {
    it("should increment version on update", async () => {
      const entity = { id: 1, name: "Updated", version: 3 };
      const context = { ...mockContext, operation: "update" as const };

      await behavior.beforeSave(entity, context);

      expect(entity.version).toBe(4);
    });

    it("should use configured incrementFunction", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        incrementFunction: (v: number) => v * 2,
      });

      const entity = { id: 1, version: 3 };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "update",
      });

      expect(entity.version).toBe(6);
    });

    it("should use initialVersion when entity has no version on update", async () => {
      const entity = { id: 1, name: "Updated" };
      const context = { ...mockContext, operation: "update" as const };

      await behavior.beforeSave(entity, context);

      expect(entity["version"]).toBe(2); // initialVersion(1) + 1
    });

    it("should skip auto increment when autoIncrement is false", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        autoIncrement: false,
      });

      const entity = { id: 1, version: 3 };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "update",
      });

      expect(entity.version).toBe(3);
    });
  });

  describe("beforeSave - content hash", () => {
    it("should calculate content hash when trackContentHash is enabled", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        trackContentHash: true,
      });

      const entity = { name: "Test", email: "test@example.com" };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "create",
      });

      expect(entity["contentHash"]).toBeDefined();
      expect(typeof entity["contentHash"]).toBe("string");
      expect(entity["contentHash"].length).toBeGreaterThan(0);
    });

    it("should exclude configured fields from content hash", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        trackContentHash: true,
        excludeFields: ["version", "updatedAt"],
      });

      const entity1 = { name: "Test", version: 1 };
      const entity2 = { name: "Test", version: 2 };

      await behavior.beforeSave(entity1, {
        ...mockContext,
        operation: "create",
      });
      await behavior.beforeSave(entity2, {
        ...mockContext,
        operation: "create",
      });

      // Both entities have same data excluding version, so hashes should match
      expect(entity1["contentHash"]).toBe(entity2["contentHash"]);
    });

    it("should produce different hashes for different content", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        trackContentHash: true,
        excludeFields: [],
      });

      const entity1 = { name: "Test A" };
      const entity2 = { name: "Test B" };

      await behavior.beforeSave(entity1, {
        ...mockContext,
        operation: "create",
      });
      await behavior.beforeSave(entity2, {
        ...mockContext,
        operation: "create",
      });

      expect(entity1["contentHash"]).not.toBe(entity2["contentHash"]);
    });
  });

  describe("beforeSave - checksum", () => {
    it("should calculate checksum (first 8 chars of hash) when enabled", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        trackChecksum: true,
      });

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "create",
      });

      expect(entity["checksum"]).toBeDefined();
      expect(entity["checksum"].length).toBe(8);
    });
  });

  describe("beforeSave - version history", () => {
    it("should add version history entry when keepHistory is true", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: true,
      });

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "create",
      });

      expect(entity["versionHistory"]).toBeDefined();
      expect(entity["versionHistory"]).toHaveLength(1);
      expect(entity["versionHistory"][0]).toEqual(
        expect.objectContaining({
          version: 1,
          userId: "user123",
          timestamp: expect.any(Date),
          changes: [],
        }),
      );
    });

    it("should track changes in version history", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: true,
      });

      const entity = { name: "New Name", email: "new@test.com", version: 1 };
      const context: BehaviorContext = {
        ...mockContext,
        operation: "update",
        metadata: {
          timestamp: new Date(),
          originalEntity: {
            name: "Old Name",
            email: "old@test.com",
            version: 1,
          },
        },
      };

      await behavior.beforeSave(entity, context);

      const history = entity["versionHistory"];
      expect(history).toHaveLength(1);
      // version and excludeFields are excluded from change tracking
      expect(history[0].changes).toEqual(
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

    it("should limit history size to 50 entries", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: true,
      });

      const existingHistory = Array.from({ length: 50 }, (_, i) => ({
        version: i + 1,
        timestamp: new Date(),
        userId: `user${i}`,
        changes: [],
        contentHash: null,
      }));

      const entity = { name: "Test", versionHistory: existingHistory };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "update",
      });

      expect(entity.versionHistory).toHaveLength(50);
      // The newest entry should be last
      expect(entity.versionHistory[49].userId).toBe("user123");
    });

    it("should initialize history array if not present", async () => {
      mockGetVersionableConfig.mockReturnValue({
        ...defaultConfig,
        keepHistory: true,
      });

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, {
        ...mockContext,
        operation: "create",
      });

      expect(entity["versionHistory"]).toBeDefined();
      expect(Array.isArray(entity["versionHistory"])).toBe(true);
    });
  });

  describe("beforeSave - general", () => {
    it("should skip when entity is not versionable", async () => {
      mockIsVersionable.mockReturnValue(false);

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, mockContext);

      expect(entity["version"]).toBeUndefined();
    });

    it("should skip when no config is available", async () => {
      mockGetVersionableConfig.mockReturnValue(undefined);

      const entity = { name: "Test" };
      await behavior.beforeSave(entity, mockContext);

      expect(entity["version"]).toBeUndefined();
    });
  });

  describe("isApplicable", () => {
    it("should return true when entity is versionable", () => {
      const entityClass = class TestEntity {};
      mockIsVersionable.mockReturnValue(true);

      const result = behavior.isApplicable(entityClass, {}, mockContext);
      expect(result).toBe(true);
      expect(mockIsVersionable).toHaveBeenCalledWith(entityClass);
    });

    it("should return false when entity is not versionable", () => {
      const entityClass = class TestEntity {};
      mockIsVersionable.mockReturnValue(false);

      const result = behavior.isApplicable(entityClass, {}, mockContext);
      expect(result).toBe(false);
    });
  });
});
