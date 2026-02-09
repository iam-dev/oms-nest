import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ProductionCacheService } from "./production-cache.service";
import { CacheWarmingService } from "./cache-warming.service";
import { CacheMetricsService } from "./cache-metrics.service";
import { CacheInvalidationService } from "./cache-invalidation.service";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";

/**
 * Cache Management Controller for administrative operations
 * Provides endpoints for monitoring, warming, and invalidating cache
 * Restricted to admin users for security
 */
@ApiTags("Cache Management")
@Controller("admin/cache")
@ApiCookieAuth("token")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(RoleEnum.admin, RoleEnum.supervisor)
export class CacheManagementController {
  constructor(
    private readonly cacheService: ProductionCacheService,
    private readonly warmingService: CacheWarmingService,
    private readonly metricsService: CacheMetricsService,
    private readonly invalidationService: CacheInvalidationService,
  ) {}

  @Get("stats")
  @ApiOperation({
    summary: "Get cache statistics",
    description:
      "Returns comprehensive cache performance metrics and statistics",
  })
  @ApiResponse({
    status: 200,
    description: "Cache statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        hitRate: { type: "number", description: "Cache hit rate percentage" },
        totalHits: { type: "number", description: "Total cache hits" },
        totalMisses: { type: "number", description: "Total cache misses" },
        totalOperations: {
          type: "number",
          description: "Total cache operations",
        },
        memoryUsage: { type: "number", description: "Memory usage in bytes" },
        keyCount: { type: "number", description: "Number of keys in cache" },
        uptime: { type: "number", description: "Cache uptime in milliseconds" },
      },
    },
  })
  async getCacheStats() {
    return await this.cacheService.getCacheStats();
  }

  @Get("health")
  @ApiOperation({
    summary: "Get cache health status",
    description: "Returns overall cache system health status",
  })
  @ApiResponse({
    status: 200,
    description: "Cache health status retrieved successfully",
    schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["healthy", "degraded", "unhealthy"],
        },
      },
    },
  })
  async getCacheHealth() {
    const health = await this.metricsService.getCacheHealth();
    return { status: health };
  }

  @Get("metrics")
  @ApiOperation({
    summary: "Get comprehensive cache metrics",
    description:
      "Returns detailed cache performance metrics including trends and alerts",
  })
  @ApiResponse({
    status: 200,
    description: "Cache metrics retrieved successfully",
  })
  async getCacheMetrics() {
    return await this.metricsService.getCacheMetrics();
  }

  @Get("metrics/endpoints")
  @ApiOperation({
    summary: "Get endpoint-specific cache metrics",
    description:
      "Returns cache performance metrics for individual API endpoints",
  })
  @ApiResponse({
    status: 200,
    description: "Endpoint metrics retrieved successfully",
  })
  async getEndpointMetrics() {
    return {
      endpoints: await this.metricsService.getEndpointMetrics(),
    };
  }

  @Get("performance-report")
  @ApiOperation({
    summary: "Generate cache performance report",
    description:
      "Generates a comprehensive performance report with recommendations",
  })
  @ApiResponse({
    status: 200,
    description: "Performance report generated successfully",
  })
  async getPerformanceReport() {
    return await this.metricsService.generatePerformanceReport();
  }

  @Get("warmup/status")
  @ApiOperation({
    summary: "Get cache warming status",
    description: "Returns current status of cache warming operations",
  })
  @ApiResponse({
    status: 200,
    description: "Cache warming status retrieved successfully",
  })
  getWarmupStatus() {
    return this.warmingService.getWarmupStatus();
  }

  @Post("warmup")
  @ApiOperation({
    summary: "Start cache warming",
    description: "Triggers cache warming for critical data",
  })
  @ApiResponse({
    status: 202,
    description: "Cache warming started successfully",
  })
  @HttpCode(HttpStatus.ACCEPTED)
  async startCacheWarming() {
    await Promise.resolve();
    // Don't await to return quickly
    void this.warmingService.warmupCriticalData();
    return {
      message: "Cache warming started",
      status: "accepted",
    };
  }

  @Post("warmup/:dataType")
  @ApiOperation({
    summary: "Warm specific data type",
    description:
      "Triggers cache warming for a specific data type (e.g., brands, statuses)",
  })
  @ApiResponse({
    status: 200,
    description: "Specific data type warmed successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Data type not found",
  })
  async warmSpecificDataType(@Param("dataType") dataType: string) {
    const success = await this.warmingService.warmupSpecific(dataType);

    if (!success) {
      return {
        message: `Data type '${dataType}' not found`,
        status: "error",
      };
    }

    return {
      message: `Cache warming completed for ${dataType}`,
      status: "success",
    };
  }

  @Delete("clear")
  @ApiOperation({
    summary: "Clear all caches",
    description: "Clears all cached data - use with caution in production",
  })
  @ApiResponse({
    status: 200,
    description: "All caches cleared successfully",
  })
  async clearAllCaches() {
    await this.cacheService.clearAllCaches();
    return {
      message: "All caches cleared successfully",
      status: "success",
    };
  }

  @Delete("invalidate/:pattern")
  @ApiOperation({
    summary: "Invalidate cache by pattern",
    description: "Invalidates cache entries matching the specified pattern",
  })
  @ApiResponse({
    status: 200,
    description: "Cache invalidated successfully",
  })
  async invalidateCachePattern(@Param("pattern") pattern: string) {
    await this.cacheService.invalidatePattern(pattern);
    return {
      message: `Cache invalidated for pattern: ${pattern}`,
      status: "success",
    };
  }

  @Delete("invalidate/tag/:tag")
  @ApiOperation({
    summary: "Invalidate cache by tag",
    description: "Invalidates cache entries by logical tag grouping",
  })
  @ApiResponse({
    status: 200,
    description: "Cache invalidated by tag successfully",
  })
  async invalidateCacheByTag(@Param("tag") tag: string) {
    await this.cacheService.invalidateByTag(tag);
    return {
      message: `Cache invalidated for tag: ${tag}`,
      status: "success",
    };
  }

  @Post("invalidate/entity")
  @ApiOperation({
    summary: "Invalidate cache for entity operation",
    description: "Invalidates caches related to a specific entity operation",
  })
  @ApiQuery({
    name: "entityType",
    required: true,
    description: "Entity type (e.g., order, customer)",
  })
  @ApiQuery({ name: "entityId", required: false, description: "Entity ID" })
  @ApiQuery({
    name: "operation",
    required: true,
    description: "Operation type (create, update, delete)",
  })
  @ApiResponse({
    status: 200,
    description: "Entity cache invalidated successfully",
  })
  async invalidateEntityCache(
    @Query("entityType") entityType: string,
    @Query("entityId") entityId?: string,
    @Query("operation") operation?: string,
  ) {
    await this.invalidationService.invalidateEntityCaches({
      entityType,
      entityId,
      operation: operation as "create" | "update" | "delete",
    });

    return {
      message: `Cache invalidated for ${entityType}${entityId ? `:${entityId}` : ""} (${operation})`,
      status: "success",
    };
  }

  @Get("invalidation/stats")
  @ApiOperation({
    summary: "Get cache invalidation statistics",
    description:
      "Returns statistics about cache invalidation queue and operations",
  })
  @ApiResponse({
    status: 200,
    description: "Invalidation statistics retrieved successfully",
  })
  async getInvalidationStats() {
    return await this.invalidationService.getCacheStats();
  }

  @Post("test/load")
  @ApiOperation({
    summary: "Run cache load test",
    description:
      "Executes a load test to verify cache performance under stress",
  })
  @ApiQuery({
    name: "requests",
    required: false,
    description: "Number of test requests (default: 1000)",
  })
  @ApiResponse({
    status: 200,
    description: "Load test completed successfully",
  })
  async runLoadTest(@Query("requests") requests: string = "1000") {
    const requestCount = parseInt(requests, 10);
    const startTime = Date.now();

    // Generate test operations
    const operations = Array.from({ length: requestCount }, (_, i) => ({
      type: i % 3 === 0 ? "get" : i % 3 === 1 ? "set" : "invalidate",
      key: `load_test:${i % 100}`,
      value: i % 3 === 1 ? { testData: `data_${i}` } : undefined,
    }));

    let successCount = 0;
    let errorCount = 0;

    // Execute operations in batches to avoid overwhelming the system
    const batchSize = 50;
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);

      const promises = batch.map(async (op) => {
        try {
          switch (op.type) {
            case "get":
              await this.cacheService.getFromCache(op.key);
              break;
            case "set":
              await this.cacheService.setInCache(op.key, op.value);
              break;
            case "invalidate":
              await this.cacheService.invalidatePattern(`${op.key}*`);
              break;
          }
          successCount++;
        } catch {
          errorCount++;
        }
      });

      await Promise.allSettled(promises);
    }

    const duration = Date.now() - startTime;
    const throughput = Math.round((requestCount / duration) * 1000); // operations per second

    return {
      message: "Load test completed",
      results: {
        totalOperations: requestCount,
        successfulOperations: successCount,
        failedOperations: errorCount,
        duration: `${duration}ms`,
        throughput: `${throughput} ops/sec`,
        averageResponseTime: `${Math.round(duration / requestCount)}ms`,
      },
    };
  }

  @Post("metrics/reset")
  @ApiOperation({
    summary: "Reset cache metrics",
    description: "Resets all cache performance metrics and counters",
  })
  @ApiResponse({
    status: 200,
    description: "Cache metrics reset successfully",
  })
  resetMetrics() {
    this.metricsService.resetMetrics();
    return {
      message: "Cache metrics reset successfully",
      status: "success",
    };
  }

  @Get("config")
  @ApiOperation({
    summary: "Get cache configuration",
    description: "Returns current cache configuration and TTL strategies",
  })
  @ApiResponse({
    status: 200,
    description: "Cache configuration retrieved successfully",
  })
  getCacheConfig() {
    return {
      ttlStrategies: {
        referenceData: "60 minutes",
        searchResults: "5-10 minutes",
        userSessions: "30 minutes",
        authTokens: "15 minutes",
        enrichedOrderViews: "5 minutes",
      },
      features: {
        clustering: "supported",
        connectionPooling: "enabled",
        backgroundWarming: "enabled",
        patternInvalidation: "enabled",
        performanceMonitoring: "enabled",
        circuitBreaker: "enabled",
      },
      targets: {
        hitRate: ">85%",
        responseTime: "<100ms",
        availability: ">99.9%",
      },
    };
  }
}
