import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of, lastValueFrom } from "rxjs";
import { ResolvePromisesInterceptor } from "../../../src/utils/serializer.interceptor";

describe("ResolvePromisesInterceptor", () => {
  let interceptor: ResolvePromisesInterceptor;

  beforeEach(() => {
    interceptor = new ResolvePromisesInterceptor();
  });

  const createMockExecutionContext = (): ExecutionContext =>
    ({
      switchToHttp: jest.fn(),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as any;

  const createMockCallHandler = (data: any): CallHandler => ({
    handle: () => of(data),
  });

  it("should resolve simple data without promises", async () => {
    const context = createMockExecutionContext();
    const handler = createMockCallHandler({ name: "test", value: 42 });

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("should resolve nested promises in objects", async () => {
    const context = createMockExecutionContext();
    const handler = createMockCallHandler({
      name: Promise.resolve("resolved-name"),
      nested: {
        value: Promise.resolve("resolved-value"),
      },
    });

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({
      name: "resolved-name",
      nested: { value: "resolved-value" },
    });
  });

  it("should resolve promises in arrays", async () => {
    const context = createMockExecutionContext();
    const handler = createMockCallHandler([
      Promise.resolve("a"),
      Promise.resolve("b"),
      "c",
    ]);

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toEqual(["a", "b", "c"]);
  });

  it("should handle null values", async () => {
    const context = createMockExecutionContext();
    const handler = createMockCallHandler(null);

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toBeNull();
  });

  it("should handle primitive values", async () => {
    const context = createMockExecutionContext();
    const handler = createMockCallHandler(42);

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toBe(42);
  });

  it("should handle string values", async () => {
    const context = createMockExecutionContext();
    const handler = createMockCallHandler("hello");

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toBe("hello");
  });

  it("should preserve Date objects", async () => {
    const context = createMockExecutionContext();
    const date = new Date("2023-01-01");
    const handler = createMockCallHandler(date);

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toBeInstanceOf(Date);
    expect(result).toEqual(date);
  });

  it("should resolve a top-level promise", async () => {
    const context = createMockExecutionContext();
    const handler = createMockCallHandler(Promise.resolve({ key: "value" }));

    const result$ = interceptor.intercept(context, handler);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({ key: "value" });
  });
});
