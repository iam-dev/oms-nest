import { of } from "rxjs";
import { lastValueFrom } from "rxjs";
import {
  CacheInterceptor,
  SearchCacheInterceptor,
  ReferenceCacheInterceptor,
} from "../../../src/cache/interceptors/cache.interceptor";

/**
 * Create a mock ProductionCacheService with jest.fn() methods
 */
function createMockProductionCacheService() {
  return {
    getFromCache: jest.fn(),
    setInCache: jest.fn(),
    getSearchResults: jest.fn(),
    setSearchResults: jest.fn(),
    getReferenceData: jest.fn(),
    setReferenceData: jest.fn(),
  };
}

/**
 * Create a mock ExecutionContext for interceptor tests
 */
function createInterceptorContext(
  overrides: {
    method?: string;
    path?: string;
    query?: Record<string, any>;
    params?: Record<string, any>;
    routePath?: string;
    handlerMetadata?: Record<string, any>;
    classMetadata?: Record<string, any>;
  } = {},
) {
  const request = {
    method: overrides.method || "GET",
    path: overrides.path || "/api/v1/test",
    route: overrides.routePath ? { path: overrides.routePath } : undefined,
    query: overrides.query || {},
    params: overrides.params || {},
  };

  const handler = jest.fn();
  const classRef = jest.fn();

  // Set metadata on handler/class for cache config extraction
  const handlerMeta = overrides.handlerMetadata || {};
  const classMeta = overrides.classMetadata || {};

  jest
    .spyOn(Reflect, "getMetadata")
    .mockImplementation((key: any, target: any) => {
      if (target === handler) return handlerMeta[key as string];
      if (target === classRef) return classMeta[key as string];
      return undefined;
    });

  return {
    context: {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
      getHandler: jest.fn().mockReturnValue(handler),
      getClass: jest.fn().mockReturnValue(classRef),
    },
    request,
  };
}

function createMockCallHandler(returnValue: any = {}) {
  return {
    handle: jest.fn().mockReturnValue(of(returnValue)),
  };
}

