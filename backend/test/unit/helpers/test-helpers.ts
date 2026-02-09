import { Test, TestingModule } from "@nestjs/testing";
import {
  Repository,
  DataSource,
  EntityManager,
  SelectQueryBuilder,
  ObjectLiteral,
} from "typeorm";
import { Cache } from "cache-manager";
import { CACHE_MANAGER } from "@nestjs/cache-manager";

/**
 * Mock factory for TypeORM Repository
 */
const createMockRepository = <T extends ObjectLiteral = any>(): jest.Mocked<
  Repository<T>
> =>
  ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findBy: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: {} as EntityManager,
    metadata: {} as any,
    target: {} as any,
    query: jest.fn(),
    clear: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    existsBy: jest.fn(),
    findAndCount: jest.fn(),
    findAndCountBy: jest.fn(),
    findOneOrFail: jest.fn(),
    findOneByOrFail: jest.fn(),
    countBy: jest.fn(),
    sum: jest.fn(),
    average: jest.fn(),
    minimum: jest.fn(),
    maximum: jest.fn(),
    insert: jest.fn(),
    upsert: jest.fn(),
    recover: jest.fn(),
    softRemove: jest.fn(),
    remove: jest.fn(),
    preload: jest.fn(),
    merge: jest.fn(),
    extend: jest.fn(),
    hasId: jest.fn(),
    getId: jest.fn(),
    queryRunner: undefined,
  }) as any;

/**
 * Mock factory for TypeORM QueryBuilder
 */
const createMockQueryBuilder = <T extends ObjectLiteral = any>(): jest.Mocked<
  SelectQueryBuilder<T>
> => {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereInIds: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    andHaving: jest.fn().mockReturnThis(),
    orHaving: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    rightJoin: jest.fn().mockReturnThis(),
    rightJoinAndSelect: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    joinAndSelect: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getOneOrFail: jest.fn(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    getCount: jest.fn(),
    getSum: jest.fn(),
    stream: jest.fn(),
    execute: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    softDelete: jest.fn().mockReturnThis(),
    restore: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orUpdate: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),
    distinctOn: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    disableEscaping: jest.fn().mockReturnThis(),
    getQuery: jest.fn(),
    getParameters: jest.fn(),
    getSql: jest.fn(),
    printSql: jest.fn(),
    useTransaction: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    setOnLocked: jest.fn().mockReturnThis(),
    loadRelationCountAndMap: jest.fn().mockReturnThis(),
    loadRelationIdAndMap: jest.fn().mockReturnThis(),
    cache: jest.fn().mockReturnThis(),
  } as any;

  return queryBuilder;
};

/**
 * Mock factory for TypeORM DataSource
 */
const createMockDataSource = (): any => ({
  query: jest.fn(),
  createQueryBuilder: jest.fn(),
  createQueryRunner: jest.fn(),
  getRepository: jest.fn(),
  getTreeRepository: jest.fn(),
  getMongoRepository: jest.fn(),
  transaction: jest.fn(),
  manager: {} as EntityManager,
  isInitialized: true,
  options: {} as any,
  name: "test",
  metadataTableName: "test_metadata",
  logger: {} as any,
  migrations: [],
  subscribers: [],
  entityMetadatas: [],
  entityMetadatasMap: new Map(),
  hasMetadata: jest.fn(),
  getMetadata: jest.fn(),
  connect: jest.fn(),
  close: jest.fn(),
  synchronize: jest.fn(),
  dropDatabase: jest.fn(),
  runMigrations: jest.fn(),
  undoLastMigration: jest.fn(),
  showMigrations: jest.fn(),
  logSchemaBuild: jest.fn(),
  logMigration: jest.fn(),
  initialize: jest.fn(),
  destroy: jest.fn(),
  setOptions: jest.fn(),
});

/**
 * Mock factory for Cache Manager
 */
const createMockCacheManager = (): jest.Mocked<Cache> =>
  ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    reset: jest.fn(),
    wrap: jest.fn(),
    store: {} as any,
  }) as any;

/**
 * Mock factory for EntityManager
 */
