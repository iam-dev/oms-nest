import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtStrategy } from "../../../../src/auth/strategies/jwt.strategy";
import { UsersService } from "../../../../src/users/users.service";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let mockUsersService: { findById: jest.Mock };

  beforeEach(async () => {
    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue("test-secret-key"),
    };

    mockUsersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it("should be defined", () => {
    expect(strategy).toBeDefined();
  });

  it("should return payload when user exists and is enabled", async () => {
    const payload = { id: "user-123", role: { id: 2 } };
    mockUsersService.findById.mockResolvedValue({
      id: "user-123",
      enabled: true,
    });
    const result = await strategy.validate(payload as any);
    expect(result).toEqual(payload);
    expect(mockUsersService.findById).toHaveBeenCalledWith("user-123");
  });

  it("should throw UnauthorizedException when id is missing", async () => {
    const payload = { role: { id: 2 } };
    await expect(strategy.validate(payload as any)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockUsersService.findById).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedException when id is null", async () => {
    const payload = { id: null, role: { id: 2 } };
    await expect(strategy.validate(payload as any)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockUsersService.findById).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedException when id is empty string", async () => {
    const payload = { id: "", role: { id: 2 } };
    await expect(strategy.validate(payload as any)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockUsersService.findById).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedException when user does not exist", async () => {
    const payload = { id: "user-ghost", role: { id: 2 } };
    mockUsersService.findById.mockResolvedValue(null);
    await expect(strategy.validate(payload as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should throw UnauthorizedException when user is disabled", async () => {
    const payload = { id: "user-disabled", role: { id: 2 } };
    mockUsersService.findById.mockResolvedValue({
      id: "user-disabled",
      enabled: false,
    });
    await expect(strategy.validate(payload as any)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should pass through full payload properties for enabled user", async () => {
    const payload = {
      id: "user-456",
      role: { id: 5 },
      sessionId: "session-789",
      iat: 1234567890,
      exp: 1234567899,
    };
    mockUsersService.findById.mockResolvedValue({
      id: "user-456",
      enabled: true,
    });
    const result = await strategy.validate(payload as any);
    expect(result).toEqual(payload);
    expect(result).toHaveProperty("id", "user-456");
    expect(result).toHaveProperty("role");
    expect(result).toHaveProperty("sessionId", "session-789");
    expect(result).toHaveProperty("iat", 1234567890);
    expect(result).toHaveProperty("exp", 1234567899);
  });
});
