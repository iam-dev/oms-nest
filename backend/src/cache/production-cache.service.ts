import {
  Injectable,
  Logger,
  Inject,
  Optional,
  OnModuleInit,
} from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { ConfigService } from "@nestjs/config";
import { AllConfigType } from "../config/config.type";
import { REDIS_SCAN_CLIENT } from "./cache.constants";
import { Redis } from "ioredis";

export interface CacheStats {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalOperations: number;
  memoryUsage?: number;
  keyCount?: number;
  uptime: number;
}

export interface CacheWarmingJob {
  key: string;
  dataLoader: () => Promise<any>;
  ttl?: number;
  priority: number;
}

/**
 * Production-scale cache service for handling 2.9M records efficiently
 * Implements multi-tier caching with different TTL strategies based on data type
 */
@Injectable()
export class ProductionCacheService implements OnModuleInit {
  private readonly logger = new Logger(ProductionCacheService.name);
  private readonly stats = {
    hits: 0,
    misses: 0,
    startTime: Date.now(),
  };

  // TTL strategies for different data types (milliseconds)
  private readonly TTL_STRATEGIES = {
    // Reference data (long-lived, rarely changes)
    BRANDS: 60 * 60 * 1000, // 60 minutes
    LEATHER_TYPES: 60 * 60 * 1000, // 60 minutes
    STATUSES: 60 * 60 * 1000, // 60 minutes
    OPTIONS: 30 * 60 * 1000, // 30 minutes

    // Search results (medium-lived)
    ORDER_SEARCH: 5 * 60 * 1000, // 5 minutes
    CUSTOMER_SEARCH: 5 * 60 * 1000, // 5 minutes
    FITTER_SEARCH: 10 * 60 * 1000, // 10 minutes

    // Session data (short-lived)
    USER_SESSION: 30 * 60 * 1000, // 30 minutes
    AUTH_TOKEN: 15 * 60 * 1000, // 15 minutes

    // View caches (per migration plan)
    ENRICHED_ORDER_VIEW: 5 * 60 * 1000, // 5 minutes (as specified)
    MATERIALIZED_VIEW: 5 * 60 * 1000, // 5 minutes

    // Default TTL
    DEFAULT: 5 * 60 * 1000, // 5 minutes
  };

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService<AllConfigType>,
    @Optional()
    @Inject(REDIS_SCAN_CLIENT)
    private readonly redisScanClient: Redis | null,
  ) {}

  async onModuleInit() {
    this.logger.log("Production Cache Service initialized");
    if (this.redisScanClient) {
      try {
        await this.redisScanClient.connect();
        this.logger.log("Redis SCAN client connected");
      } catch (error) {
        this.logger.warn("Failed to connect Redis SCAN client", error);
      }
    } else {
      // BE-016: warn at boot so ops can see that pattern-based invalidation
      // will fall back to a full cache.clear() (wider blast radius).
      this.logger.warn(
        "BE-016: Redis SCAN client not configured — invalidatePattern() will fall back " +
          "to cacheManager.clear() which clears ALL cache keys, not just matching ones.",
      );
    }
    // BE-029: Cache loaders (loadBrandsData, loadStatusesData, loadLeatherTypesData)
    // currently return empty arrays because no real data source is wired up.
    // Warming the cache with empty arrays causes downstream code to serve stale
    // empty results until the next TTL expiry.  Warmup is disabled until the
    // loaders are connected to actual repositories.
    //
    // TODO(BE-029): Wire loaders to real repository/service dependencies, then
    // re-enable: void this.warmupCriticalData();
  }

  /**
   * Get reference data with long TTL for brands, statuses, etc.
   */
  async getReferenceData(type: string, id?: string): Promise<any> {
    const key = this.buildReferenceKey(type, id);
    const cached = await this.getFromCache(key);

    if (cached !== null) {
      this.incrementHits();
      return cached;
    }

    this.incrementMisses();
    return null;
  }

  /**
   * Set reference data with appropriate TTL
   */
  async setReferenceData(
    type: string,
    data: any,
    id?: string,
    customTtl?: number,
  ): Promise<void> {
    const key = this.buildReferenceKey(type, id);
    const ttl = customTtl || this.getTTLForType(type);

    await this.setInCache(key, data, ttl);
    this.logger.debug(`Cached reference data: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Get search results with medium TTL
   */
  async getSearchResults(query: string, filters: any): Promise<any> {
    const key = this.buildSearchKey(query, filters);
    const cached = await this.getFromCache(key);

    if (cached !== null) {
      this.incrementHits();
      return cached;
    }

    this.incrementMisses();
    return null;
  }

  /**
   * Set search results with appropriate TTL
   */
  async setSearchResults(
    query: string,
    filters: any,
    data: any,
    searchType = "ORDER",
  ): Promise<void> {
    const key = this.buildSearchKey(query, filters);
    const ttl =
      this.TTL_STRATEGIES[`${searchType}_SEARCH`] ||
      this.TTL_STRATEGIES.DEFAULT;

    await this.setInCache(key, data, ttl);
    this.logger.debug(`Cached search results: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Get user session data
   */
  async getUserSession(userId: string): Promise<any> {
    const key = `user_session:${userId}`;
    const cached = await this.getFromCache(key);

    if (cached !== null) {
      this.incrementHits();
      return cached;
    }

    this.incrementMisses();
    return null;
  }

  /**
   * Set user session data with short TTL
   */
  async setUserSession(userId: string, sessionData: any): Promise<void> {
    const key = `user_session:${userId}`;
    const ttl = this.TTL_STRATEGIES.USER_SESSION;

    await this.setInCache(key, sessionData, ttl);
    this.logger.debug(`Cached user session: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Get auth token data
   */
  async getAuthToken(tokenId: string): Promise<any> {
    const key = `auth_token:${tokenId}`;
    const cached = await this.getFromCache(key);

    if (cached !== null) {
      this.incrementHits();
      return cached;
    }

    this.incrementMisses();
    return null;
  }

  /**
   * Set auth token with short TTL
   */
  async setAuthToken(tokenId: string, tokenData: any): Promise<void> {
    const key = `auth_token:${tokenId}`;
    const ttl = this.TTL_STRATEGIES.AUTH_TOKEN;

    await this.setInCache(key, tokenData, ttl);
    this.logger.debug(`Cached auth token: ${key} (TTL: ${ttl}ms)`);
  }

  /**
   * Generic cache get with pattern support
   */
  async getFromCache(key: string): Promise<any> {
    try {
      const result = await this.cacheManager.get(key);
      return result;
    } catch (error) {
      this.logger.warn(`Cache get failed for key: ${key}`, error);
      return null;
    }
  }

  /**
   * Generic cache set with TTL
   */
  async setInCache(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await this.cacheManager.set(
        key,
        value,
        ttl || this.TTL_STRATEGIES.DEFAULT,
      );
    } catch (error) {
      this.logger.warn(`Cache set failed for key: ${key}`, error);
    }
  }

  /**
   * Invalidate cache by pattern matching
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // For Redis, we need to scan for keys matching the pattern
      const redisClient = await this.getRedisClient();
      if (redisClient) {
        const stream = redisClient.scanStream({
          match: pattern,
          count: 100,
        });

        const keysToDelete: string[] = [];

        stream.on("data", (keys: string[]) => {
          keysToDelete.push(...keys);
        });

        stream.on("end", async () => {
          if (keysToDelete.length > 0) {
            // Remove key prefix before deletion
            const cleanKeys = keysToDelete.map((key) =>
              key.startsWith("oms_cache:") ? key.substring(10) : key,
            );

            for (const key of cleanKeys) {
              await this.cacheManager.del(key);
            }
            this.logger.debug(
              `Invalidated ${cleanKeys.length} keys matching pattern: ${pattern}`,
            );
          }
        });
      } else {
        // BE-016: No SCAN client — fall back to full cache clear.
        // This has a wider blast radius than pattern invalidation but prevents
        // serving stale data. A warning is emitted at boot (see onModuleInit).
        this.logger.warn(
          `invalidatePattern fallback: no Redis SCAN client — clearing full cache ` +
            `instead of pattern "${pattern}"`,
        );
        await this.cacheManager.clear();
      }
    } catch (error) {
      this.logger.warn(`Failed to invalidate pattern: ${pattern}`, error);
    }
  }

  /**
   * Invalidate cache by tags (logical grouping)
   */
  async invalidateByTag(tag: string): Promise<void> {
    const patterns = this.getPatternsByTag(tag);
    for (const pattern of patterns) {
      await this.invalidatePattern(pattern);
    }
  }

  /**
   * Warm up critical cache data on startup
   */
  private async warmupCriticalData(): Promise<void> {
    this.logger.log("Starting cache warmup for critical data");

    const warmupJobs: CacheWarmingJob[] = [
      {
        key: "brands:all",
        dataLoader: () => this.loadBrandsData(),
        ttl: this.TTL_STRATEGIES.BRANDS,
        priority: 10,
      },
      {
        key: "statuses:all",
        dataLoader: () => this.loadStatusesData(),
        ttl: this.TTL_STRATEGIES.STATUSES,
        priority: 9,
      },
      {
        key: "leather_types:all",
        dataLoader: () => this.loadLeatherTypesData(),
        ttl: this.TTL_STRATEGIES.LEATHER_TYPES,
        priority: 8,
      },
    ];

    // Sort by priority (highest first)
    warmupJobs.sort((a, b) => b.priority - a.priority);

    for (const job of warmupJobs) {
      try {
        const data = await job.dataLoader();
        await this.setInCache(job.key, data, job.ttl);
        this.logger.debug(`Warmed up cache for: ${job.key}`);
      } catch (error) {
        this.logger.warn(`Failed to warm up cache for: ${job.key}`, error);
      }
    }

    this.logger.log("Cache warmup completed");
  }

  /**
   * Get cache performance statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const totalOperations = this.stats.hits + this.stats.misses;
    const hitRate = totalOperations > 0 ? this.stats.hits / totalOperations : 0;
    const uptime = Date.now() - this.stats.startTime;

    let memoryUsage: number | undefined;
    let keyCount: number | undefined;

    try {
      const redisClient = await this.getRedisClient();
      if (redisClient) {
        const info = await redisClient.info("memory");
        const keyspace = await redisClient.info("keyspace");

        // Parse memory usage from Redis INFO
        const memoryMatch = info.match(/used_memory:(\d+)/);
        if (memoryMatch) {
          memoryUsage = parseInt(memoryMatch[1], 10);
        }

        // Parse key count from keyspace
        const keyMatch = keyspace.match(/keys=(\d+)/);
        if (keyMatch) {
          keyCount = parseInt(keyMatch[1], 10);
        }
      }
    } catch (error) {
      this.logger.warn("Failed to get Redis stats", error);
    }

    return {
      hitRate: Math.round(hitRate * 100) / 100, // Round to 2 decimal places
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalOperations,
      memoryUsage,
      keyCount,
      uptime,
    };
  }

  /**
   * Get cache hit rate
   */
  async getCacheHitRate(): Promise<number> {
    const stats = await this.getCacheStats();
    return stats.hitRate;
  }

  /**
   * Clear all caches (admin function)
   */
  async clearAllCaches(): Promise<void> {
    try {
      await this.cacheManager.clear();
      this.stats.hits = 0;
      this.stats.misses = 0;
      this.logger.log("All caches cleared");
    } catch (error) {
      this.logger.error("Failed to clear all caches", error);
      throw error;
    }
  }

  // Private helper methods

  private buildReferenceKey(type: string, id?: string): string {
    return id
      ? `ref:${type.toLowerCase()}:${id}`
      : `ref:${type.toLowerCase()}:all`;
  }

  private buildSearchKey(query: string, filters: any): string {
    const filterHash = this.hashObject(filters);
    const queryHash = this.hashString(query);
    return `search:${queryHash}:${filterHash}`;
  }

  private getTTLForType(type: string): number {
    const upperType = type.toUpperCase();
    return this.TTL_STRATEGIES[upperType] || this.TTL_STRATEGIES.DEFAULT;
  }

  private getPatternsByTag(tag: string): string[] {
    const patterns: { [key: string]: string[] } = {
      orders: ["order:*", "enriched_orders:*", "order_search:*"],
      customers: ["customer:*", "customer_search:*"],
      products: ["product:*", "ref:brands:*", "ref:models:*"],
      auth: ["user_session:*", "auth_token:*"],
      reference: ["ref:*"],
      search: ["search:*", "*_search:*"],
    };

    return patterns[tag.toLowerCase()] || [];
  }

  private incrementHits(): void {
    this.stats.hits++;
  }

  private incrementMisses(): void {
    this.stats.misses++;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private hashObject(obj: any): string {
    return this.hashString(JSON.stringify(obj));
  }

  private async getRedisClient(): Promise<Redis | null> {
    await Promise.resolve();
    return this.redisScanClient || null;
  }

  // Data loading methods for cache warming (implement based on actual data sources)
  private async loadBrandsData(): Promise<any[]> {
    await Promise.resolve();
    // TODO: Implement actual data loading from database
    this.logger.debug("Loading brands data for cache warming");
    return [];
  }

  private async loadStatusesData(): Promise<any[]> {
    await Promise.resolve();
    // TODO: Implement actual data loading from database
    this.logger.debug("Loading statuses data for cache warming");
    return [];
  }

  private async loadLeatherTypesData(): Promise<any[]> {
    await Promise.resolve();
    // TODO: Implement actual data loading from database
    this.logger.debug("Loading leather types data for cache warming");
    return [];
  }
}