const createMockEntityManager = (): any => ({
  connection: {} as any,
  queryRunner: {} as any,
  create: jest.fn(),
  merge: jest.fn(),
  preload: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  softRemove: jest.fn(),
  recover: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  softDelete: jest.fn(),
  restore: jest.fn(),
  count: jest.fn(),
  countBy: jest.fn(),
  find: jest.fn(),
  findBy: jest.fn(),
  findAndCount: jest.fn(),
  findAndCountBy: jest.fn(),
  findByIds: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  findOneOrFail: jest.fn(),
  findOneByOrFail: jest.fn(),
  clear: jest.fn(),
  increment: jest.fn(),
  decrement: jest.fn(),
  sum: jest.fn(),
  average: jest.fn(),
  minimum: jest.fn(),
  maximum: jest.fn(),
  createQueryBuilder: jest.fn(),
  getRepository: jest.fn(),
  getTreeRepository: jest.fn(),
  getMongoRepository: jest.fn(),
  getCustomRepository: jest.fn(),
  release: jest.fn(),
  query: jest.fn(),
  transaction: jest.fn(),
  hasId: jest.fn(),
  getId: jest.fn(),
  existsBy: jest.fn(),
});

/**
 * Test data factory for common entities
 */
export class TestDataFactory {
  /**
   * Create test user entity
   */
  static createUser(overrides: Partial<any> = {}): any {
    return {
      id: 1,
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      role: "user",
      status: "active",
      createdAt: new Date("2023-01-01T10:00:00Z"),
      updatedAt: new Date("2023-01-01T10:00:00Z"),
      createdBy: "system",
      updatedBy: "system",
      ...overrides,
    };
  }

  /**
   * Create test customer entity
   */
  static createCustomer(overrides: Partial<any> = {}): any {
    return {
      id: 1,
      name: "Test Customer",
      email: "customer@example.com",
      phone: "+1234567890",
      address: "123 Test Street",
      fitterId: 1,
      createdAt: new Date("2023-01-01T10:00:00Z"),
      updatedAt: new Date("2023-01-01T10:00:00Z"),
      ...overrides,
    };
  }

  /**
   * Create test order entity
   */
  static createOrder(overrides: Partial<any> = {}): any {
    return {
      id: 1,
      customerId: 1,
      fitterId: 1,
      supplierId: 1,
      status: "pending",
      urgency: "normal",
      seatSizes: { small: 1, medium: 2, large: 1 },
      total: 1250.0,
      comments: "Test order comments",
      createdAt: new Date("2023-01-01T10:00:00Z"),
      updatedAt: new Date("2023-01-01T10:00:00Z"),
      ...overrides,
    };
  }

  /**
   * Create test fitter entity
   */
  static createFitter(overrides: Partial<any> = {}): any {
    return {
      id: 1,
      userId: 1,
      name: "Test Fitter",
      region: "North",
      specialties: ["jumping", "dressage"],
      active: true,
      createdAt: new Date("2023-01-01T10:00:00Z"),
      updatedAt: new Date("2023-01-01T10:00:00Z"),
      ...overrides,
    };
  }

  /**
   * Create test supplier entity
   */
  static createSupplier(overrides: Partial<any> = {}): any {
    return {
      id: 1,
      name: "Test Supplier",
      contactEmail: "supplier@example.com",
      contactPhone: "+1234567890",
      address: "456 Supplier Ave",
      businessNumber: "SUP123456",
      active: true,
      createdAt: new Date("2023-01-01T10:00:00Z"),
      updatedAt: new Date("2023-01-01T10:00:00Z"),
      ...overrides,
    };
  }

  /**
   * Create test brand entity
   */
  static createBrand(overrides: Partial<any> = {}): any {
    return {
      id: 1,
      name: "Test Brand",
      description: "Premium saddle brand",
      active: true,
      logoUrl: "https://example.com/logo.png",
      createdAt: new Date("2023-01-01T10:00:00Z"),
      updatedAt: new Date("2023-01-01T10:00:00Z"),
      ...overrides,
    };
  }

  /**
   * Create test model entity
   */
  static createModel(overrides: Partial<any> = {}): any {
    return {
      id: 1,
      brandId: 1,
      name: "Test Model",
      description: "Premium saddle model",
      basePrice: 1000.0,
      active: true,
      createdAt: new Date("2023-01-01T10:00:00Z"),
      updatedAt: new Date("2023-01-01T10:00:00Z"),
      ...overrides,
    };
  }

