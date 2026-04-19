import { Test, TestingModule } from "@nestjs/testing";
import { CommentsController } from "../../../src/comments/comments.controller";
import { CommentsService } from "../../../src/comments/comments.service";
import { CreateCommentDto } from "../../../src/comments/dto/create-comment.dto";
import { UpdateCommentDto } from "../../../src/comments/dto/update-comment.dto";

describe("CommentsController", () => {
  let controller: CommentsController;
  let service: jest.Mocked<CommentsService>;

  const mockCommentDto = {
    id: 1,
    orderId: 100,
    userId: 5,
    content: "This is a test comment",
    type: "general",
    isInternal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      findByOrderId: jest.fn(),
      findPublicByOrderId: jest.fn(),
      findInternalByOrderId: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getCommentStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
    service = module.get(CommentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new comment", async () => {
      // Arrange
      const createDto: CreateCommentDto = {
        orderId: 100,
        userId: 5,
        content: "Test comment",
        type: "general",
      };

      service.create.mockResolvedValue(mockCommentDto);

      // Act
      const result = await controller.create(createDto, {});

      // Assert
      expect(result).toEqual(mockCommentDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it("should propagate errors from service", async () => {
      // Arrange
      const createDto: CreateCommentDto = {
        orderId: 100,
        content: "",
      };

      service.create.mockRejectedValue(
        new Error("Comment content is required"),
      );

      // Act & Assert
      await expect(controller.create(createDto, {})).rejects.toThrow(
        "Comment content is required",
      );
    });
  });

  describe("findAll", () => {
    it("should return all comments with filters", async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 20,
      };

      service.findAll.mockResolvedValue([mockCommentDto]);

      // Act
      const result = await controller.findAll(query as any);

      // Assert
      expect(result).toEqual([mockCommentDto]);
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it("should pass filter parameters to service", async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 20,
        orderId: 100,
        type: "general",
      };

      service.findAll.mockResolvedValue([mockCommentDto]);

      // Act
      await controller.findAll(query as any);

      // Assert
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe("findByOrderId", () => {
    it("should return comments for specific order", async () => {
      // Arrange
      service.findByOrderId.mockResolvedValue([mockCommentDto]);

      // Act
      const result = await controller.findByOrderId(100);

      // Assert
      expect(result).toEqual([mockCommentDto]);
      expect(service.findByOrderId).toHaveBeenCalledWith(100);
    });

    it("should return empty array when no comments found", async () => {
      // Arrange
      service.findByOrderId.mockResolvedValue([]);

      // Act
      const result = await controller.findByOrderId(999);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findPublicByOrderId", () => {
    it("should return only public comments for order", async () => {
      // Arrange
      service.findPublicByOrderId.mockResolvedValue([mockCommentDto]);

      // Act
      const result = await controller.findPublicByOrderId(100);

      // Assert
      expect(result).toEqual([mockCommentDto]);
      expect(service.findPublicByOrderId).toHaveBeenCalledWith(100);
    });
  });

  describe("findInternalByOrderId", () => {
    it("should return only internal comments for order", async () => {
      // Arrange
      const internalComment = { ...mockCommentDto, isInternal: true };
      service.findInternalByOrderId.mockResolvedValue([internalComment]);

      // Act
      const result = await controller.findInternalByOrderId(100);

      // Assert
      expect(result).toEqual([internalComment]);
      expect(service.findInternalByOrderId).toHaveBeenCalledWith(100);
    });
  });

  describe("getCommentStats", () => {
    it("should return comment statistics for order", async () => {
      // Arrange
      const stats = {
        total: 10,
        internal: 3,
        public: 7,
        byType: {
          general: 5,
          note: 3,
          issue: 2,
        },
      };

      service.getCommentStats.mockResolvedValue(stats);

      // Act
      const result = await controller.getCommentStats(100);

      // Assert
      expect(result).toEqual(stats);
      expect(service.getCommentStats).toHaveBeenCalledWith(100);
    });

    it("should return zero stats when no comments", async () => {
      // Arrange
      const stats = {
        total: 0,
        internal: 0,
        public: 0,
        byType: {},
      };

      service.getCommentStats.mockResolvedValue(stats);

      // Act
      const result = await controller.getCommentStats(999);

      // Assert
      expect(result).toEqual(stats);
    });
  });

  describe("findByUserId", () => {
    it("should return comments by specific user", async () => {
      // Arrange
      service.findByUserId.mockResolvedValue([mockCommentDto]);

      // Act
      const result = await controller.findByUserId(5);

      // Assert
      expect(result).toEqual([mockCommentDto]);
      expect(service.findByUserId).toHaveBeenCalledWith(5);
    });

    it("should return empty array when user has no comments", async () => {
      // Arrange
      service.findByUserId.mockResolvedValue([]);

      // Act
      const result = await controller.findByUserId(999);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("findOne", () => {
    it("should return comment by ID", async () => {
      // Arrange
      service.findOne.mockResolvedValue(mockCommentDto);

      // Act
      const result = await controller.findOne(1);

      // Assert
      expect(result).toEqual(mockCommentDto);
      expect(service.findOne).toHaveBeenCalledWith(1);
    });

    it("should propagate NotFoundException from service", async () => {
      // Arrange
      service.findOne.mockRejectedValue(new Error("Comment not found"));

      // Act & Assert
      await expect(controller.findOne(999)).rejects.toThrow(
        "Comment not found",
      );
    });
  });

  describe("update", () => {
    it("should update comment successfully", async () => {
      // Arrange
      const updateDto: UpdateCommentDto = {
        content: "Updated content",
        type: "note",
      };

      const updatedComment = {
        ...mockCommentDto,
        ...updateDto,
      };

      service.update.mockResolvedValue(updatedComment);

      // Act
      const result = await controller.update(1, updateDto);

      // Assert
      expect(result).toEqual(updatedComment);
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });

    it("should handle partial updates", async () => {
      // Arrange
      const updateDto: UpdateCommentDto = {
        isInternal: true,
      };

      service.update.mockResolvedValue(mockCommentDto);

      // Act
      await controller.update(1, updateDto);

      // Assert
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });

    it("should propagate errors from service", async () => {
      // Arrange
      const updateDto: UpdateCommentDto = {
        content: "",
      };

      service.update.mockRejectedValue(
        new Error("Comment content cannot be empty"),
      );

      // Act & Assert
      await expect(controller.update(1, updateDto)).rejects.toThrow(
        "Comment content cannot be empty",
      );
    });
  });

  describe("remove", () => {
    it("should remove comment successfully", async () => {
      // Arrange
      service.remove.mockResolvedValue(undefined);

      // Act
      await controller.remove(1);

      // Assert
      expect(service.remove).toHaveBeenCalledWith(1);
    });

    it("should propagate errors from service", async () => {
      // Arrange
      service.remove.mockRejectedValue(new Error("Comment not found"));

      // Act & Assert
      await expect(controller.remove(999)).rejects.toThrow("Comment not found");
    });
  });
});
