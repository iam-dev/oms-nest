import { AnonymousStrategy } from "../../../../src/auth/strategies/anonymous.strategy";

describe("AnonymousStrategy", () => {
  let strategy: AnonymousStrategy;

  beforeEach(() => {
    strategy = new AnonymousStrategy();
  });

  it("should be defined", () => {
    expect(strategy).toBeDefined();
  });

  it("should return the request object", () => {
    const mockRequest = { url: "/test", method: "GET", headers: {} };
    const result = strategy.validate(undefined, mockRequest);
    expect(result).toBe(mockRequest);
  });
});