describe("CacheInterceptor", () => {
  let interceptor: CacheInterceptor;
  let cacheService: ReturnType<typeof createMockProductionCacheService>;

  beforeEach(() => {
    cacheService = createMockProductionCacheService();
    interceptor = new CacheInterceptor(cacheService as any);
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(interceptor).toBeDefined();
  });

  it("should skip non-GET requests", async () => {
    const { context } = createInterceptorContext({ method: "POST" });
    const next = createMockCallHandler({ data: "post-result" });

    const result$ = await interceptor.intercept(context as any, next as any);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({ data: "post-result" });
    expect(cacheService.getFromCache).not.toHaveBeenCalled();
  });

  it("should return cached response on hit", async () => {
    const cachedData = { data: "cached-result" };
    cacheService.getFromCache.mockResolvedValue(cachedData);

    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/test",
    });
    const next = createMockCallHandler();

    const result$ = await interceptor.intercept(context as any, next as any);
    const result = await lastValueFrom(result$);

    expect(result).toEqual(cachedData);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it("should execute handler and cache on miss", async () => {
    cacheService.getFromCache.mockResolvedValue(null);
    cacheService.setInCache.mockResolvedValue(undefined);

    const handlerResult = { data: "fresh-result" };
    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/test",
    });
    const next = createMockCallHandler(handlerResult);

    const result$ = await interceptor.intercept(context as any, next as any);
    const result = await lastValueFrom(result$);

    expect(result).toEqual(handlerResult);
    expect(next.handle).toHaveBeenCalled();
    expect(cacheService.setInCache).toHaveBeenCalled();
  });

  it("should sort query params for cache key", async () => {
    cacheService.getFromCache.mockResolvedValue(null);
    cacheService.setInCache.mockResolvedValue(undefined);

    const { context: context1 } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/orders",
      query: { z: "1", a: "2", m: "3" },
    });

    const next1 = createMockCallHandler({ data: "result" });
    await interceptor.intercept(context1 as any, next1 as any);

    // The cache key should contain sorted query params: a=2&m=3&z=1
    const cacheKeyArg = cacheService.getFromCache.mock.calls[0][0];
    expect(cacheKeyArg).toContain("a=2");
    expect(cacheKeyArg).toContain("m=3");
    expect(cacheKeyArg).toContain("z=1");
    // Verify sort order: a before m before z
    const aIdx = cacheKeyArg.indexOf("a=2");
    const mIdx = cacheKeyArg.indexOf("m=3");
    const zIdx = cacheKeyArg.indexOf("z=1");
    expect(aIdx).toBeLessThan(mIdx);
    expect(mIdx).toBeLessThan(zIdx);
  });

  it("should use correct TTL for reference type", async () => {
    cacheService.getFromCache.mockResolvedValue(null);
    cacheService.setInCache.mockResolvedValue(undefined);

    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/brands",
      handlerMetadata: { "cache:type": "reference" },
    });

    const next = createMockCallHandler({ data: "brands" });
    const result$ = await interceptor.intercept(context as any, next as any);
    await lastValueFrom(result$);

    // Reference TTL = 60 * 60 * 1000 = 3600000
    expect(cacheService.setInCache).toHaveBeenCalledWith(
      expect.any(String),
      { data: "brands" },
      3600000,
    );
  });

  it("should use correct TTL for search type", async () => {
    cacheService.getFromCache.mockResolvedValue(null);
    cacheService.setInCache.mockResolvedValue(undefined);

    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/orders",
      handlerMetadata: { "cache:type": "search" },
    });

    const next = createMockCallHandler({ data: "search-results" });
    const result$ = await interceptor.intercept(context as any, next as any);
    await lastValueFrom(result$);

    // Search TTL = 5 * 60 * 1000 = 300000
    expect(cacheService.setInCache).toHaveBeenCalledWith(
      expect.any(String),
      { data: "search-results" },
      300000,
    );
  });

  it("should not cache error responses", async () => {
    cacheService.getFromCache.mockResolvedValue(null);
    cacheService.setInCache.mockResolvedValue(undefined);

    const errorResponse = { error: "Something went wrong", statusCode: 500 };
    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/test",
    });
    const next = createMockCallHandler(errorResponse);

    const result$ = await interceptor.intercept(context as any, next as any);
    await lastValueFrom(result$);

    expect(cacheService.setInCache).not.toHaveBeenCalled();
  });

  it("should not cache empty/null responses", async () => {
    cacheService.getFromCache.mockResolvedValue(null);
    cacheService.setInCache.mockResolvedValue(undefined);

    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/test",
    });
    const next = {
      handle: jest.fn().mockReturnValue(of(null)),
    };

    const result$ = await interceptor.intercept(context as any, next as any);
    await lastValueFrom(result$);

    expect(cacheService.setInCache).not.toHaveBeenCalled();
  });

  it("should handle cache service errors gracefully", async () => {
    cacheService.getFromCache.mockRejectedValue(new Error("Redis down"));

    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/test",
    });
    const next = createMockCallHandler({ data: "fallback" });

    // Should not throw
    await expect(
      interceptor.intercept(context as any, next as any),
    ).rejects.toThrow("Redis down");
  });
});

