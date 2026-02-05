import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { Request } from "express";
import { ProductionCacheService } from "../production-cache.service";

/**
 * Cache interceptor for automatic HTTP response caching
 * Supports configurable TTL, cache keys, and conditional caching
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(private readonly cacheService: ProductionCacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const cacheConfig = this.extractCacheConfig(context);

    // Skip caching for non-GET requests unless explicitly enabled
    if (!this.shouldCache(request, cacheConfig)) {
      return next.handle();
    }

    const cacheKey = this.generateCacheKey(request, cacheConfig);

    // Try to get from cache
    const cachedResponse = await this.cacheService.getFromCache(cacheKey);
    if (cachedResponse !== null) {
      this.logger.debug(`Cache hit for key: ${cacheKey}`);
      return of(cachedResponse);
    }

    // Cache miss - execute the handler and cache the result
    this.logger.debug(`Cache miss for key: ${cacheKey}`);
    return next.handle().pipe(
      tap(async (response) => {
        if (this.shouldCacheResponse(response, cacheConfig)) {
          const ttl = this.getTTL(cacheConfig, request);
          await this.cacheService.setInCache(cacheKey, response, ttl);
          this.logger.debug(
            `Cached response for key: ${cacheKey} (TTL: ${ttl}ms)`,
          );
        }
      }),
    );
  }

  private extractCacheConfig(context: ExecutionContext): any {
    const handler = context.getHandler();
    const classRef = context.getClass();

    // Extract cache configuration from metadata (set by decorators)
    return {
      ttl:
        Reflect.getMetadata("cache:ttl", handler) ||
        Reflect.getMetadata("cache:ttl", classRef),
      key:
        Reflect.getMetadata("cache:key", handler) ||
        Reflect.getMetadata("cache:key", classRef),
      condition:
        Reflect.getMetadata("cache:condition", handler) ||
        Reflect.getMetadata("cache:condition", classRef),
      type:
        Reflect.getMetadata("cache:type", handler) ||
        Reflect.getMetadata("cache:type", classRef) ||
        "default",
    };
  }

  private shouldCache(request: Request, cacheConfig: any): boolean {
    // Only cache GET requests by default
    if (request.method !== "GET") {
      return false;
    }

    // Check if caching is explicitly disabled
    if (cacheConfig.condition === false) {
      return false;
    }

    // Check conditional caching
    if (typeof cacheConfig.condition === "function") {
      return cacheConfig.condition(request);
    }

    return true;
  }

  private shouldCacheResponse(response: any, cacheConfig: any): boolean {
    // Don't cache error responses
    if (response && typeof response === "object" && response.error) {
      return false;
    }

    // Don't cache empty responses unless explicitly allowed
    if (!response && !cacheConfig.allowEmpty) {
      return false;
    }

    return true;
  }

  private generateCacheKey(request: Request, cacheConfig: any): string {
    const baseKey = cacheConfig.key || this.buildDefaultKey(request);
    const queryString = this.buildQueryString(request.query);

    return queryString ? `${baseKey}:${queryString}` : baseKey;
  }

  private buildDefaultKey(request: Request): string {
    // Build cache key from route path
    const route = request.route?.path || request.path;
    const cleanRoute = route.replace(/[/:]/g, "_");
    return `api${cleanRoute}`;
  }

  private buildQueryString(query: any): string {
    if (!query || Object.keys(query).length === 0) {
      return "";
    }

    // Sort query parameters for consistent cache keys
    const sortedEntries = Object.entries(query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);

    return sortedEntries.join("&");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getTTL(cacheConfig: any, _request: Request): number {
    if (cacheConfig.ttl) {
      return cacheConfig.ttl;
    }

    // Determine TTL based on cache type
    const type = cacheConfig.type;
    const ttlMap = {
      reference: 60 * 60 * 1000, // 1 hour for reference data
      search: 5 * 60 * 1000, // 5 minutes for search results
      user: 30 * 60 * 1000, // 30 minutes for user data
      session: 15 * 60 * 1000, // 15 minutes for session data
      default: 5 * 60 * 1000, // 5 minutes default
    };

    return ttlMap[type] || ttlMap.default;
  }
}

/**
 * Search-specific cache interceptor with optimized handling for search operations
 */
@Injectable()
export class SearchCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SearchCacheInterceptor.name);

  constructor(private readonly cacheService: ProductionCacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.method !== "GET") {
      return next.handle();
    }

    const cacheKey = this.generateSearchCacheKey(request);

    // Check cache first
    const cachedResult = await this.cacheService.getSearchResults(
      (request.query.searchTerm as string) || "",
      request.query,
    );

    if (cachedResult) {
      this.logger.debug(`Search cache hit: ${cacheKey}`);
      return of(cachedResult);
    }

    // Execute search and cache result
    return next.handle().pipe(
      tap(async (response) => {
        if (response && response.data) {
          await this.cacheService.setSearchResults(
            (request.query.searchTerm as string) || "",
            request.query,
            response,
            this.getSearchType(request),
          );
          this.logger.debug(`Cached search result: ${cacheKey}`);
        }
      }),
    );
  }

  private generateSearchCacheKey(request: Request): string {
    const searchTerm = (request.query.searchTerm as string) || "";
    const filters = { ...request.query };
    delete filters.searchTerm;

    const route = request.route?.path || request.path;
    return `search:${route}:${searchTerm}:${JSON.stringify(filters)}`;
  }

  private getSearchType(request: Request): string {
    const path = request.path;

    if (path.includes("order")) return "ORDER";
    if (path.includes("customer")) return "CUSTOMER";
    if (path.includes("fitter")) return "FITTER";
    if (path.includes("product")) return "PRODUCT";

    return "DEFAULT";
  }
}

/**
 * Reference data cache interceptor for brands, statuses, etc.
 */
@Injectable()
export class ReferenceCacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ReferenceCacheInterceptor.name);

  constructor(private readonly cacheService: ProductionCacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();

    if (request.method !== "GET") {
      return next.handle();
    }

    const referenceType = this.extractReferenceType(request);
    const id = Array.isArray(request.params.id)
      ? request.params.id[0]
      : request.params.id;

    // Check cache first
    const cachedData = await this.cacheService.getReferenceData(
      referenceType,
      id,
    );

    if (cachedData) {
      this.logger.debug(`Reference cache hit: ${referenceType}:${id || "all"}`);
      return of(cachedData);
    }

    // Load data and cache it
    return next.handle().pipe(
      tap(async (response) => {
        if (response) {
          await this.cacheService.setReferenceData(referenceType, response, id);
          this.logger.debug(
            `Cached reference data: ${referenceType}:${id || "all"}`,
          );
        }
      }),
    );
  }

  private extractReferenceType(request: Request): string {
    const path = request.path;

    if (path.includes("brands")) return "BRANDS";
    if (path.includes("statuses")) return "STATUSES";
    if (path.includes("leather")) return "LEATHER_TYPES";
    if (path.includes("options")) return "OPTIONS";
    if (path.includes("models")) return "MODELS";

    return "UNKNOWN";
  }
}
