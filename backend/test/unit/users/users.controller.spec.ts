import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "../../../src/users/users.controller";
import { UsersService } from "../../../src/users/users.service";
import { CreateUserDto } from "../../../src/users/dto/create-user.dto";
import { UpdateUserDto } from "../../../src/users/dto/update-user.dto";
import { AuthProvidersEnum } from "../../../src/auth/auth-providers.enum";

describe("UsersController", () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const mockUser = {
    id: "550e8400-e29b-41d4-a716-446655440001",
    email: "test@example.com",
    username: "testuser",
    name: "Test User",
    enabled: true,
    currency: "USD",
    provider: AuthProvidersEnum.email,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findManyWithPagination: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      getUserRole: jest.fn().mockResolvedValue({ id: 6, name: "user" }),
      resolveRoleNamesForList: jest.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new user", async () => {
      // Arrange
      const createDto: CreateUserDto = {
        email: "newuser@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      };

      service.create.mockResolvedValue(mockUser as any);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(mockUser);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it("should propagate errors from service", async () => {
      // Arrange
      const createDto: CreateUserDto = {
        email: "test@example.com",
        password: "password123",
        firstName: "Test",
        lastName: "User",
      };

      service.create.mockRejectedValue(new Error("Email already exists"));

      // Act & Assert
      await expect(controller.create(createDto)).rejects.toThrow(
        "Email already exists",
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated users", async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 10,
      };

      const users = [mockUser];
      service.findManyWithPagination.mockResolvedValue(users as any);

      // Act
      const result = await controller.findAll(query as any);

      // Assert
      expect(result).toBeDefined();
      expect(service.findManyWithPagination).toHaveBeenCalledWith({
        filterOptions: undefined,
        sortOptions: undefined,
        paginationOptions: {
          page: 1,
          limit: 10,
        },
      });
    });

    it("should use default pagination values when not provided", async () => {
      // Arrange
      const query = {};
      service.findManyWithPagination.mockResolvedValue([mockUser] as any);

      // Act
      await controller.findAll(query as any);

      // Assert
      expect(service.findManyWithPagination).toHaveBeenCalledWith({
        filterOptions: undefined,
        sortOptions: undefined,
        paginationOptions: {
          page: 1,
          limit: 10,
        },
      });
    });

    it("should limit maximum page size to 50", async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 100,
      };

      service.findManyWithPagination.mockResolvedValue([mockUser] as any);

      // Act
      await controller.findAll(query as any);

      // Assert
      expect(service.findManyWithPagination).toHaveBeenCalledWith({
        filterOptions: undefined,
        sortOptions: undefined,
        paginationOptions: {
          page: 1,
          limit: 50,
        },
      });
    });

    it("should pass filter options to service", async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 10,
        filters: { email: "test@example.com" },
      };

      service.findManyWithPagination.mockResolvedValue([mockUser] as any);

      // Act
      await controller.findAll(query as any);

      // Assert
      expect(service.findManyWithPagination).toHaveBeenCalledWith({
        filterOptions: { email: "test@example.com" },
        sortOptions: undefined,
        paginationOptions: {
          page: 1,
          limit: 10,
        },
      });
    });

    it("should pass sort options to service", async () => {
      // Arrange
      const query = {
        page: 1,
        limit: 10,
        sort: [{ orderBy: "createdAt", order: "DESC" }],
      };

      service.findManyWithPagination.mockResolvedValue([mockUser] as any);

      // Act
      await controller.findAll(query as any);

      // Assert
      expect(service.findManyWithPagination).toHaveBeenCalledWith({
        filterOptions: undefined,
        sortOptions: [{ orderBy: "createdAt", order: "DESC" }],
        paginationOptions: {
          page: 1,
          limit: 10,
        },
      });
    });
  });

  describe("findOne", () => {
    it("should find user by ID", async () => {
      // Arrange
      service.findById.mockResolvedValue(mockUser as any);

      // Act
      const result = await controller.findOne(
        "550e8400-e29b-41d4-a716-446655440001",
      );

      // Assert
      expect(result).toEqual(mockUser);
      expect(service.findById).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
      );
    });

    it("should return null when user not found", async () => {
      // Arrange
      service.findById.mockResolvedValue(null);

      // Act
      const result = await controller.findOne(
        "550e8400-e29b-41d4-a716-446655440999",
      );

      // Assert
      expect(result).toBeNull();
      expect(service.findById).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440999",
      );
    });
  });

  describe("update", () => {
    it("should update user successfully", async () => {
      // Arrange
      const updateDto: UpdateUserDto = {
        name: "Updated Name",
        enabled: true,
      };

      const updatedUser = {
        ...mockUser,
        ...updateDto,
      };

      service.update.mockResolvedValue(updatedUser as any);

      // Act
      const result = await controller.update(
        "550e8400-e29b-41d4-a716-446655440001",
        updateDto,
      );

      // Assert
      expect(result).toEqual(updatedUser);
      expect(service.update).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
        updateDto,
      );
    });

    it("should handle partial updates", async () => {
      // Arrange
      const updateDto: UpdateUserDto = {
        enabled: false,
      };

      service.update.mockResolvedValue(mockUser as any);

      // Act
      await controller.update(
        "550e8400-e29b-41d4-a716-446655440001",
        updateDto,
      );

      // Assert
      expect(service.update).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
        updateDto,
      );
    });

    it("should propagate errors from service", async () => {
      // Arrange
      const updateDto: UpdateUserDto = {
        email: "existing@example.com",
      };

      service.update.mockRejectedValue(new Error("Email already exists"));

      // Act & Assert
      await expect(
        controller.update("550e8400-e29b-41d4-a716-446655440001", updateDto),
      ).rejects.toThrow("Email already exists");
    });
  });

  describe("remove", () => {
    it("should remove user successfully", async () => {
      // Arrange
      service.remove.mockResolvedValue(undefined);

      // Act
      await controller.remove("550e8400-e29b-41d4-a716-446655440001");

      // Assert
      expect(service.remove).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
      );
    });

    it("should propagate errors from service", async () => {
      // Arrange
      service.remove.mockRejectedValue(new Error("User not found"));

      // Act & Assert
      await expect(
        controller.remove("550e8400-e29b-41d4-a716-446655440999"),
      ).rejects.toThrow("User not found");
    });
  });
});
