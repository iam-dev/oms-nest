import { Test, TestingModule } from "@nestjs/testing";
import {
  HttpStatus,
  UnprocessableEntityException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcryptjs";
import { AuthService } from "../../../src/auth/auth.service";
import { UsersService } from "../../../src/users/users.service";
import { SessionService } from "../../../src/session/session.service";
import { MailService } from "../../../src/mail/mail.service";
import { AuthEmailLoginDto } from "../../../src/auth/dto/auth-email-login.dto";
import { AuthRegisterLoginDto } from "../../../src/auth/dto/auth-register-login.dto";
import { AuthProvidersEnum } from "../../../src/auth/auth-providers.enum";
import { RoleEnum } from "../../../src/roles/roles.enum";
import { StatusEnum } from "../../../src/statuses/statuses.enum";
import { User } from "../../../src/users/domain/user";
import { Session } from "../../../src/session/domain/session";
import { AuditLoggingService } from "../../../src/audit-logging/audit-logging.service";

// Mock bcrypt
jest.mock("bcryptjs");
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe("AuthService", () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let sessionService: jest.Mocked<SessionService>;
  let jwtService: jest.Mocked<JwtService>;
  let mailService: jest.Mocked<MailService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser: Partial<User> = {
    id: "550e8400-e29b-41d4-a716-446655440001",
    email: "test@example.com",
    username: "testuser",
    name: "Test User",
    currency: "USD",
    password: "$2a$10$hashedpassword",
    provider: AuthProvidersEnum.email,
    enabled: true,
    userType: 1, // fitter
    isSupervisor: 0,
    legacyId: 1,
  };

  const mockSession: Partial<Session> = {
    id: 123,
    user: mockUser as User,
    hash: "session-hash",
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmailOrUsername: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findBySocialIdAndProvider: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getUserRole: jest.fn(),
    };

    const mockSessionService = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
      deleteByUserId: jest.fn(),
      deleteByUserIdWithExclude: jest.fn(),
    };

    const mockJwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
    };

    const mockMailService = {
      userSignUp: jest.fn(),
      forgotPassword: jest.fn(),
      confirmNewEmail: jest.fn(),
    };

    const mockConfigService = {
      getOrThrow: jest.fn(),
    };

    const mockAuditLoggingService = {
      logAction: jest.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: MailService, useValue: mockMailService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuditLoggingService, useValue: mockAuditLoggingService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    sessionService = module.get(SessionService);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
    configService = module.get(ConfigService);

    // Setup default config service responses
    configService.getOrThrow.mockImplementation((key) => {
      const configs = {
        "auth.secret": "test-secret",
        "auth.expires": "15m",
        "auth.refreshSecret": "refresh-secret",
        "auth.refreshExpires": "7d",
        "auth.confirmEmailSecret": "confirm-secret",
        "auth.confirmEmailExpires": "1d",
        "auth.forgotSecret": "forgot-secret",
        "auth.forgotExpires": "1h",
      };
      return configs[key] || "default-value";
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockBcrypt.compare.mockClear();
    mockBcrypt.hash.mockClear();
  });

  describe("validateLogin", () => {
    it("should validate login with email successfully", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "test@example.com",
        password: "password123",
      };
      usersService.findByEmailOrUsername.mockResolvedValue(mockUser as User);
      usersService.getUserRole.mockResolvedValue({ id: 1, name: "user" });
      mockBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync.mockResolvedValue("jwt-token");

      // Act
      const result = await service.validateLogin(loginDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.token).toBe("jwt-token");
      expect(usersService.findByEmailOrUsername).toHaveBeenCalledWith(
        loginDto.email,
      );
      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
    });

    it("should validate login with username successfully", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "testuser", // Username instead of email
        password: "password123",
      };
      usersService.findByEmailOrUsername.mockResolvedValue(mockUser as User);
      usersService.getUserRole.mockResolvedValue({ id: 1, name: "user" });
      mockBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync.mockResolvedValue("jwt-token");

      // Act
      const result = await service.validateLogin(loginDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.token).toBe("jwt-token");
      expect(usersService.findByEmailOrUsername).toHaveBeenCalledWith(
        "testuser",
      );
    });

    it("should throw error when user not found", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "nonexistent@example.com",
        password: "password123",
      };
      usersService.findByEmailOrUsername.mockResolvedValue(null);

      // Act & Assert
      await expect(service.validateLogin(loginDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(usersService.findByEmailOrUsername).toHaveBeenCalledWith(
        loginDto.email,
      );
    });

    it("should throw error for non-email provider", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "test@example.com",
        password: "password123",
      };
      const socialUser = {
        ...mockUser,
        provider: AuthProvidersEnum.google,
      };
      usersService.findByEmailOrUsername.mockResolvedValue(socialUser as User);

      // Act & Assert
      await expect(service.validateLogin(loginDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should throw error when user has no password", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "test@example.com",
        password: "password123",
      };
      const userWithoutPassword = { ...mockUser, password: null };
      usersService.findByEmailOrUsername.mockResolvedValue(
        userWithoutPassword as User,
      );

      // Act & Assert
      await expect(service.validateLogin(loginDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should throw error for incorrect password", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "test@example.com",
        password: "wrongpassword",
      };
      usersService.findByEmailOrUsername.mockResolvedValue(mockUser as User);
      mockBcrypt.compare.mockResolvedValue(false as never);

      // Act & Assert
      await expect(service.validateLogin(loginDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.password,
      );
    });

    it("should generate JWT token with correct payload", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "test@example.com",
        password: "password123",
      };
      usersService.findByEmailOrUsername.mockResolvedValue(mockUser as User);
      usersService.getUserRole.mockResolvedValue({ id: 1, name: "user" });
      mockBcrypt.compare.mockResolvedValue(true as never);
      jwtService.signAsync.mockResolvedValue("jwt-token");

      // Act
      await service.validateLogin(loginDto);

      // Assert
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          id: mockUser.id,
          legacyId: mockUser.legacyId,
          role: { id: 1, name: "user" },
          roles: ["ROLE_USER"],
          username: mockUser.username,
          enabled: mockUser.enabled,
        },
        {
          secret: "test-secret",
          expiresIn: "15m",
        },
      );
    });
  });

  describe("register", () => {
    it("should register new user successfully", async () => {
      // Arrange
      const registerDto: AuthRegisterLoginDto = {
        email: "newuser@example.com",
        password: "password123",
        firstName: "New",
        lastName: "User",
      };
      const createdUser = {
        ...registerDto,
        id: "550e8400-e29b-41d4-a716-446655440002",
        name: `${registerDto.firstName} ${registerDto.lastName}`,
        username: registerDto.email.split("@")[0],
        currency: "USD",
        provider: "email",
        enabled: false,
      };
      usersService.create.mockResolvedValue(createdUser as User);
      jwtService.signAsync.mockResolvedValue("confirmation-token");
      mailService.userSignUp.mockResolvedValue(undefined);

      // Act
      await service.register(registerDto);

      // Assert
      expect(usersService.create).toHaveBeenCalledWith({
        ...registerDto,
        email: registerDto.email,
        role: { id: RoleEnum.user },
        status: { id: StatusEnum.inactive },
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { confirmEmailUserId: "550e8400-e29b-41d4-a716-446655440002" },
        {
          secret: "confirm-secret",
          expiresIn: "1d",
        },
      );
      expect(mailService.userSignUp).toHaveBeenCalledWith({
        to: registerDto.email,
        data: { hash: "confirmation-token" },
      });
    });

    it("should handle user creation errors", async () => {
      // Arrange
      const registerDto: AuthRegisterLoginDto = {
        email: "existing@example.com",
        password: "password123",
        firstName: "Existing",
        lastName: "User",
      };
      usersService.create.mockRejectedValue(
        new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { email: "emailExists" },
        }),
      );

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(usersService.create).toHaveBeenCalled();
    });
  });

  describe("confirmEmail", () => {
    it("should confirm email with valid hash", async () => {
      // Arrange
      const hash = "valid-confirmation-hash";
      const jwtPayload = {
        confirmEmailUserId: "550e8400-e29b-41d4-a716-446655440001",
      };
      jwtService.verifyAsync.mockResolvedValue(jwtPayload);
      usersService.findById.mockResolvedValue({
        ...mockUser,
        enabled: false,
      } as User);
      usersService.update.mockResolvedValue({
        ...mockUser,
        enabled: true,
      } as User);

      // Act
      await service.confirmEmail(hash);

      // Assert
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(hash, {
        secret: "confirm-secret",
      });
      expect(usersService.findById).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
      );
      expect(usersService.update).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
        { enabled: true },
      );
    });

    it("should throw error for invalid hash", async () => {
      // Arrange
      const hash = "invalid-hash";
      jwtService.verifyAsync.mockRejectedValue(new Error("Invalid token"));

      // Act & Assert
      await expect(service.confirmEmail(hash)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(hash, {
        secret: "confirm-secret",
      });
    });

    it("should throw error when user not found", async () => {
      // Arrange
      const hash = "valid-hash";
      const jwtPayload = {
        confirmEmailUserId: "550e8400-e29b-41d4-a716-446655440999",
      };
      jwtService.verifyAsync.mockResolvedValue(jwtPayload);
      usersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.confirmEmail(hash)).rejects.toThrow(
        NotFoundException,
      );
      expect(usersService.findById).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440999",
      );
    });

    it("should throw error when user already enabled", async () => {
      // Arrange
      const hash = "valid-hash";
      const jwtPayload = {
        confirmEmailUserId: "550e8400-e29b-41d4-a716-446655440001",
      };
      jwtService.verifyAsync.mockResolvedValue(jwtPayload);
      usersService.findById.mockResolvedValue({
        ...mockUser,
        enabled: true,
      } as User);

      // Act & Assert
      await expect(service.confirmEmail(hash)).rejects.toThrow(
        NotFoundException,
      );
      expect(usersService.findById).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
      );
    });
  });

  describe("forgotPassword", () => {
    it("should send forgot password email for existing user", async () => {
      // Arrange
      const email = "test@example.com";
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      jwtService.signAsync.mockResolvedValue("reset-token");
      mailService.forgotPassword.mockResolvedValue(undefined);

      // Act
      await service.forgotPassword(email);

      // Assert
      expect(usersService.findByEmail).toHaveBeenCalledWith(email);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { forgotUserId: mockUser.id },
        {
          secret: "forgot-secret",
          expiresIn: "1h",
        },
      );
      expect(mailService.forgotPassword).toHaveBeenCalledWith({
        to: email,
        data: {
          hash: "reset-token",
          tokenExpires: expect.any(Number),
        },
      });
    });

    it("should throw error for non-existent email", async () => {
      // Arrange
      const email = "nonexistent@example.com";
      usersService.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(service.forgotPassword(email)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(usersService.findByEmail).toHaveBeenCalledWith(email);
    });
  });

  describe("resetPassword", () => {
    it("should reset password with valid hash", async () => {
      // Arrange
      const hash = "valid-reset-hash";
      const newPassword = "newpassword123";
      const jwtPayload = {
        forgotUserId: "550e8400-e29b-41d4-a716-446655440001",
      };
      jwtService.verifyAsync.mockResolvedValue(jwtPayload);
      usersService.findById.mockResolvedValue(mockUser as User);
      sessionService.deleteByUserId.mockResolvedValue(undefined);
      usersService.update.mockResolvedValue({
        ...mockUser,
        enabled: true,
      } as User);

      // Act
      await service.resetPassword(hash, newPassword);

      // Assert
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(hash, {
        secret: "forgot-secret",
      });
      expect(usersService.findById).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
      );
      expect(sessionService.deleteByUserId).toHaveBeenCalledWith({
        userId: "550e8400-e29b-41d4-a716-446655440001",
      });
      expect(usersService.update).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
        {
          password: newPassword,
        },
      );
    });

    it("should throw error for invalid reset hash", async () => {
      // Arrange
      const hash = "invalid-hash";
      const newPassword = "newpassword123";
      jwtService.verifyAsync.mockRejectedValue(new Error("Invalid token"));

      // Act & Assert
      await expect(service.resetPassword(hash, newPassword)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it("should throw error when user not found for reset", async () => {
      // Arrange
      const hash = "valid-hash";
      const newPassword = "newpassword123";
      const jwtPayload = {
        forgotUserId: "550e8400-e29b-41d4-a716-446655440999",
      };
      jwtService.verifyAsync.mockResolvedValue(jwtPayload);
      usersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.resetPassword(hash, newPassword)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe("me", () => {
    it("should return current user with typeName", async () => {
      // Arrange
      const jwtPayload = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        role: { id: 1, name: "user" },
        iat: 1234567890,
        exp: 1234567990,
      };
      const mockRole = { id: 2, name: "supervisor" };
      usersService.findById.mockResolvedValue(mockUser as User);
      usersService.getUserRole.mockResolvedValue(mockRole);

      // Act
      const result = await service.me(jwtPayload);

      // Assert
      expect(result).toEqual({ ...mockUser, typeName: "supervisor" });
      expect(usersService.findById).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440001",
      );
      expect(usersService.getUserRole).toHaveBeenCalledWith(
        1,
        "testuser",
        1,
        0,
      );
    });

    it("should return null when user not found", async () => {
      // Arrange
      const jwtPayload = {
        id: "550e8400-e29b-41d4-a716-446655440999",
        role: { id: 1, name: "user" },
        iat: 1234567890,
        exp: 1234567990,
      };
      usersService.findById.mockResolvedValue(null);

      // Act
      const result = await service.me(jwtPayload);

      // Assert
      expect(result).toBeNull();
      expect(usersService.findById).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440999",
      );
    });
  });

  describe("refreshToken", () => {
    it("should refresh token with valid session", async () => {
      // Arrange
      const refreshData = { sessionId: 123, hash: "session-hash" };
      sessionService.findById.mockResolvedValue(mockSession as Session);
      usersService.findById.mockResolvedValue(mockUser as User);
      sessionService.update.mockResolvedValue(mockSession as Session);
      jwtService.signAsync
        .mockResolvedValueOnce("new-jwt-token")
        .mockResolvedValueOnce("new-refresh-token");

      // Act
      const result = await service.refreshToken(refreshData);

      // Assert
      expect(sessionService.findById).toHaveBeenCalledWith(123);
      expect(sessionService.update).toHaveBeenCalledWith(123, {
        hash: expect.any(String),
      });
      expect(result.token).toBe("new-jwt-token");
      expect(result.refreshToken).toBe("new-refresh-token");
    });

    it("should throw error when session not found", async () => {
      // Arrange
      const refreshData = { sessionId: 999, hash: "session-hash" };
      sessionService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.refreshToken(refreshData)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw error when session hash doesn't match", async () => {
      // Arrange
      const refreshData = { sessionId: 123, hash: "wrong-hash" };
      sessionService.findById.mockResolvedValue(mockSession as Session);

      // Act & Assert
      await expect(service.refreshToken(refreshData)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw error when user not found for refresh", async () => {
      // Arrange
      const refreshData = { sessionId: 123, hash: "session-hash" };
      sessionService.findById.mockResolvedValue(mockSession as Session);
      usersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.refreshToken(refreshData)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("logout", () => {
    it("should logout user by deleting session", async () => {
      // Arrange
      const logoutData = { sessionId: 123 };
      sessionService.deleteById.mockResolvedValue(undefined);

      // Act
      await service.logout(logoutData);

      // Assert
      expect(sessionService.deleteById).toHaveBeenCalledWith(123);
    });
  });

  describe("softDelete", () => {
    it("should soft delete user", async () => {
      // Arrange
      usersService.remove.mockResolvedValue(undefined);

      // Act
      await service.softDelete(mockUser as User);

      // Assert
      expect(usersService.remove).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe("getTokensData", () => {
    it("should generate access and refresh tokens", async () => {
      // Arrange
      const tokenData = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        role: { id: 1, name: "user" },
        sessionId: 123,
        hash: "session-hash",
      };
      jwtService.signAsync
        .mockResolvedValueOnce("access-token")
        .mockResolvedValueOnce("refresh-token");

      // Act
      const result = await (service as any).getTokensData(tokenData);

      // Assert
      expect(result.token).toBe("access-token");
      expect(result.refreshToken).toBe("refresh-token");
      expect(result.tokenExpires).toBeGreaterThan(Date.now());
      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    });
  });
});