  /**
   * Create BehaviorContext
   */
  static createBehaviorContext(overrides: Partial<any> = {}): any {
    return {
      userId: "user123",
      entityType: "User",
      operation: "create",
      isNewEntity: true,
      metadata: {},
      ...overrides,
    };
  }

  /**
   * Create UserContext for queries
   */
  static createUserContext(overrides: Partial<any> = {}): any {
    return {
      userId: "user123",
      role: "user",
      scopeType: "user",
      scopeId: "scope123",
      ...overrides,
    };
  }

  /**
   * Create ParsedQuery for standard queries
   */
  static createParsedQuery(overrides: Partial<any> = {}): any {
    return {
      conditions: [],
      sorts: [],
      select: [],
      include: [],
      pagination: {
        skip: 0,
        take: 10,
      },
      ...overrides,
    };
  }

  /**
   * Create FilterCondition for standard queries
   */
  static createFilterCondition(overrides: Partial<any> = {}): any {
    return {
      field: "name",
      operator: "eq",
      value: "test",
      connector: "and",
      ...overrides,
    };
  }

  /**
   * Create SortDirective for standard queries
   */
  static createSortDirective(overrides: Partial<any> = {}): any {
    return {
      field: "createdAt",
      direction: "desc",
      ...overrides,
    };
  }

  /**
   * Create multiple entities for bulk testing
   */
  static createMultiple<T>(
    factory: () => T,
    count: number,
    overridesFn?: (index: number) => Partial<T>,
  ): T[] {
    return Array.from({ length: count }, (_, index) => {
      const overrides = overridesFn ? overridesFn(index) : {};
      return { ...factory(), ...overrides };
    });
  }
}

/**
 * Test utilities for async operations and timing
 */
export class TestUtils {
  /**
   * Wait for a specified number of milliseconds
   */
  static async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wait for a condition to become true
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await this.delay(interval);
    }

    throw new Error(`Condition not met within ${timeout}ms timeout`);
  }

  /**
   * Create a spy that tracks call order
   */
  static createOrderedSpy(): jest.MockedFunction<any> & {
    getCallOrder: () => number[];
  } {
    const callOrder: number[] = [];
    let callIndex = 0;

    const spy = jest.fn().mockImplementation(() => {
      callOrder.push(callIndex++);
    });

    (spy as any).getCallOrder = () => callOrder;

    return spy;
  }

  /**
   * Reset all call orders for ordered spies
   */
  static resetCallOrders(): void {
    // This would need to be implemented based on your specific needs
    // You could maintain a global registry of ordered spies
  }

  /**
   * Create a mock that resolves after a delay
   */
  static createDelayedMock<T>(
    value: T,
    delay: number = 0,
  ): jest.MockedFunction<() => Promise<T>> {
    return jest.fn().mockImplementation(async () => {
      if (delay > 0) {
        await this.delay(delay);
      }
      return value;
    });
  }

  /**
   * Create a mock that fails after a delay
   */
  static createDelayedErrorMock(
    error: Error,
    delay: number = 0,
  ): jest.MockedFunction<() => Promise<never>> {
    return jest.fn().mockImplementation(async () => {
      if (delay > 0) {
        await this.delay(delay);
      }
      throw error;
    });
  }

  /**
   * Generate a random string for testing
   */
  static randomString(length: number = 10): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Generate a random email for testing
   */
  static randomEmail(): string {
    return `${this.randomString(8)}@${this.randomString(6)}.com`;
  }

  /**
   * Generate a random date within a range
   */
  static randomDate(start: Date, end: Date): Date {
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime()),
    );
  }
}

/**
 * Module builder helper for creating test modules with common providers
 */
export class TestModuleBuilder {
  private providers: any[] = [];
  private imports: any[] = [];

  /**
   * Add a repository mock
   */
  addMockRepository<T extends ObjectLiteral>(
    entity: any,
    repository?: jest.Mocked<Repository<T>>,
  ): this {
    this.providers.push({
      provide: `${entity.name}Repository`,
      useValue: repository || createMockRepository(),
    });
    return this;
  }

