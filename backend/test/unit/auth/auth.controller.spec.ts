import { Test, TestingModule } from "@nestjs/testing";
import { HttpStatus, UnprocessableEntityException } from "@nestjs/common";
import { AuthController } from "../../../src/auth/auth.controller";
import { AuthService } from "../../../src/auth/auth.service";
import { AuthEmailLoginDto } from "../../../src/auth/dto/auth-email-login.dto";
import { AuthRegisterLoginDto } from "../../../src/auth/dto/auth-register-login.dto";
import { AuthConfirmEmailDto } from "../../../src/auth/dto/auth-confirm-email.dto";
import { AuthForgotPasswordDto } from "../../../src/auth/dto/auth-forgot-password.dto";
import { AuthResetPasswordDto } from "../../../src/auth/dto/auth-reset-password.dto";
import { AuthUpdateDto } from "../../../src/auth/dto/auth-update.dto";
import { LoginResponseDto } from "../../../src/auth/dto/login-response.dto";
import { RefreshResponseDto } from "../../../src/auth/dto/refresh-response.dto";
import { User } from "../../../src/users/domain/user";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockResponse = () => {
    const res: any = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockUser: Partial<User> = {
    id: "550e8400-e29b-41d4-a716-446655440001",
    email: "test@example.com",
    username: "testuser",
    name: "Test User",
    currency: "USD",
    provider: "email",
    enabled: true,
  };

  const mockLoginResponse: LoginResponseDto = {
    token: "jwt-token",
    refreshToken: "refresh-token",
    tokenExpires: Date.now() + 900000,
    user: mockUser as User,
  };

  const mockRefreshResponse: RefreshResponseDto = {
    token: "new-jwt-token",
    refreshToken: "new-refresh-token",
    tokenExpires: Date.now() + 900000,
  };

  beforeEach(async () => {
    const mockAuthService = {
      validateLogin: jest.fn(),
      register: jest.fn(),
      confirmEmail: jest.fn(),
      confirmNewEmail: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      me: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    it("should return login response with valid credentials", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "test@example.com",
        password: "password123",
      };
      const res = mockResponse();
      authService.validateLogin.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login(loginDto, res);

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(authService.validateLogin).toHaveBeenCalledWith(loginDto);
      expect(authService.validateLogin).toHaveBeenCalledTimes(1);
      expect(res.cookie).toHaveBeenCalledWith(
        "token",
        mockLoginResponse.token,
        expect.any(Object),
      );
    });

    it("should throw UnprocessableEntityException for invalid credentials", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "wrong@example.com",
        password: "wrongpassword",
      };
      authService.validateLogin.mockRejectedValue(
        new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { email: "notFound" },
        }),
      );

      // Act & Assert
      await expect(controller.login(loginDto, mockResponse())).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(authService.validateLogin).toHaveBeenCalledWith(loginDto);
    });

    it("should accept username as email field", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "testuser", // Using username instead of email
        password: "password123",
      };
      authService.validateLogin.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login(loginDto, mockResponse());

      // Assert
      expect(result).toEqual(mockLoginResponse);
      expect(authService.validateLogin).toHaveBeenCalledWith(loginDto);
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
      authService.register.mockResolvedValue();

      // Act
      await controller.register(registerDto);

      // Assert
      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(authService.register).toHaveBeenCalledTimes(1);
    });

    it("should handle registration errors", async () => {
      // Arrange
      const registerDto: AuthRegisterLoginDto = {
        email: "existing@example.com",
        password: "password123",
        firstName: "Existing",
        lastName: "User",
      };
      authService.register.mockRejectedValue(
        new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { email: "emailExists" },
        }),
      );

      // Act & Assert
      await expect(controller.register(registerDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe("confirmEmail", () => {
    it("should confirm email with valid hash", async () => {
      // Arrange
      const confirmDto: AuthConfirmEmailDto = {
        hash: "valid-confirmation-hash",
      };
      authService.confirmEmail.mockResolvedValue();

      // Act
      await controller.confirmEmail(confirmDto);

      // Assert
      expect(authService.confirmEmail).toHaveBeenCalledWith(confirmDto.hash);
      expect(authService.confirmEmail).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid confirmation hash", async () => {
      // Arrange
      const confirmDto: AuthConfirmEmailDto = {
        hash: "invalid-hash",
      };
      authService.confirmEmail.mockRejectedValue(
        new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { hash: "invalidHash" },
        }),
      );

      // Act & Assert
      await expect(controller.confirmEmail(confirmDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(authService.confirmEmail).toHaveBeenCalledWith(confirmDto.hash);
    });
  });

  describe("confirmNewEmail", () => {
    it("should confirm new email with valid hash", async () => {
      // Arrange
      const confirmDto: AuthConfirmEmailDto = {
        hash: "valid-new-email-hash",
      };
      authService.confirmNewEmail.mockResolvedValue();

      // Act
      await controller.confirmNewEmail(confirmDto);

      // Assert
      expect(authService.confirmNewEmail).toHaveBeenCalledWith(confirmDto.hash);
      expect(authService.confirmNewEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe("forgotPassword", () => {
    it("should send forgot password email for valid email", async () => {
      // Arrange
      const forgotDto: AuthForgotPasswordDto = {
        email: "test@example.com",
      };
      authService.forgotPassword.mockResolvedValue();

      // Act
      await controller.forgotPassword(forgotDto);

      // Assert
      expect(authService.forgotPassword).toHaveBeenCalledWith(forgotDto.email);
      expect(authService.forgotPassword).toHaveBeenCalledTimes(1);
    });

    it("should handle non-existent email", async () => {
      // Arrange
      const forgotDto: AuthForgotPasswordDto = {
        email: "nonexistent@example.com",
      };
      authService.forgotPassword.mockRejectedValue(
        new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { email: "emailNotExists" },
        }),
      );

      // Act & Assert
      await expect(controller.forgotPassword(forgotDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(authService.forgotPassword).toHaveBeenCalledWith(forgotDto.email);
    });
  });

  describe("resetPassword", () => {
    it("should reset password with valid hash and new password", async () => {
      // Arrange
      const resetDto: AuthResetPasswordDto = {
        hash: "valid-reset-hash",
        password: "newpassword123",
      };
      authService.resetPassword.mockResolvedValue();

      // Act
      await controller.resetPassword(resetDto);

      // Assert
      expect(authService.resetPassword).toHaveBeenCalledWith(
        resetDto.hash,
        resetDto.password,
      );
      expect(authService.resetPassword).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid reset hash", async () => {
      // Arrange
      const resetDto: AuthResetPasswordDto = {
        hash: "invalid-hash",
        password: "newpassword123",
      };
      authService.resetPassword.mockRejectedValue(
        new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { hash: "invalidHash" },
        }),
      );

      // Act & Assert
      await expect(controller.resetPassword(resetDto)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(authService.resetPassword).toHaveBeenCalledWith(
        resetDto.hash,
        resetDto.password,
      );
    });
  });

  describe("me", () => {
    it("should return current user information", async () => {
      // Arrange
      const mockRequest = {
        user: { id: 1, role: { id: 1, name: "user" } },
      };
      authService.me.mockResolvedValue(mockUser as User);

      // Act
      const result = await controller.me(mockRequest);

      // Assert
      expect(result).toEqual(mockUser);
      expect(authService.me).toHaveBeenCalledWith(mockRequest.user);
      expect(authService.me).toHaveBeenCalledTimes(1);
    });

    it("should handle user not found", async () => {
      // Arrange
      const mockRequest = {
        user: { id: 999, role: { id: 1, name: "user" } },
      };
      authService.me.mockResolvedValue(null);

      // Act
      const result = await controller.me(mockRequest);

      // Assert
      expect(result).toBeNull();
      expect(authService.me).toHaveBeenCalledWith(mockRequest.user);
    });
  });

  describe("refresh", () => {
    it("should return new tokens with valid refresh token", async () => {
      // Arrange
      const mockRequest = {
        user: { sessionId: 123, hash: "session-hash" },
      };
      const res = mockResponse();
      authService.refreshToken.mockResolvedValue(mockRefreshResponse);

      // Act
      const result = await controller.refresh(mockRequest, res);

      // Assert
      expect(result).toEqual(mockRefreshResponse);
      expect(res.cookie).toHaveBeenCalledWith(
        "token",
        mockRefreshResponse.token,
        expect.any(Object),
      );
      expect(authService.refreshToken).toHaveBeenCalledWith({
        sessionId: mockRequest.user.sessionId,
        hash: mockRequest.user.hash,
      });
      expect(authService.refreshToken).toHaveBeenCalledTimes(1);
    });
  });

  describe("logout", () => {
    it("should logout user successfully", async () => {
      // Arrange
      const mockRequest = {
        user: { sessionId: 123 },
      };
      const res = mockResponse();
      authService.logout.mockResolvedValue();

      // Act
      await controller.logout(mockRequest, res);

      // Assert
      expect(authService.logout).toHaveBeenCalledWith({
        sessionId: mockRequest.user.sessionId,
      });
      expect(authService.logout).toHaveBeenCalledTimes(1);
      expect(res.clearCookie).toHaveBeenCalledWith("token", { path: "/" });
    });
  });

  describe("update", () => {
    it("should update user profile successfully", async () => {
      // Arrange
      const mockRequest = {
        user: { id: 1, role: { id: 1, name: "user" } },
      };
      const updateDto: AuthUpdateDto = {
        firstName: "Updated",
        lastName: "Name",
      };
      const updatedUser = { ...mockUser, ...updateDto };
      authService.update.mockResolvedValue(updatedUser as User);

      // Act
      const result = await controller.update(mockRequest, updateDto);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(authService.update).toHaveBeenCalledWith(
        mockRequest.user,
        updateDto,
      );
      expect(authService.update).toHaveBeenCalledTimes(1);
    });

    it("should handle password update with old password validation", async () => {
      // Arrange
      const mockRequest = {
        user: { id: 1, role: { id: 1, name: "user" } },
      };
      const updateDto: AuthUpdateDto = {
        oldPassword: "currentPassword",
        password: "newPassword123",
      };
      authService.update.mockResolvedValue(mockUser as User);

      // Act
      const result = await controller.update(mockRequest, updateDto);

      // Assert
      expect(result).toEqual(mockUser);
      expect(authService.update).toHaveBeenCalledWith(
        mockRequest.user,
        updateDto,
      );
    });

    it("should handle email update", async () => {
      // Arrange
      const mockRequest = {
        user: { id: 1, role: { id: 1, name: "user" } },
      };
      const updateDto: AuthUpdateDto = {
        email: "newemail@example.com",
      };
      authService.update.mockResolvedValue(mockUser as User);

      // Act
      const result = await controller.update(mockRequest, updateDto);

      // Assert
      expect(result).toEqual(mockUser);
      expect(authService.update).toHaveBeenCalledWith(
        mockRequest.user,
        updateDto,
      );
    });
  });

  describe("delete", () => {
    it("should soft delete user account", async () => {
      // Arrange
      const mockRequest = {
        user: mockUser,
      };
      authService.softDelete.mockResolvedValue();

      // Act
      await controller.delete(mockRequest);

      // Assert
      expect(authService.softDelete).toHaveBeenCalledWith(mockRequest.user);
      expect(authService.softDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    it("should handle service throwing unexpected errors", async () => {
      // Arrange
      const loginDto: AuthEmailLoginDto = {
        email: "test@example.com",
        password: "password123",
      };
      authService.validateLogin.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(controller.login(loginDto, mockResponse())).rejects.toThrow(
        "Database error",
      );
      expect(authService.validateLogin).toHaveBeenCalledWith(loginDto);
    });

    it("should handle null/undefined request user gracefully", async () => {
      // Arrange
      const mockRequest = { user: null };
      authService.me.mockResolvedValue(null);

      // Act
      const result = await controller.me(mockRequest);

      // Assert
      expect(result).toBeNull();
      expect(authService.me).toHaveBeenCalledWith(null);
    });

    it("should handle empty update object", async () => {
      // Arrange
      const mockRequest = {
        user: { id: 1, role: { id: 1, name: "user" } },
      };
      const updateDto: AuthUpdateDto = {};
      authService.update.mockResolvedValue(mockUser as User);

      // Act
      const result = await controller.update(mockRequest, updateDto);

      // Assert
      expect(result).toEqual(mockUser);
      expect(authService.update).toHaveBeenCalledWith(
        mockRequest.user,
        updateDto,
      );
    });
  });
});
