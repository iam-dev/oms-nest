import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtStrategy } from "../../../../src/auth/strategies/jwt.strategy";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue("test-secret-key"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it("should be defined", () => {
    expect(strategy).toBeDefined();
  });

  it("should return payload when id exists", () => {
    const payload = { id: "user-123", role: { id: 2 } };
    const result = strategy.validate(payload as any);
    expect(result).toEqual(payload);
  });

  it("should throw UnauthorizedException when id is missing", () => {
    const payload = { role: { id: 2 } };
    expect(() => strategy.validate(payload as any)).toThrow(
      UnauthorizedException,
    );
  });

  it("should throw UnauthorizedException when id is null", () => {
    const payload = { id: null, role: { id: 2 } };
    expect(() => strategy.validate(payload as any)).toThrow(
      UnauthorizedException,
    );
  });

  it("should throw UnauthorizedException when id is empty string", () => {
    const payload = { id: "", role: { id: 2 } };
    expect(() => strategy.validate(payload as any)).toThrow(
      UnauthorizedException,
    );
  });

  it("should pass through full payload properties", () => {
    const payload = {
      id: "user-456",
      role: { id: 5 },
      sessionId: "session-789",
      iat: 1234567890,
      exp: 1234567899,
    };
    const result = strategy.validate(payload as any);
    expect(result).toEqual(payload);
    expect(result).toHaveProperty("id", "user-456");
    expect(result).toHaveProperty("role");
    expect(result).toHaveProperty("sessionId", "session-789");
    expect(result).toHaveProperty("iat", 1234567890);
    expect(result).toHaveProperty("exp", 1234567899);
  });
});