  /**
   * Add DataSource mock
   */
  addMockDataSource(dataSource?: jest.Mocked<DataSource>): this {
    this.providers.push({
      provide: DataSource,
      useValue: dataSource || createMockDataSource(),
    });
    return this;
  }

  /**
   * Add Cache Manager mock
   */
  addMockCacheManager(cacheManager?: jest.Mocked<Cache>): this {
    this.providers.push({
      provide: CACHE_MANAGER,
      useValue: cacheManager || createMockCacheManager(),
    });
    return this;
  }

  /**
   * Add EntityManager mock
   */
  addMockEntityManager(entityManager?: jest.Mocked<EntityManager>): this {
    this.providers.push({
      provide: EntityManager,
      useValue: entityManager || createMockEntityManager(),
    });
    return this;
  }

  /**
   * Add a custom provider
   */
  addProvider(provider: any): this {
    this.providers.push(provider);
    return this;
  }

  /**
   * Add a service class to be tested
   */
  addService(serviceClass: any): this {
    this.providers.push(serviceClass);
    return this;
  }

  /**
   * Add module import
   */
  addImport(moduleClass: any): this {
    this.imports.push(moduleClass);
    return this;
  }

  /**
   * Build the test module
   */
  async build(): Promise<TestingModule> {
    return Test.createTestingModule({
      providers: this.providers,
      imports: this.imports,
    }).compile();
  }
}

/**
 * Assertion helpers for testing
 */
export class TestAssertions {
  /**
   * Assert that a mock was called with partial arguments
   */
  static toHaveBeenCalledWithPartial(
    mock: jest.MockedFunction<any>,
    expected: any,
  ): void {
    const calls = mock.mock.calls;
    const found = calls.some((call) =>
      call.some(
        (arg) =>
          typeof arg === "object" &&
          Object.keys(expected).every((key) => arg[key] === expected[key]),
      ),
    );

    if (!found) {
      throw new Error(
        `Expected mock to have been called with partial object ${JSON.stringify(expected)}`,
      );
    }
  }

  /**
   * Assert that calls happened in specific order
   */
  static toHaveBeenCalledInOrder(mocks: jest.MockedFunction<any>[]): void {
    const callOrders = mocks.map((mock) =>
      Math.min(
        ...mock.mock.invocationCallOrder.filter((order) => order !== undefined),
      ),
    );

    for (let i = 1; i < callOrders.length; i++) {
      if (callOrders[i] <= callOrders[i - 1]) {
        throw new Error(
          `Expected calls to be in order, but call ${i} happened before call ${i - 1}`,
        );
      }
    }
  }

