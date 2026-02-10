import { Test, TestingModule } from "@nestjs/testing";
import { SessionService } from "../../../src/session/session.service";
import { SessionRepository } from "../../../src/session/infrastructure/persistence/session.repository";
import { Session } from "../../../src/session/domain/session";

describe("SessionService", () => {
  let service: SessionService;
  let sessionRepository: jest.Mocked<SessionRepository>;

  const mockSession: Session = {
    id: 1,
    user: {
      id: "550e8400-e29b-41d4-a716-446655440001",
      email: "test@example.com",
    } as any,
    hash: "session-hash-abc123",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    deletedAt: null as any,
  };

  beforeEach(async () => {
    const mockSessionRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
      deleteByUserId: jest.fn(),
      deleteByUserIdWithExclude: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: SessionRepository, useValue: mockSessionRepository },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    sessionRepository = module.get(SessionRepository);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findById", () => {
    it("should delegate to repository", async () => {
      sessionRepository.findById.mockResolvedValue(mockSession);

      const result = await service.findById(1);

      expect(sessionRepository.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockSession);
    });

    it("should return null when not found", async () => {
      sessionRepository.findById.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(sessionRepository.findById).toHaveBeenCalledWith(999);
      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should delegate to repository", async () => {
      const createData = {
        user: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          email: "test@example.com",
        } as any,
        hash: "new-session-hash",
      };
      sessionRepository.create.mockResolvedValue(mockSession);

      const result = await service.create(createData);

      expect(sessionRepository.create).toHaveBeenCalledWith(createData);
      expect(result).toEqual(mockSession);
    });
  });

  describe("update", () => {
    it("should delegate to repository", async () => {
      const updatePayload = { hash: "updated-hash" };
      const updatedSession = { ...mockSession, hash: "updated-hash" };
      sessionRepository.update.mockResolvedValue(updatedSession);

      const result = await service.update(1, updatePayload);

      expect(sessionRepository.update).toHaveBeenCalledWith(1, updatePayload);
      expect(result).toEqual(updatedSession);
    });

    it("should return null when not found", async () => {
      sessionRepository.update.mockResolvedValue(null);

      const result = await service.update(999, { hash: "updated-hash" });

      expect(sessionRepository.update).toHaveBeenCalledWith(999, {
        hash: "updated-hash",
      });
      expect(result).toBeNull();
    });
  });

  describe("deleteById", () => {
    it("should delegate to repository", async () => {
      sessionRepository.deleteById.mockResolvedValue(undefined);

      await service.deleteById(1);

      expect(sessionRepository.deleteById).toHaveBeenCalledWith(1);
    });
  });

  describe("deleteByUserId", () => {
    it("should delegate to repository", async () => {
      sessionRepository.deleteByUserId.mockResolvedValue(undefined);

      await service.deleteByUserId({
        userId: "550e8400-e29b-41d4-a716-446655440001",
      });

      expect(sessionRepository.deleteByUserId).toHaveBeenCalledWith({
        userId: "550e8400-e29b-41d4-a716-446655440001",
      });
    });
  });

  describe("deleteByUserIdWithExclude", () => {
    it("should delegate to repository", async () => {
      sessionRepository.deleteByUserIdWithExclude.mockResolvedValue(undefined);

      await service.deleteByUserIdWithExclude({
        userId: "550e8400-e29b-41d4-a716-446655440001",
        excludeSessionId: 5,
      });

      expect(sessionRepository.deleteByUserIdWithExclude).toHaveBeenCalledWith({
        userId: "550e8400-e29b-41d4-a716-446655440001",
        excludeSessionId: 5,
      });
    });
  });
});
