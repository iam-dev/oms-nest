import { Test, TestingModule } from "@nestjs/testing";
import { RlsGuard, EnhancedRlsGuard } from "../../../src/rls/rls.guard";
import { RlsService } from "../../../src/rls/rls.service";
import { RoleEnum } from "../../../src/roles/roles.enum";
import { Reflector } from "@nestjs/core";
import {
  createMockExecutionContext,
  createMockReflector,
} from "../helpers/test-helpers";

describe("RlsGuard", () => {
  let guard: RlsGuard;
  let mockRlsService: { setUserContext: jest.Mock };
  let mockReflector: ReturnType<typeof createMockReflector>;

  beforeEach(async () => {
    mockRlsService = {
      setUserContext: jest.fn().mockResolvedValue(undefined),
    };

    mockReflector = createMockReflector();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RlsGuard,
        {
          provide: RlsService,
          useValue: mockRlsService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<RlsGuard>(RlsGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should return true when no user on request", async () => {
    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRlsService.setUserContext).not.toHaveBeenCalled();
  });

  it("should return true when user has no id", async () => {
    const context = createMockExecutionContext({
      user: { role: { id: RoleEnum.admin } },
    });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(mockRlsService.setUserContext).not.toHaveBeenCalled();
  });

  it("should call setUserContext with user info for admin", async () => {
    const context = createMockExecutionContext({
      user: { id: "admin-user-1", role: { id: RoleEnum.admin } },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRlsService.setUserContext).toHaveBeenCalledWith(
      "admin-user-1",
      RoleEnum.admin,
      undefined,
      undefined,
    );
  });

  it("should set factoryId for factory role users", async () => {
    const context = createMockExecutionContext({
      user: {
        id: "factory-user-1",
        role: { id: RoleEnum.factory },
        factoryId: "factory-100",
      },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRlsService.setUserContext).toHaveBeenCalledWith(
      "factory-user-1",
      RoleEnum.factory,
      "factory-100",
      undefined,
    );
  });

  it("should set fitterId for fitter role users", async () => {
    const context = createMockExecutionContext({
      user: {
        id: "fitter-user-1",
        role: { id: RoleEnum.fitter },
        fitterId: "fitter-200",
      },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRlsService.setUserContext).toHaveBeenCalledWith(
      "fitter-user-1",
      RoleEnum.fitter,
      undefined,
      "fitter-200",
    );
  });

  it("should return false when setUserContext throws error", async () => {
    mockRlsService.setUserContext.mockRejectedValue(
      new Error("Database error"),
    );

    const context = createMockExecutionContext({
      user: { id: "user-1", role: { id: RoleEnum.admin } },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
  });
});

describe("EnhancedRlsGuard", () => {
  let guard: EnhancedRlsGuard;
  let mockRlsService: { setUserContext: jest.Mock };
  let mockReflector: ReturnType<typeof createMockReflector>;

  beforeEach(async () => {
    mockRlsService = {
      setUserContext: jest.fn().mockResolvedValue(undefined),
    };

    mockReflector = createMockReflector();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnhancedRlsGuard,
        {
          provide: RlsService,
          useValue: mockRlsService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<EnhancedRlsGuard>(EnhancedRlsGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should skip RLS when SkipRlsContext decorator is present", async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);

    const context = createMockExecutionContext({
      user: { id: "user-1", role: { id: RoleEnum.admin } },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRlsService.setUserContext).not.toHaveBeenCalled();
  });

  it("should call parent when SkipRlsContext is not set", async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);

    const context = createMockExecutionContext({
      user: { id: "user-1", role: { id: RoleEnum.admin } },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockRlsService.setUserContext).toHaveBeenCalledWith(
      "user-1",
      RoleEnum.admin,
      undefined,
      undefined,
    );
  });
});