  /**
   * Assert that an async operation completed within timeout
   */
  static async toCompleteWithin(
    operation: Promise<any>,
    timeoutMs: number,
  ): Promise<void> {
    const timeout = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`Operation did not complete within ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );

    await Promise.race([operation, timeout]);
  }

  /**
   * Assert that an object has the expected structure
   */
  static toHaveStructure(obj: any, expectedStructure: any): void {
    const checkStructure = (actual: any, expected: any, path: string = "") => {
      for (const key in expected) {
        const currentPath = path ? `${path}.${key}` : key;

        if (!(key in actual)) {
          throw new Error(`Missing property: ${currentPath}`);
        }

        const expectedType = typeof expected[key];
        const actualType = typeof actual[key];

        if (
          expectedType === "object" &&
          expected[key] !== null &&
          !Array.isArray(expected[key])
        ) {
          checkStructure(actual[key], expected[key], currentPath);
        } else if (actualType !== expectedType) {
          throw new Error(
            `Type mismatch at ${currentPath}: expected ${expectedType}, got ${actualType}`,
          );
        }
      }
    };

    checkStructure(obj, expectedStructure);
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestUtils {
  /**
   * Measure execution time of an operation
   */
  static async measureTime<T>(
    operation: () => Promise<T>,
  ): Promise<{ result: T; timeMs: number }> {
    const start = Date.now();
    const result = await operation();
    const timeMs = Date.now() - start;
    return { result, timeMs };
  }

  /**
   * Assert that an operation completes within a time limit
   */
  static async assertTimeLimit<T>(
    operation: () => Promise<T>,
    limitMs: number,
  ): Promise<T> {
    const { result, timeMs } = await this.measureTime(operation);

    if (timeMs > limitMs) {
      throw new Error(
        `Operation took ${timeMs}ms, exceeding limit of ${limitMs}ms`,
      );
    }

    return result;
  }

  /**
   * Run an operation multiple times and get statistics
   */
  static async benchmarkOperation<T>(
    operation: () => Promise<T>,
    iterations: number = 10,
  ): Promise<{
    results: T[];
    times: number[];
    averageMs: number;
    minMs: number;
    maxMs: number;
  }> {
    const results: T[] = [];
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { result, timeMs } = await this.measureTime(operation);
      results.push(result);
      times.push(timeMs);
    }

    return {
      results,
      times,
      averageMs: times.reduce((sum, time) => sum + time, 0) / times.length,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
    };
  }
}

/**
 * Mock factory for NestJS ExecutionContext
 */
const createMockExecutionContext = (
  overrides: {
    user?: any;
    params?: any;
    query?: any;
    body?: any;
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  } = {},
): any => {
  const request = {
    user: overrides.user || undefined,
    params: overrides.params || {},
    query: overrides.query || {},
    body: overrides.body || {},
    method: overrides.method || "GET",
    url: overrides.url || "/test",
    headers: overrides.headers || {},
  };

  const response = {
    statusCode: 200,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };

  const handler = jest.fn();
  const classRef = jest.fn();

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(request),
      getResponse: jest.fn().mockReturnValue(response),
      getNext: jest.fn(),
    }),
    getHandler: jest.fn().mockReturnValue(handler),
    getClass: jest.fn().mockReturnValue(classRef),
    getType: jest.fn().mockReturnValue("http"),
    getArgs: jest.fn().mockReturnValue([request, response]),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  };
};

/**
 * Mock factory for NestJS CallHandler (used in interceptors)
 */
const createMockCallHandler = (returnValue: any = {}): any => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { of } = require("rxjs");
  return {
    handle: jest.fn().mockReturnValue(of(returnValue)),
  };
};

/**
 * Mock factory for TypeORM QueryRunner
 */
const createMockQueryRunner = (): any => ({
  connect: jest.fn(),
  release: jest.fn(),
  query: jest.fn(),
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  rollbackTransaction: jest.fn(),
  manager: createMockEntityManager(),
  isReleased: false,
  isTransactionActive: false,
});

/**
 * Mock factory for NestJS Reflector
 */
const createMockReflector = (metadata: Record<string, any> = {}): any => ({
  getAllAndOverride: jest.fn().mockImplementation((key: string) => {
    return metadata[key] !== undefined ? metadata[key] : undefined;
  }),
  get: jest.fn().mockImplementation((key: string) => {
    return metadata[key] !== undefined ? metadata[key] : undefined;
  }),
  getAll: jest.fn().mockReturnValue([]),
  getAllAndMerge: jest.fn().mockReturnValue([]),
});

/**
 * Mock factory for Bull Queue
 */
const createMockBullQueue = (): any => ({
  add: jest.fn().mockResolvedValue({ id: "mock-job-id" }),
  getWaiting: jest.fn().mockResolvedValue([]),
  getActive: jest.fn().mockResolvedValue([]),
  getCompleted: jest.fn().mockResolvedValue([]),
  getFailed: jest.fn().mockResolvedValue([]),
  getDelayed: jest.fn().mockResolvedValue([]),
  getRepeatableJobs: jest.fn().mockResolvedValue([]),
  removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
  clean: jest.fn().mockResolvedValue([]),
  count: jest.fn().mockResolvedValue(0),
  empty: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  resume: jest.fn().mockResolvedValue(undefined),
  process: jest.fn(),
  on: jest.fn(),
});

// Export all utilities for easy importing
export {
  createMockRepository,
  createMockQueryBuilder,
  createMockDataSource,
  createMockCacheManager,
  createMockEntityManager,
  createMockExecutionContext,
  createMockCallHandler,
  createMockQueryRunner,
  createMockReflector,
  createMockBullQueue,
};
