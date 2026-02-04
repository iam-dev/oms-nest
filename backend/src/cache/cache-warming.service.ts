import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ProductionCacheService } from "./production-cache.service";
import { ConfigService } from "@nestjs/config";
import { AllConfigType } from "../config/config.type";

export interface WarmupJob {
  name: string;
  key: string;
  loader: () => Promise<any>;
  ttl: number;
  priority: number;
  schedule?: string; // Cron expression for background refresh
}

/**
 * Cache warming service for preloading critical data into cache
 * Ensures fast response times by proactively loading frequently accessed data
 */
@Injectable()
export class CacheWarmingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CacheWarmingService.name);
  private isWarming = false;

  constructor(
    private readonly cacheService: ProductionCacheService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async onApplicationBootstrap() {
    await Promise.resolve();
    // Delay initial warmup to ensure all modules are loaded
    setTimeout(() => {
      void this.warmupCriticalData();
    }, 5000);
  }

  /**
   * Warm up all critical cache data
   */
  async warmupCriticalData(): Promise<void> {
    if (this.isWarming) {
      this.logger.warn("Cache warming already in progress, skipping");
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();

    try {
      this.logger.log("Starting cache warming for production-scale data");

      const jobs = this.getWarmupJobs();

      // Sort by priority (highest first)
      jobs.sort((a, b) => b.priority - a.priority);

      let successCount = 0;
      let errorCount = 0;

      // Execute warmup jobs in parallel batches to avoid overwhelming the database
      const batchSize = 3;
      for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);

        const batchPromises = batch.map(async (job) => {
          try {
            const startJobTime = Date.now();
            const data = await job.loader();

            if (data !== null && data !== undefined) {
              await this.cacheService.setInCache(job.key, data, job.ttl);
              const duration = Date.now() - startJobTime;
              this.logger.debug(`✓ Warmed up ${job.name} (${duration}ms)`);
              successCount++;
            } else {
              this.logger.warn(`⚠ No data for ${job.name}`);
            }
          } catch (error) {
            this.logger.error(
              `✗ Failed to warm up ${job.name}:`,
              error.message,
            );
            errorCount++;
          }
        });

        await Promise.allSettled(batchPromises);

        // Small delay between batches to avoid database overload
        if (i + batchSize < jobs.length) {
          await this.delay(100);
        }
      }

      const totalDuration = Date.now() - startTime;
      this.logger.log(
        `Cache warming completed: ${successCount} successful, ${errorCount} failed (${totalDuration}ms)`,
      );
    } catch (error) {
      this.logger.error("Cache warming failed:", error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Background refresh of cache data (runs every 30 minutes)
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async backgroundRefresh(): Promise<void> {
    this.logger.debug("Starting background cache refresh");

    try {
      // Only refresh high-priority items in background
      const jobs = this.getWarmupJobs().filter((job) => job.priority >= 8);

      for (const job of jobs) {
        try {
          // Check if cache key exists and is close to expiration
          const cached = await this.cacheService.getFromCache(job.key);
          if (!cached) {
            const data = await job.loader();
            await this.cacheService.setInCache(job.key, data, job.ttl);
            this.logger.debug(`Background refreshed: ${job.name}`);
          }
        } catch (error) {
          this.logger.warn(
            `Background refresh failed for ${job.name}:`,
            error.message,
          );
        }
      }
    } catch (error) {
      this.logger.error("Background cache refresh failed:", error);
    }
  }

  /**
   * Warm up specific data type
   */
  async warmupSpecific(dataType: string): Promise<boolean> {
    const job = this.getWarmupJobs().find((j) => j.name === dataType);

    if (!job) {
      this.logger.warn(`No warmup job found for data type: ${dataType}`);
      return false;
    }

    try {
      this.logger.log(`Warming up specific data type: ${dataType}`);
      const data = await job.loader();
      await this.cacheService.setInCache(job.key, data, job.ttl);
      this.logger.log(`Successfully warmed up: ${dataType}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to warm up ${dataType}:`, error);
      return false;
    }
  }

  /**
   * Get cache warming status
   */
  getWarmupStatus(): { isWarming: boolean; lastRun?: Date } {
    return {
      isWarming: this.isWarming,
      // TODO: Add last run tracking
    };
  }

  /**
   * Define all warmup jobs for critical data
   */
  private getWarmupJobs(): WarmupJob[] {
    return [
      {
        name: "brands",
        key: "ref:brands:all",
        loader: () => this.loadBrands(),
        ttl: 60 * 60 * 1000, // 1 hour
        priority: 10,
        schedule: CronExpression.EVERY_HOUR,
      },
      {
        name: "statuses",
        key: "ref:statuses:all",
        loader: () => this.loadStatuses(),
        ttl: 60 * 60 * 1000, // 1 hour
        priority: 10,
      },
      {
        name: "leather_types",
        key: "ref:leather_types:all",
        loader: () => this.loadLeatherTypes(),
        ttl: 60 * 60 * 1000, // 1 hour
        priority: 9,
      },
      {
        name: "options",
        key: "ref:options:all",
        loader: () => this.loadOptions(),
        ttl: 30 * 60 * 1000, // 30 minutes
        priority: 8,
      },
      {
        name: "models",
        key: "ref:models:all",
        loader: () => this.loadModels(),
        ttl: 30 * 60 * 1000, // 30 minutes
        priority: 8,
      },
      {
        name: "recent_orders",
        key: "recent_orders:all",
        loader: () => this.loadRecentOrders(),
        ttl: 5 * 60 * 1000, // 5 minutes
        priority: 7,
      },
      {
        name: "active_fitters",
        key: "ref:fitters:active",
        loader: () => this.loadActiveFitters(),
        ttl: 30 * 60 * 1000, // 30 minutes
        priority: 6,
      },
      {
        name: "popular_products",
        key: "products:popular",
        loader: () => this.loadPopularProducts(),
        ttl: 60 * 60 * 1000, // 1 hour
        priority: 5,
      },
    ];
  }

  // Data loading methods

  private async loadBrands(): Promise<any[]> {
    const result = await this.dataSource.query(`
      SELECT id, brand_name as name
      FROM brands
      ORDER BY brand_name ASC
    `);
    this.logger.debug(`Loaded ${result.length} brands for cache`);
    return result;
  }

  private async loadStatuses(): Promise<any[]> {
    const result = await this.dataSource.query(`
      SELECT id, name, factory_hidden, factory_alternative_name, sequence
      FROM statuses
      ORDER BY sequence ASC
    `);
    this.logger.debug(`Loaded ${result.length} statuses for cache`);
    return result;
  }

  private async loadLeatherTypes(): Promise<any[]> {
    const result = await this.dataSource.query(`
      SELECT id, name, sequence
      FROM leather_types
      WHERE deleted = 0
      ORDER BY sequence ASC
    `);
    this.logger.debug(`Loaded ${result.length} leather types for cache`);
    return result;
  }

  private async loadOptions(): Promise<any[]> {
    const result = await this.dataSource.query(`
      SELECT id, name, "group", type, sequence,
             price1, price2, price3, price4, price5, price6, price7
      FROM options
      WHERE deleted = 0
      ORDER BY sequence ASC
      LIMIT 1000
    `);
    this.logger.debug(`Loaded ${result.length} options for cache`);
    return result;
  }

  private async loadModels(): Promise<any[]> {
    // Load saddles which contain brand and model_name
    const result = await this.dataSource.query(`
      SELECT id, brand, model_name, type, sequence, active
      FROM saddles
      WHERE deleted = 0 AND active = 1
      ORDER BY brand, model_name ASC
      LIMIT 1000
    `);
    this.logger.debug(`Loaded ${result.length} saddle models for cache`);
    return result;
  }

  private async loadRecentOrders(): Promise<any[]> {
    // order_time is stored as Unix timestamp (integer)
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const result = await this.dataSource.query(
      `
      SELECT id, order_status, order_time, rushed as is_urgent
      FROM orders
      WHERE order_time >= $1
      ORDER BY order_time DESC
      LIMIT 100
    `,
      [sevenDaysAgo],
    );
    this.logger.debug(`Loaded ${result.length} recent orders for cache`);
    return result;
  }

  private async loadActiveFitters(): Promise<any[]> {
    const result = await this.dataSource.query(`
      SELECT f.id, c.full_name as name, f.emailaddress as email,
             f.city, f.country
      FROM fitters f
      LEFT JOIN credentials c ON f.user_id = c.user_id
      WHERE f.deleted = 0
      ORDER BY c.full_name ASC
      LIMIT 100
    `);
    this.logger.debug(`Loaded ${result.length} active fitters for cache`);
    return result;
  }

  private async loadPopularProducts(): Promise<any[]> {
    // This would be implemented with actual product analytics
    // For now, return empty array
    this.logger.debug("Popular products loading not implemented yet");
    return await Promise.resolve([]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
