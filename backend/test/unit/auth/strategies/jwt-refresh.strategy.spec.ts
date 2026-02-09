import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtRefreshStrategy } from "../../../../src/auth/strategies/jwt-refresh.strategy";

describe("JwtRefreshStrategy", () => {
  let strategy: JwtRefreshStrategy;

  beforeEach(async () => {
    const mockConfigService = {
      getOrThrow: jest.fn().mockReturnValue("test-refresh-secret-key"),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
  });

  it("should be defined", () => {
    expect(strategy).toBeDefined();
  });

  it("should return payload when sessionId exists", () => {
    const payload = { sessionId: "session-123", id: "user-456" };
    const result = strategy.validate(payload as any);
    expect(result).toEqual(payload);
  });

  it("should throw UnauthorizedException when sessionId is missing", () => {
    const payload = { id: "user-456" };
    expect(() => strategy.validate(payload as any)).toThrow(
      UnauthorizedException,
    );
  });

  it("should throw UnauthorizedException when sessionId is null", () => {
    const payload = { sessionId: null, id: "user-456" };
    expect(() => strategy.validate(payload as any)).toThrow(
      UnauthorizedException,
    );
  });
});
