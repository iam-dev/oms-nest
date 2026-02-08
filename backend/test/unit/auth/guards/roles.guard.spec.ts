import { RolesGuard } from "../../../../src/auth/guards/roles.guard";
import {
  createMockExecutionContext,
  createMockReflector,
} from "../../helpers/test-helpers";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let mockReflector: ReturnType<typeof createMockReflector>;

  beforeEach(() => {
    mockReflector = createMockReflector();
    guard = new RolesGuard(mockReflector);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should allow when no roles defined (empty array)", () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);

    const context = createMockExecutionContext({
      user: { role: { id: 2 } },
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should allow when user role matches numeric role", () => {
    mockReflector.getAllAndOverride.mockReturnValue([2]);

    const context = createMockExecutionContext({
      user: { role: { id: 2 } },
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should allow when user role matches string role (coercion)", () => {
    mockReflector.getAllAndOverride.mockReturnValue(["2"]);

    const context = createMockExecutionContext({
      user: { role: { id: 2 } },
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should deny when user role doesn't match", () => {
    mockReflector.getAllAndOverride.mockReturnValue([5]);

    const context = createMockExecutionContext({
      user: { role: { id: 2 } },
    });

    const result = guard.canActivate(context);
    expect(result).toBe(false);
  });

  it("should deny when user has no role object", () => {
    mockReflector.getAllAndOverride.mockReturnValue([2]);

    const context = createMockExecutionContext({
      user: {},
    });

    const result = guard.canActivate(context);
    expect(result).toBe(false);
  });

  it("should deny when user is missing entirely", () => {
    mockReflector.getAllAndOverride.mockReturnValue([2]);

    const context = createMockExecutionContext();

    const result = guard.canActivate(context);
    expect(result).toBe(false);
  });
});