describe("SearchCacheInterceptor", () => {
  let interceptor: SearchCacheInterceptor;
  let cacheService: ReturnType<typeof createMockProductionCacheService>;

  beforeEach(() => {
    cacheService = createMockProductionCacheService();
    interceptor = new SearchCacheInterceptor(cacheService as any);
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(interceptor).toBeDefined();
  });

  it("should skip non-GET requests", async () => {
    const { context } = createInterceptorContext({ method: "POST" });
    const next = createMockCallHandler({ data: "post-result" });

    const result$ = await interceptor.intercept(context as any, next as any);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({ data: "post-result" });
    expect(cacheService.getSearchResults).not.toHaveBeenCalled();
  });

  it("should return cached search results on hit", async () => {
    const cachedResults = { data: [{ id: 1 }], total: 1 };
    cacheService.getSearchResults.mockResolvedValue(cachedResults);

    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/orders",
      query: { searchTerm: "test" },
    });
    const next = createMockCallHandler();

    const result$ = await interceptor.intercept(context as any, next as any);
    const result = await lastValueFrom(result$);

    expect(result).toEqual(cachedResults);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it("should detect search type from path (order, customer)", async () => {
    cacheService.getSearchResults.mockResolvedValue(null);
    cacheService.setSearchResults.mockResolvedValue(undefined);

    // Test order path
    const { context: orderCtx } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/orders",
      query: { searchTerm: "test" },
    });
    const orderNext = createMockCallHandler({ data: [{ id: 1 }] });
    const orderResult$ = await interceptor.intercept(
      orderCtx as any,
      orderNext as any,
    );
    await lastValueFrom(orderResult$);

    expect(cacheService.setSearchResults).toHaveBeenCalledWith(
      "test",
      expect.any(Object),
      { data: [{ id: 1 }] },
      "ORDER",
    );

    cacheService.setSearchResults.mockClear();
    cacheService.getSearchResults.mockResolvedValue(null);

    // Test customer path
    const { context: custCtx } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/customers",
      query: { searchTerm: "john" },
    });
    const custNext = createMockCallHandler({ data: [{ id: 2 }] });
    const custResult$ = await interceptor.intercept(
      custCtx as any,
      custNext as any,
    );
    await lastValueFrom(custResult$);

    expect(cacheService.setSearchResults).toHaveBeenCalledWith(
      "john",
      expect.any(Object),
      { data: [{ id: 2 }] },
      "CUSTOMER",
    );
  });

  it("should cache search results on miss", async () => {
    cacheService.getSearchResults.mockResolvedValue(null);
    cacheService.setSearchResults.mockResolvedValue(undefined);

    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/orders",
      query: { searchTerm: "saddle", page: "1" },
    });
    const handlerResult = { data: [{ id: 1 }, { id: 2 }], total: 2 };
    const next = createMockCallHandler(handlerResult);

    const result$ = await interceptor.intercept(context as any, next as any);
    const result = await lastValueFrom(result$);

    expect(result).toEqual(handlerResult);
    expect(cacheService.setSearchResults).toHaveBeenCalled();
  });
});

describe("ReferenceCacheInterceptor", () => {
  let interceptor: ReferenceCacheInterceptor;
  let cacheService: ReturnType<typeof createMockProductionCacheService>;

  beforeEach(() => {
    cacheService = createMockProductionCacheService();
    interceptor = new ReferenceCacheInterceptor(cacheService as any);
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(interceptor).toBeDefined();
  });

  it("should extract brands reference type", async () => {
    cacheService.getReferenceData.mockResolvedValue(null);
    cacheService.setReferenceData.mockResolvedValue(undefined);

    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/brands",
      params: {},
    });
    const brandData = [{ id: 1, name: "Brand A" }];
    const next = createMockCallHandler(brandData);

    const result$ = await interceptor.intercept(context as any, next as any);
    await lastValueFrom(result$);

    expect(cacheService.getReferenceData).toHaveBeenCalledWith(
      "BRANDS",
      undefined,
    );
    expect(cacheService.setReferenceData).toHaveBeenCalledWith(
      "BRANDS",
      brandData,
      undefined,
    );
  });

  it("should extract leather types reference type", async () => {
    cacheService.getReferenceData.mockResolvedValue(null);
    cacheService.setReferenceData.mockResolvedValue(undefined);

    const { context } = createInterceptorContext({
      method: "GET",
      path: "/api/v1/leathertypes",
      params: {},
    });
    const leatherData = [{ id: 1, name: "Full Grain" }];
    const next = createMockCallHandler(leatherData);

    const result$ = await interceptor.intercept(context as any, next as any);
    await lastValueFrom(result$);

    expect(cacheService.getReferenceData).toHaveBeenCalledWith(
      "LEATHER_TYPES",
      undefined,
    );
    expect(cacheService.setReferenceData).toHaveBeenCalledWith(
      "LEATHER_TYPES",
      leatherData,
      undefined,
    );
  });
});
