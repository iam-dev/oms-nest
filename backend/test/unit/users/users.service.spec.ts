import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Logger, UnprocessableEntityException } from "@nestjs/common";
import { UsersService } from "../../../src/users/users.service";
import { UserRepository } from "../../../src/users/infrastructure/persistence/user.repository";
import { FilesService } from "../../../src/files/files.service";
import { FitterEntity } from "../../../src/fitters/infrastructure/persistence/relational/entities/fitter.entity";
import { RoleEntity } from "../../../src/roles/infrastructure/persistence/relational/entities/role.entity";
import { RoleEnum } from "../../../src/roles/roles.enum";
import { StatusEnum } from "../../../src/statuses/statuses.enum";
import { AuthProvidersEnum } from "../../../src/auth/auth-providers.enum";

jest.mock("bcryptjs", () => ({
  genSalt: jest.fn().mockResolvedValue("mock-salt"),
  hash: jest.fn().mockResolvedValue("hashed-password"),
}));

describe("UsersService", () => {
  let service: UsersService;
  let usersRepository: any;
  let filesService: any;
  let fitterRepository: any;
  let roleRepository: any;

  const mockUser = {
    id: 1,
    email: "test@example.com",
    username: "testuser",
    name: "Test User",
    password: "hashed-password",
    enabled: true,
    currency: "USD",
    provider: AuthProvidersEnum.email,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIds: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailOrUsername: jest.fn(),
      findBySocialIdAndProvider: jest.fn(),
      findManyWithPagination: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    filesService = {
      findById: jest.fn(),
    };

    fitterRepository = {
      findOne: jest.fn(),
    };

    roleRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRepository, useValue: usersRepository },
        { provide: FilesService, useValue: filesService },
        {
          provide: getRepositoryToken(FitterEntity),
          useValue: fitterRepository,
        },
        { provide: getRepositoryToken(RoleEntity), useValue: roleRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserRole", () => {
    it("should return supervisor role when isSupervisor is 1", async () => {
      // Arrange
      const supervisorRole = { id: RoleEnum.supervisor, name: "supervisor" };
      roleRepository.findOne.mockResolvedValue(supervisorRole);

      // Act
      const result = await service.getUserRole(1, "user", 1, 1);

      // Assert
      expect(result).toEqual({ id: RoleEnum.supervisor, name: "supervisor" });
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: "supervisor" },
      });
    });

    it("should return supervisor role fallback when role not found in DB", async () => {
      // Arrange
      roleRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getUserRole(1, "user", 1, 1);

      // Assert
      expect(result).toEqual({ id: RoleEnum.supervisor, name: "supervisor" });
    });

    it("should return supervisor role when userType is 2 and isSupervisor is 1 (supervisor takes priority over admin)", async () => {
      // Regression test: userType=2 + isSupervisor=1 must resolve to supervisor, not admin
      const supervisorRole = { id: RoleEnum.supervisor, name: "supervisor" };
      roleRepository.findOne.mockResolvedValue(supervisorRole);

      const result = await service.getUserRole(1, "customcary", 2, 1);

      expect(result).toEqual({ id: RoleEnum.supervisor, name: "supervisor" });
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: "supervisor" },
      });
    });

    it("should return admin role when userType is 2", async () => {
      // Arrange
      const adminRole = { id: RoleEnum.admin, name: "admin" };
      roleRepository.findOne.mockResolvedValue(adminRole);

      // Act
      const result = await service.getUserRole(1, "user", 2, 0);

      // Assert
      expect(result).toEqual({ id: RoleEnum.admin, name: "admin" });
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: "admin" },
      });
    });

    it("should return factory role when userType is 3", async () => {
      // Arrange
      const factoryRole = { id: RoleEnum.factory, name: "factory" };
      roleRepository.findOne.mockResolvedValue(factoryRole);

      // Act
      const result = await service.getUserRole(1, "user", 3, 0);

      // Assert
      expect(result).toEqual({ id: RoleEnum.factory, name: "factory" });
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: "factory" },
      });
    });

    it("should return customsaddler role when userType is 4", async () => {
      // Arrange
      const customsaddlerRole = {
        id: RoleEnum.customsaddler,
        name: "customsaddler",
      };
      roleRepository.findOne.mockResolvedValue(customsaddlerRole);

      // Act
      const result = await service.getUserRole(1, "user", 4, 0);

      // Assert
      expect(result).toEqual({
        id: RoleEnum.customsaddler,
        name: "customsaddler",
      });
    });

    it("should return fitter role when userType is 1 and user is in fitters table", async () => {
      // Arrange
      const fitterRole = { id: RoleEnum.fitter, name: "fitter" };
      fitterRepository.findOne.mockResolvedValue({ userId: 1 });
      roleRepository.findOne.mockResolvedValue(fitterRole);

      // Act
      const result = await service.getUserRole(1, "user", 1, 0);

      // Assert
      expect(result).toEqual({ id: RoleEnum.fitter, name: "fitter" });
      expect(fitterRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 1 },
      });
    });

    it("should fallback to check fitters table when userType is not set", async () => {
      // Arrange
      const fitterRole = { id: RoleEnum.fitter, name: "fitter" };
      fitterRepository.findOne.mockResolvedValue({ userId: 1 });
      roleRepository.findOne.mockResolvedValue(fitterRole);

      // Act
      const result = await service.getUserRole(1, "user", null, 0);

      // Assert
      expect(result).toEqual({ id: RoleEnum.fitter, name: "fitter" });
    });

    it("should return user role when no special conditions match", async () => {
      // Arrange
      const userRole = { id: RoleEnum.user, name: "user" };
      fitterRepository.findOne.mockResolvedValue(null);
      roleRepository.findOne.mockResolvedValue(userRole);

      // Act
      const result = await service.getUserRole(1, "user", null, 0);

      // Assert
      expect(result).toEqual({ id: RoleEnum.user, name: "user" });
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: "user" },
      });
    });
  });

  describe("create", () => {
    it("should create a new user with hashed password", async () => {
      // Arrange
      const createDto = {
        email: "newuser@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      };

      usersRepository.findByEmail.mockResolvedValue(null);
      usersRepository.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toBeDefined();
      expect(usersRepository.findByEmail).toHaveBeenCalledWith(createDto.email);
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: createDto.email,
          password: "hashed-password",
          name: "John Doe",
        }),
      );
    });

    it("should throw UnprocessableEntityException when email already exists", async () => {
      // Arrange
      const createDto = {
        email: "existing@example.com",
        password: "password123",
        firstName: null,
        lastName: null,
      };

      usersRepository.findByEmail.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(usersRepository.create).not.toHaveBeenCalled();
    });

    it("should validate photo exists when photo ID is provided", async () => {
      // Arrange
      const createDto = {
        email: "test@example.com",
        password: "password123",
        firstName: null,
        lastName: null,
        photo: { id: "photo-id", path: "/uploads/photo.jpg" },
      };

      usersRepository.findByEmail.mockResolvedValue(null);
      filesService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should validate role exists when role ID is provided", async () => {
      // Arrange
      const createDto = {
        email: "test@example.com",
        password: "password123",
        firstName: null,
        lastName: null,
        role: { id: 999 },
      };

      usersRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should validate status exists when status ID is provided", async () => {
      // Arrange
      const createDto = {
        email: "test@example.com",
        password: "password123",
        firstName: null,
        lastName: null,
        status: { id: 999 },
      };

      usersRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(service.create(createDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should create user with valid role", async () => {
      // Arrange
      const createDto = {
        email: "test@example.com",
        password: "password123",
        firstName: null,
        lastName: null,
        role: { id: RoleEnum.user },
      };

      usersRepository.findByEmail.mockResolvedValue(null);
      usersRepository.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toBeDefined();
      expect(usersRepository.create).toHaveBeenCalled();
    });

    it("should create user with valid status", async () => {
      // Arrange
      const createDto = {
        email: "test@example.com",
        password: "password123",
        firstName: null,
        lastName: null,
        status: { id: StatusEnum.active },
      };

      usersRepository.findByEmail.mockResolvedValue(null);
      usersRepository.create.mockResolvedValue(mockUser);

      // Act
      const result = await service.create(createDto);

      // Assert
      expect(result).toBeDefined();
      expect(usersRepository.create).toHaveBeenCalled();
    });
  });

  describe("findManyWithPagination", () => {
    it("should find users with pagination options", async () => {
      // Arrange
      const options = {
        paginationOptions: { page: 1, limit: 10 },
      };

      usersRepository.findManyWithPagination.mockResolvedValue([mockUser]);

      // Act
      const result = await service.findManyWithPagination(options);

      // Assert
      expect(result).toEqual([mockUser]);
      expect(usersRepository.findManyWithPagination).toHaveBeenCalledWith(
        options,
      );
    });
  });

  describe("findById", () => {
    it("should find user by ID", async () => {
      // Arrange
      usersRepository.findById.mockResolvedValue(mockUser);

      // Act
      const result = await service.findById(1);

      // Assert
      expect(result).toEqual(mockUser);
      expect(usersRepository.findById).toHaveBeenCalledWith(1);
    });

    it("should return null when user not found", async () => {
      // Arrange
      usersRepository.findById.mockResolvedValue(null);

      // Act
      const result = await service.findById(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("findByIds", () => {
    it("should find users by multiple IDs", async () => {
      // Arrange
      usersRepository.findByIds.mockResolvedValue([mockUser]);

      // Act
      const result = await service.findByIds([1, 2]);

      // Assert
      expect(result).toEqual([mockUser]);
      expect(usersRepository.findByIds).toHaveBeenCalledWith([1, 2]);
    });
  });

  describe("findByEmail", () => {
    it("should find user by email", async () => {
      // Arrange
      usersRepository.findByEmail.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByEmail("test@example.com");

      // Assert
      expect(result).toEqual(mockUser);
      expect(usersRepository.findByEmail).toHaveBeenCalledWith(
        "test@example.com",
      );
    });
  });

  describe("findByEmailOrUsername", () => {
    it("should find user by email or username", async () => {
      // Arrange
      usersRepository.findByEmailOrUsername.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByEmailOrUsername("testuser");

      // Assert
      expect(result).toEqual(mockUser);
      expect(usersRepository.findByEmailOrUsername).toHaveBeenCalledWith(
        "testuser",
      );
    });
  });

  describe("findBySocialIdAndProvider", () => {
    it("should find user by social ID and provider", async () => {
      // Arrange
      usersRepository.findBySocialIdAndProvider.mockResolvedValue(mockUser);

      // Act
      const result = await service.findBySocialIdAndProvider({
        socialId: "123456",
        provider: "google",
      });

      // Assert
      expect(result).toEqual(mockUser);
      expect(usersRepository.findBySocialIdAndProvider).toHaveBeenCalledWith({
        socialId: "123456",
        provider: "google",
      });
    });
  });

  describe("update", () => {
    it("should update user successfully", async () => {
      // Arrange
      const updateDto = {
        name: "Updated Name",
        enabled: true,
      };

      usersRepository.findById.mockResolvedValue(mockUser);
      usersRepository.update.mockResolvedValue({
        ...mockUser,
        ...updateDto,
      });

      // Act
      const result = await service.update(1, updateDto);

      // Assert
      expect(result).toMatchObject(updateDto);
      expect(usersRepository.update).toHaveBeenCalled();
    });

    it("should hash password when updating password", async () => {
      // Arrange
      const updateDto = {
        password: "newpassword123",
      };

      usersRepository.findById.mockResolvedValue(mockUser);
      usersRepository.update.mockResolvedValue(mockUser);

      // Act
      await service.update(1, updateDto);

      // Assert
      expect(usersRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          password: "hashed-password",
        }),
      );
    });

    it("should not rehash password if it hasn't changed", async () => {
      // Arrange
      const updateDto = {
        password: "hashed-password",
      };

      usersRepository.findById.mockResolvedValue(mockUser);
      usersRepository.update.mockResolvedValue(mockUser);

      // Act
      await service.update(1, updateDto);

      // Assert
      expect(usersRepository.update).toHaveBeenCalledWith(
        1,
        expect.not.objectContaining({
          password: "hashed-password",
        }),
      );
    });

    it("should throw UnprocessableEntityException when updating to existing email", async () => {
      // Arrange
      const updateDto = {
        email: "existing@example.com",
      };

      const existingUser = { ...mockUser, id: 2 };
      usersRepository.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(service.update(1, updateDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(usersRepository.update).not.toHaveBeenCalled();
    });

    it("should allow updating to same email", async () => {
      // Arrange
      const updateDto = {
        email: mockUser.email,
      };

      usersRepository.findByEmail.mockResolvedValue(mockUser);
      usersRepository.update.mockResolvedValue(mockUser);

      // Act
      const result = await service.update(1, updateDto);

      // Assert
      expect(result).toBeDefined();
      expect(usersRepository.update).toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should remove user successfully", async () => {
      // Arrange
      usersRepository.remove.mockResolvedValue(undefined);

      // Act
      await service.remove(1);

      // Assert
      expect(usersRepository.remove).toHaveBeenCalledWith(1);
    });
  });

  describe("validateLoginSecurity", () => {
    it("should validate login security", async () => {
      // Arrange
      const loggerSpy = jest
        .spyOn(Logger.prototype, "log")
        .mockImplementation();

      // Act
      await service.validateLoginSecurity(1, "192.168.1.1");

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("Validating login security"),
      );
      loggerSpy.mockRestore();
    });
  });

  describe("recordLoginAttempt", () => {
    it("should record login attempt", async () => {
      // Arrange
      const loggerSpy = jest
        .spyOn(Logger.prototype, "log")
        .mockImplementation();
      const attemptData = { userId: 1, ipAddress: "192.168.1.1" };

      // Act
      await service.recordLoginAttempt(attemptData);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("Recording login attempt"),
      );
      loggerSpy.mockRestore();
    });
  });

  describe("unlockAccount", () => {
    it("should unlock user account", async () => {
      // Arrange
      usersRepository.update.mockResolvedValue(mockUser);

      // Act
      await service.unlockAccount(1);

      // Assert
      expect(usersRepository.update).toHaveBeenCalledWith(1, {
        enabled: true,
      });
    });
  });
});
