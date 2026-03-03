import { Injectable, Inject, Logger, ForbiddenException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import { ConfigService } from "@nestjs/config";
import { AllConfigType } from "../config/config.type";
import { ProductionCacheService } from "../cache/production-cache.service";

// Status IDs where fitters (role 1) are NOT allowed to edit orders
const FITTER_RESTRICTED_STATUS_IDS = [2, 3, 5, 7, 9, 10, 11];
const FITTER_ROLE_ID = 1;

export interface EnrichedOrdersQueryDto {
  page?: number;
  limit?: number;
  partial?: boolean | string;
  noCache?: string | boolean;
  searchTerm?: string;
  search?: string; // Alias for searchTerm
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  // Filter by order ID
  id?: number;
  orderId?: number;
  // Filter by urgency (0/1 or true/false)
  urgency?: string;
  urgent?: string | boolean;
  // Filter by fitter (ID or name)
  fitterId?: number;
  fitterName?: string;
  fitter?: string;
  // Filter by customer (ID or name)
  customerId?: number;
  customerName?: string;
  customer?: string;
  // Filter by brand/saddle
  brandId?: number;
  saddleName?: string;
  // Filter by status
  orderStatus?: string;
  status?: string;
  // Filter by factory
  factoryId?: number;
  factoryName?: string;
  factory?: string;
  // Filter by seat size
  seatSizes?: string;
  seatSize?: string;
  // Filter by customer country
  customerCountry?: string;
  // Filter by repair flag (0/1 or true/false)
  repair?: string | boolean;
  // Comma-separated order IDs for bulk search
  orderIds?: string;
  // Filter by knee roll (option_id = 2) value
  kneeRoll?: string;
  // Filter by supplier name (alias for factoryName)
  supplierName?: string;
  // Filter by fitter country
  fitterCountry?: string;
  // Filter by sale type (comma-separated: demo,sponsored,urgent,repair,normal)
  saleType?: string;
  // Filter by leather type name
  leatherType?: string;
  // Filter by fitter reference
  fitterReference?: string;
  // Date range filter (ISO date strings, e.g. "2026-01-01")
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginationMetadata {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface EnrichedOrdersResponse {
  data: any[];
  pagination: PaginationMetadata;
  metadata: {
    queriedAt: string;
    cached: boolean;
    processingTimeMs: number;
  };
}

export interface UpdateOrderDto {
  fitterId?: number;
  saddleId?: number;
  leatherId?: number;
  fitterStock?: boolean;
  demo?: boolean;
  repair?: boolean;
  rushed?: boolean;
  sponsored?: boolean;
  customOrder?: boolean;
  specialNotes?: string;
  horseName?: string;
  // Customer fields (written to orders table)
  customerName?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerZipcode?: string;
  customerCountry?: string;
  customerPhone?: string;
  customerCell?: string;
  customerId?: number;
  // Shipping fields
  shipName?: string;
  shipAddress?: string;
  shipCity?: string;
  shipState?: string;
  shipZipcode?: string;
  shipCountry?: string;
  // Order reference & status
  orderReference?: string;
  orderStatus?: string;
  // Pricing (in dollars, converted to cents server-side)
  priceSaddle?: number;
  priceTradein?: number;
  priceDeposit?: number;
  priceDiscount?: number;
  priceFittingeval?: number;
  priceCallfee?: number;
  priceGirth?: number;
  priceShipping?: number;
  priceTax?: number;
  priceAdditional?: number;
  // Saddle options (replaces orders_info rows)
  saddleOptions?: Array<{
    optionId: number;
    optionItemId: number;
    custom?: string;
  }>;
  // Seat sizes for the order
  seatSizes?: string[];
  // Repair linking: the original order this repair was created from
  repairSourceOrderId?: number;
}

export interface SaddleSpecRow {
  orderId: number;
  optionId: number;
  optionName: string;
  displayValue: string;
}

export interface SaddleSpecResult {
  optionId: number;
  optionName: string;
  displayValue: string;
}

@Injectable()
export class EnrichedOrdersService {
  private readonly logger = new Logger(EnrichedOrdersService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly configService: ConfigService<AllConfigType>,
    private readonly productionCacheService: ProductionCacheService,
  ) {}

  /**
   * Look up the fitter record ID for a given legacy user ID (credentials.user_id).
   * Returns null if no fitter is associated with this user.
   */
  async getFitterIdByUserId(legacyUserId: number): Promise<number | null> {
    const result = await this.dataSource.query(
      "SELECT id FROM fitters WHERE user_id = $1 LIMIT 1",
      [legacyUserId],
    );
    return result[0]?.id ?? null;
  }

  async getEnrichedOrders(
    query: EnrichedOrdersQueryDto,
  ): Promise<EnrichedOrdersResponse> {
    const startTime = Date.now();
    const cacheConfig = this.configService.get("cache", { infer: true });
    const isCacheEnabled = cacheConfig?.enabled ?? false;
    const cacheTTL = cacheConfig?.ttl ?? 300000;

    try {
      let cached: any = null;
      let cacheKey = "";

      if (isCacheEnabled && !query.noCache) {
        cacheKey = this.generateCacheKey(query);
        // Try to get from cache first
        cached = await this.cacheManager.get(cacheKey);
        if (cached) {
          this.logger.debug(`Cache hit for enriched orders: ${cacheKey}`);
          return {
            ...(cached as EnrichedOrdersResponse),
            metadata: {
              ...(cached as EnrichedOrdersResponse).metadata,
              cached: true,
              processingTimeMs: Date.now() - startTime,
            },
          };
        }
      }

      // Execute the query
      const result = await this.executeEnrichedOrdersQuery(query);
      const processingTime = Date.now() - startTime;

      const response: EnrichedOrdersResponse = {
        ...result,
        metadata: {
          queriedAt: new Date().toISOString(),
          cached: false,
          processingTimeMs: processingTime,
        },
      };

      if (isCacheEnabled && !query.noCache) {
        // Cache the result
        await this.cacheManager.set(cacheKey, response, cacheTTL);
        this.logger.debug(
          `Cached enriched orders result: ${cacheKey} (TTL: ${cacheTTL}ms)`,
        );
      } else {
        this.logger.debug(
          `Fresh data fetched for enriched orders (caching disabled)`,
        );
      }

      return response;
    } catch (error) {
      this.logger.error("Failed to fetch enriched orders", error);
      throw error;
    }
  }

  async getFilterOptions(): Promise<Record<string, string[]>> {
    const cacheKey = "enriched_orders:filter_options";
    const cached =
      await this.cacheManager.get<Record<string, string[]>>(cacheKey);
    if (cached) return cached;

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('rls.user_id', '0', true)`);

      const [
        fitters,
        customers,
        saddles,
        customerCountries,
        fitterCountries,
        kneeRolls,
        leatherTypes,
        factories,
      ] = await Promise.all([
        queryRunner.query(`
          SELECT DISTINCT fc.full_name as name FROM orders o
          JOIN fitters f ON o.fitter_id = f.id
          JOIN credentials fc ON f.user_id = fc.user_id
          WHERE o.deleted_at IS NULL AND fc.full_name IS NOT NULL AND fc.full_name != ''
          ORDER BY name
        `),
        queryRunner.query(`
          SELECT DISTINCT COALESCE(c.name, o.name) as name FROM orders o
          LEFT JOIN customers c ON o.customer_id = c.id
          WHERE o.deleted_at IS NULL AND COALESCE(c.name, o.name) IS NOT NULL AND COALESCE(c.name, o.name) != ''
          ORDER BY name
        `),
        queryRunner.query(`
          SELECT DISTINCT CONCAT_WS(' - ', NULLIF(s.brand, ''), NULLIF(s.model_name, '')) as name
          FROM orders o
          JOIN saddles s ON o.saddle_id = s.id
          WHERE o.deleted_at IS NULL AND (s.brand IS NOT NULL OR s.model_name IS NOT NULL)
          ORDER BY name
        `),
        queryRunner.query(`
          SELECT DISTINCT c.country as name FROM orders o
          JOIN customers c ON o.customer_id = c.id
          WHERE o.deleted_at IS NULL AND c.country IS NOT NULL AND c.country != ''
          ORDER BY name
        `),
        queryRunner.query(`
          SELECT DISTINCT f.country as name FROM orders o
          JOIN fitters f ON o.fitter_id = f.id
          WHERE o.deleted_at IS NULL AND f.country IS NOT NULL AND f.country != ''
          ORDER BY name
        `),
        queryRunner.query(`
          SELECT DISTINCT oi2.name FROM orders_info oi
          JOIN options_items oi2 ON oi.option_item_id = oi2.id
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.option_id = 2 AND o.deleted_at IS NULL AND oi2.name IS NOT NULL AND oi2.name != ''
          ORDER BY name
        `),
        queryRunner.query(`
          SELECT DISTINCT lt.name FROM orders o
          JOIN leather_types lt ON o.leather_id = lt.id
          WHERE o.deleted_at IS NULL AND lt.name IS NOT NULL AND lt.name != ''
          ORDER BY name
        `),
        queryRunner.query(`
          SELECT DISTINCT fac.full_name as name FROM orders o
          JOIN factories fa ON o.factory_id = fa.id
          JOIN credentials fac ON fa.user_id = fac.user_id
          WHERE o.deleted_at IS NULL AND o.factory_id > 0
            AND fac.full_name IS NOT NULL AND fac.full_name != ''
          ORDER BY name
        `),
      ]);

      const extract = (rows: Array<{ name: string }>) =>
        rows.map((r) => r.name).filter(Boolean);

      const result: Record<string, string[]> = {
        fitters: extract(fitters),
        customers: extract(customers),
        saddles: extract(saddles),
        customerCountries: extract(customerCountries),
        fitterCountries: extract(fitterCountries),
        kneeRolls: extract(kneeRolls),
        leatherTypes: extract(leatherTypes),
        factories: extract(factories),
      };

      await this.cacheManager.set(cacheKey, result, 300000);
      return result;
    } finally {
      await queryRunner.release();
    }
  }

  private async executeEnrichedOrdersQuery(
    query: EnrichedOrdersQueryDto,
  ): Promise<{
    data: any[];
    pagination: PaginationMetadata;
  }> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100); // Max 100 items per page
    const offset = (page - 1) * limit;

    // Build the base query using legacy database schema with proper JOINs
    const baseQuery = `
      SELECT
        o.id,
        o.id as "orderId",
        to_timestamp(o.order_time) as created_at,
        o.rushed as urgency,
        o.special_notes,
        COALESCE(c.name, o.name, '') as customer_name,
        o.customer_id,
        o.demo,
        o.sponsored,
        fc.full_name as fitter_name,
        o.fitter_id,
        s.brand as brand_name,
        o.saddle_id as brand_id,
        s.model_name,
        o.saddle_id as model_id,
        st.name as "orderStatus",
        o.order_status as status_id,
        fac.full_name as factory_name,
        o.factory_id,
        o.order_data,
        o.seat_sizes,
        c.country as customer_country,
        f.country as fitter_country,
        o.repair,
        o.repair_source_order_id as "repairSourceOrderId",
        (SELECT oi2.name FROM orders_info oi
         JOIN options_items oi2 ON oi.option_item_id = oi2.id
         WHERE oi.order_id = o.id AND oi.option_id = 2
         LIMIT 1) as knee_roll,
        lt.name as leather_name,
        o.fitter_reference
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN fitters f ON o.fitter_id = f.id
      LEFT JOIN credentials fc ON f.user_id = fc.user_id
      LEFT JOIN saddles s ON o.saddle_id = s.id
      LEFT JOIN factories fa ON o.factory_id = fa.id
      LEFT JOIN credentials fac ON fa.user_id = fac.user_id
      LEFT JOIN statuses st ON o.order_status = st.id
      LEFT JOIN leather_types lt ON o.leather_id = lt.id
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN fitters f ON o.fitter_id = f.id
      LEFT JOIN credentials fc ON f.user_id = fc.user_id
      LEFT JOIN saddles s ON o.saddle_id = s.id
      LEFT JOIN factories fa ON o.factory_id = fa.id
      LEFT JOIN credentials fac ON fa.user_id = fac.user_id
      LEFT JOIN statuses st ON o.order_status = st.id
      LEFT JOIN leather_types lt ON o.leather_id = lt.id`;

    // Add WHERE conditions
    const conditions = this.buildWhereConditions(query);
    let finalBaseQuery = baseQuery;
    let finalCountQuery = countQuery;

    if (conditions.where) {
      finalBaseQuery += ` WHERE ${conditions.where}`;
      finalCountQuery += ` WHERE ${conditions.where}`;
    }

    // Add ORDER BY
    const orderBy = this.buildOrderBy(query);
    finalBaseQuery += ` ${orderBy}`;

    // Add pagination
    finalBaseQuery += ` LIMIT $${conditions.params.length + 1} OFFSET $${conditions.params.length + 2}`;

    // Use QueryRunner to set RLS bypass context for system queries
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Set RLS bypass context (user_id = 0 triggers system_bypass policies)
      await queryRunner.query(`SELECT set_config('rls.user_id', '0', true)`);

      // Execute count query
      const countResult = await queryRunner.query(
        finalCountQuery,
        conditions.params,
      );
      const totalItems = parseInt(countResult[0].total);

      // Execute data query
      const dataResult = await queryRunner.query(finalBaseQuery, [
        ...conditions.params,
        limit,
        offset,
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const pagination: PaginationMetadata = {
        totalItems,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      };

      this.logger.log(
        `Fetched ${dataResult.length} enriched orders (page ${page}/${totalPages})`,
      );

      return {
        data: dataResult,
        pagination,
      };
    } catch (error) {
      this.logger.error("Database query failed", error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private buildWhereConditions(query: EnrichedOrdersQueryDto): {
    where: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by order ID (exact match)
    const orderId = query.id || query.orderId;
    if (orderId) {
      conditions.push(`o.id = $${paramIndex}`);
      params.push(orderId);
      paramIndex++;
    }

    // Filter by multiple order IDs (bulk search)
    if (!orderId && query.orderIds) {
      const idsArray = query.orderIds
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^\d+$/.test(id))
        .map((id) => parseInt(id, 10));
      if (idsArray.length > 0) {
        conditions.push(`o.id = ANY($${paramIndex}::int[])`);
        params.push(idsArray);
        paramIndex++;
      }
    }

    // General search term (searches multiple fields)
    // Splits multi-word queries into individual words and matches ANY word
    const searchTermValue = query.searchTerm || query.search;
    if (searchTermValue) {
      const searchFields = [
        "o.name",
        "o.special_notes",
        "o.horse_name",
        "o.fitter_reference",
        "c.name",
        "fc.full_name",
        "fac.full_name",
        "s.brand",
        "s.model_name",
        "COALESCE(o.order_data, '')",
      ];
      // Split into words, filter out very short words (< 3 chars) to reduce noise
      const words = searchTermValue
        .trim()
        .split(/\s+/)
        .filter((w: string) => w.length >= 3);

      if (words.length <= 1) {
        // Single word or short phrase: exact substring match (original behavior)
        const fieldConditions = searchFields
          .map((f) => `${f} ILIKE $${paramIndex}`)
          .join(" OR ");
        conditions.push(`(${fieldConditions})`);
        params.push(`%${searchTermValue}%`);
        paramIndex++;
      } else {
        // Multi-word: each word must match at least one field (AND between words)
        const wordConditions = words.map((word: string) => {
          const idx = paramIndex;
          paramIndex++;
          params.push(`%${word}%`);
          const fieldConditions = searchFields
            .map((f) => `${f} ILIKE $${idx}`)
            .join(" OR ");
          return `(${fieldConditions})`;
        });
        conditions.push(`(${wordConditions.join(" AND ")})`);
      }
    }

    // Filter by urgency (accepts multiple formats)
    const urgencyValue = query.urgency || query.urgent;
    if (
      urgencyValue !== undefined &&
      urgencyValue !== null &&
      urgencyValue !== ""
    ) {
      const isUrgent =
        urgencyValue === "true" ||
        urgencyValue === true ||
        urgencyValue === "1" ||
        urgencyValue === "Yes" ||
        urgencyValue === "urgent";
      const isNotUrgent =
        urgencyValue === "false" ||
        urgencyValue === false ||
        urgencyValue === "0" ||
        urgencyValue === "No";

      if (isUrgent) {
        conditions.push(`o.rushed = $${paramIndex}`);
        params.push(1);
        paramIndex++;
      } else if (isNotUrgent) {
        conditions.push(`o.rushed = $${paramIndex}`);
        params.push(0);
        paramIndex++;
      }
    }

    // Filter by date range (order_time is a unix timestamp integer)
    if (query.dateFrom) {
      const fromTs = Math.floor(new Date(query.dateFrom).getTime() / 1000);
      if (!isNaN(fromTs)) {
        conditions.push(`o.order_time >= $${paramIndex}`);
        params.push(fromTs);
        paramIndex++;
      }
    }
    if (query.dateTo) {
      // End of day: set to 23:59:59 of the dateTo date
      const toDate = new Date(query.dateTo);
      toDate.setHours(23, 59, 59, 999);
      const toTs = Math.floor(toDate.getTime() / 1000);
      if (!isNaN(toTs)) {
        conditions.push(`o.order_time <= $${paramIndex}`);
        params.push(toTs);
        paramIndex++;
      }
    }

    // Filter by fitter ID
    if (query.fitterId) {
      conditions.push(`o.fitter_id = $${paramIndex}`);
      params.push(query.fitterId);
      paramIndex++;
    }

    // Filter by fitter name (searches in credentials.full_name via fitters join)
    // Supports comma-separated values for multi-select
    const fitterNameFilter = query.fitterName || query.fitter;
    if (fitterNameFilter) {
      const values = String(fitterNameFilter)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 1) {
        conditions.push(`fc.full_name ILIKE $${paramIndex}`);
        params.push(`%${values[0]}%`);
        paramIndex++;
      } else if (values.length > 1) {
        const orClauses = values.map((v) => {
          const clause = `fc.full_name ILIKE $${paramIndex}`;
          params.push(`%${v}%`);
          paramIndex++;
          return clause;
        });
        conditions.push(`(${orClauses.join(" OR ")})`);
      }
    }

    // Filter by customer ID
    if (query.customerId) {
      conditions.push(`o.customer_id = $${paramIndex}`);
      params.push(query.customerId);
      paramIndex++;
    }

    // Filter by customer name (searches in customers.name)
    // Supports comma-separated values for multi-select
    const customerNameFilter = query.customerName || query.customer;
    if (customerNameFilter) {
      const values = String(customerNameFilter)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 1) {
        conditions.push(`c.name ILIKE $${paramIndex}`);
        params.push(`%${values[0]}%`);
        paramIndex++;
      } else if (values.length > 1) {
        const orClauses = values.map((v) => {
          const clause = `c.name ILIKE $${paramIndex}`;
          params.push(`%${v}%`);
          paramIndex++;
          return clause;
        });
        conditions.push(`(${orClauses.join(" OR ")})`);
      }
    }

    // Filter by brand/saddle ID
    if (query.brandId) {
      conditions.push(`o.saddle_id = $${paramIndex}`);
      params.push(query.brandId);
      paramIndex++;
    }

    // Filter by saddle name (brand - model format)
    // Supports comma-separated values for multi-select
    if (query.saddleName) {
      const saddleValues = String(query.saddleName)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (saddleValues.length === 1) {
        const parts = saddleValues[0].split(" - ");
        if (parts.length >= 2) {
          const brand = parts[0].trim();
          const model = parts.slice(1).join(" - ").trim();
          conditions.push(
            `(s.brand ILIKE $${paramIndex} AND s.model_name ILIKE $${paramIndex + 1})`,
          );
          params.push(`%${brand}%`);
          params.push(`%${model}%`);
          paramIndex += 2;
        } else {
          conditions.push(
            `(s.brand ILIKE $${paramIndex} OR s.model_name ILIKE $${paramIndex})`,
          );
          params.push(`%${saddleValues[0]}%`);
          paramIndex++;
        }
      } else if (saddleValues.length > 1) {
        const orGroups = saddleValues.map((sv) => {
          const parts = sv.split(" - ");
          if (parts.length >= 2) {
            const brand = parts[0].trim();
            const model = parts.slice(1).join(" - ").trim();
            const clause = `(s.brand ILIKE $${paramIndex} AND s.model_name ILIKE $${paramIndex + 1})`;
            params.push(`%${brand}%`);
            params.push(`%${model}%`);
            paramIndex += 2;
            return clause;
          } else {
            const clause = `(s.brand ILIKE $${paramIndex} OR s.model_name ILIKE $${paramIndex})`;
            params.push(`%${sv}%`);
            paramIndex++;
            return clause;
          }
        });
        conditions.push(`(${orGroups.join(" OR ")})`);
      }
    }

    // Filter by order status (supports both integer ID and string name)
    // Supports comma-separated values for multi-select
    const statusFilter = query.orderStatus || query.status;
    if (statusFilter) {
      const statusValues = String(statusFilter)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (statusValues.length === 1) {
        const statusAsNumber = parseInt(statusValues[0], 10);
        if (
          !isNaN(statusAsNumber) &&
          String(statusAsNumber) === statusValues[0]
        ) {
          conditions.push(`o.order_status = $${paramIndex}`);
          params.push(statusAsNumber);
          paramIndex++;
        } else {
          conditions.push(`LOWER(st.name) = LOWER($${paramIndex})`);
          params.push(statusValues[0]);
          paramIndex++;
        }
      } else if (statusValues.length > 1) {
        const allNumeric = statusValues.every(
          (v) => !isNaN(parseInt(v, 10)) && String(parseInt(v, 10)) === v,
        );
        if (allNumeric) {
          conditions.push(`o.order_status = ANY($${paramIndex}::int[])`);
          params.push(statusValues.map((v) => parseInt(v, 10)));
          paramIndex++;
        } else {
          const orClauses = statusValues.map((v) => {
            const clause = `LOWER(st.name) = LOWER($${paramIndex})`;
            params.push(v);
            paramIndex++;
            return clause;
          });
          conditions.push(`(${orClauses.join(" OR ")})`);
        }
      }
    }

    // Filter by factory ID
    if (query.factoryId) {
      conditions.push(`o.factory_id = $${paramIndex}`);
      params.push(query.factoryId);
      paramIndex++;
    }

    // Filter by factory name (searches in credentials.full_name via factories join)
    // Supports comma-separated values for multi-select
    const factoryNameFilter = query.factoryName || query.factory;
    if (factoryNameFilter) {
      const values = String(factoryNameFilter)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 1) {
        conditions.push(`fac.full_name ILIKE $${paramIndex}`);
        params.push(`%${values[0]}%`);
        paramIndex++;
      } else if (values.length > 1) {
        const orClauses = values.map((v) => {
          const clause = `fac.full_name ILIKE $${paramIndex}`;
          params.push(`%${v}%`);
          paramIndex++;
          return clause;
        });
        conditions.push(`(${orClauses.join(" OR ")})`);
      }
    }

    // Filter by repair flag
    if (
      query.repair !== undefined &&
      query.repair !== null &&
      query.repair !== ""
    ) {
      const isRepair =
        query.repair === "true" ||
        query.repair === true ||
        query.repair === "1";
      const isNotRepair =
        query.repair === "false" ||
        query.repair === false ||
        query.repair === "0";

      if (isRepair) {
        conditions.push(`o.repair = $${paramIndex}`);
        params.push(1);
        paramIndex++;
      } else if (isNotRepair) {
        conditions.push(`o.repair = $${paramIndex}`);
        params.push(0);
        paramIndex++;
      }
    }

    // Filter by customer country
    // Supports comma-separated values for multi-select
    if (query.customerCountry) {
      const values = String(query.customerCountry)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 1) {
        conditions.push(`c.country ILIKE $${paramIndex}`);
        params.push(`%${values[0]}%`);
        paramIndex++;
      } else if (values.length > 1) {
        const orClauses = values.map((v) => {
          const clause = `c.country ILIKE $${paramIndex}`;
          params.push(`%${v}%`);
          paramIndex++;
          return clause;
        });
        conditions.push(`(${orClauses.join(" OR ")})`);
      }
    }

    // Filter by seat size (searches multiple sources like the frontend display)
    // Supports comma-separated values for multi-select
    const seatSizeFilter = query.seatSizes || query.seatSize;
    if (seatSizeFilter) {
      const seatSizeValues = String(seatSizeFilter)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      const buildSeatSizeCondition = (size: string): string => {
        const commaSize = size.replace(".", ",");
        const dotSize = size.replace(",", ".");

        const seatSizeConditions = [
          `o.seat_sizes @> $${paramIndex}::jsonb`,
          `o.seat_sizes @> $${paramIndex + 1}::jsonb`,
          `EXISTS (
            SELECT 1 FROM orders_info oi
            JOIN options_items oi2 ON oi.option_item_id = oi2.id
            WHERE oi.order_id = o.id
              AND oi.option_id = 1
              AND (
                REPLACE(oi2.name, '.', ',') = $${paramIndex + 2}
                OR REPLACE(oi2.name, ',', '.') = $${paramIndex + 3}
                OR oi2.name = $${paramIndex + 2}
                OR oi2.name = $${paramIndex + 3}
              )
          )`,
          `o.special_notes ~* $${paramIndex + 4}`,
        ];

        params.push(JSON.stringify([commaSize]));
        params.push(JSON.stringify([dotSize]));
        params.push(commaSize);
        params.push(dotSize);
        params.push(
          `(seat\\s*size[:\\s]*${dotSize.replace(".", "\\.")}|${dotSize.replace(".", "\\.")}\\s*(seat|inch|"))`,
        );
        paramIndex += 5;
        return `(${seatSizeConditions.join(" OR ")})`;
      };

      if (seatSizeValues.length === 1) {
        conditions.push(buildSeatSizeCondition(seatSizeValues[0]));
      } else if (seatSizeValues.length > 1) {
        const orGroups = seatSizeValues.map((sv) => buildSeatSizeCondition(sv));
        conditions.push(`(${orGroups.join(" OR ")})`);
      }
    }

    // Filter by knee roll (option_id = 2) — matches option_items.name via orders_info
    // Supports comma-separated values for multi-select
    if (query.kneeRoll) {
      const krValues = String(query.kneeRoll)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (krValues.length === 1) {
        conditions.push(`EXISTS (
          SELECT 1 FROM orders_info oi
          JOIN options_items oi2 ON oi.option_item_id = oi2.id
          WHERE oi.order_id = o.id
            AND oi.option_id = 2
            AND oi2.name ILIKE $${paramIndex}
        )`);
        params.push(`%${krValues[0]}%`);
        paramIndex++;
      } else if (krValues.length > 1) {
        const orClauses = krValues.map((v) => {
          const clause = `EXISTS (
            SELECT 1 FROM orders_info oi
            JOIN options_items oi2 ON oi.option_item_id = oi2.id
            WHERE oi.order_id = o.id
              AND oi.option_id = 2
              AND oi2.name ILIKE $${paramIndex}
          )`;
          params.push(`%${v}%`);
          paramIndex++;
          return clause;
        });
        conditions.push(`(${orClauses.join(" OR ")})`);
      }
    }

    // Filter by supplier name (alias)
    // Supports comma-separated values for multi-select
    if (query.supplierName) {
      const values = String(query.supplierName)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 1) {
        conditions.push(`fac.full_name ILIKE $${paramIndex}`);
        params.push(`%${values[0]}%`);
        paramIndex++;
      } else if (values.length > 1) {
        const orClauses = values.map((v) => {
          const clause = `fac.full_name ILIKE $${paramIndex}`;
          params.push(`%${v}%`);
          paramIndex++;
          return clause;
        });
        conditions.push(`(${orClauses.join(" OR ")})`);
      }
    }

    // Filter by fitter country
    // Supports comma-separated values for multi-select
    if (query.fitterCountry) {
      const values = String(query.fitterCountry)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 1) {
        conditions.push(`f.country ILIKE $${paramIndex}`);
        params.push(`%${values[0]}%`);
        paramIndex++;
      } else if (values.length > 1) {
        const orClauses = values.map((v) => {
          const clause = `f.country ILIKE $${paramIndex}`;
          params.push(`%${v}%`);
          paramIndex++;
          return clause;
        });
        conditions.push(`(${orClauses.join(" OR ")})`);
      }
    }

    // Filter by sale type (demo, sponsored, urgent, repair, normal)
    // Supports comma-separated values for multi-select
    if (query.saleType) {
      const types = String(query.saleType)
        .split(",")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean);
      const orClauses: string[] = [];
      for (const type of types) {
        if (type === "demo") orClauses.push("o.demo = true");
        else if (type === "sponsored") orClauses.push("o.sponsored = true");
        else if (type === "urgent") orClauses.push("o.rushed = true");
        else if (type === "repair") orClauses.push("o.repair = true");
        else if (type === "normal")
          orClauses.push(
            "(o.demo = false AND o.sponsored = false AND o.rushed = false AND o.repair = false)",
          );
      }
      if (orClauses.length > 0) {
        conditions.push(`(${orClauses.join(" OR ")})`);
      }
    }

    // Filter by leather type name
    // Supports comma-separated values for multi-select
    if (query.leatherType) {
      const ltValues = String(query.leatherType)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (ltValues.length === 1) {
        conditions.push(`lt.name ILIKE $${paramIndex}`);
        params.push(`%${ltValues[0]}%`);
        paramIndex++;
      } else if (ltValues.length > 1) {
        const orClauses = ltValues.map((v) => {
          const clause = `lt.name ILIKE $${paramIndex}`;
          params.push(`%${v}%`);
          paramIndex++;
          return clause;
        });
        conditions.push(`(${orClauses.join(" OR ")})`);
      }
    }

    // Filter by fitter reference
    if (query.fitterReference) {
      conditions.push(`o.fitter_reference ILIKE $${paramIndex}`);
      params.push(`%${query.fitterReference}%`);
      paramIndex++;
    }

    return {
      where: conditions.length > 0 ? conditions.join(" AND ") : "",
      params,
    };
  }

  private buildOrderBy(query: EnrichedOrdersQueryDto): string {
    const orderBy = query.orderBy || "order_time";
    const direction = query.orderDirection || "DESC";

    // Map incoming column names to legacy schema columns
    const columnMap: Record<string, string> = {
      id: "o.id",
      orderId: "o.id",
      created_at: "o.order_time",
      order_time: "o.order_time",
      urgency: "o.rushed",
      customer_name: "c.name",
      fitter_name: "fc.full_name",
      brand_name: "s.brand",
      model_name: "s.model_name",
      status: "o.order_status",
      order_status: "o.order_status",
    };

    const column = columnMap[orderBy] || "o.order_time";
    const dir = direction === "ASC" ? "ASC" : "DESC";

    return `ORDER BY ${column} ${dir}`;
  }

  private generateCacheKey(query: EnrichedOrdersQueryDto): string {
    const keyParts = [
      "enriched_orders",
      `page:${query.page || 1}`,
      `limit:${query.limit || 50}`,
      `partial:${query.partial || false}`,
    ];

    // Include search term in cache key (check both aliases)
    const searchValue = query.searchTerm || query.search;
    if (searchValue) keyParts.push(`search:${searchValue}`);
    if (query.orderBy) keyParts.push(`order:${query.orderBy}`);
    if (query.orderDirection) keyParts.push(`dir:${query.orderDirection}`);
    // Order ID filters
    if (query.id) keyParts.push(`id:${query.id}`);
    if (query.orderId) keyParts.push(`orderId:${query.orderId}`);
    if (query.orderIds) keyParts.push(`orderIds:${query.orderIds}`);
    // Urgency filters
    if (query.urgency) keyParts.push(`urgency:${query.urgency}`);
    if (query.urgent) keyParts.push(`urgent:${query.urgent}`);
    // Fitter filters
    if (query.fitterId) keyParts.push(`fitterId:${query.fitterId}`);
    if (query.fitterName) keyParts.push(`fitterName:${query.fitterName}`);
    if (query.fitter) keyParts.push(`fitter:${query.fitter}`);
    // Customer filters
    if (query.customerId) keyParts.push(`customerId:${query.customerId}`);
    if (query.customerName) keyParts.push(`customerName:${query.customerName}`);
    if (query.customer) keyParts.push(`customer:${query.customer}`);
    // Other filters
    if (query.brandId) keyParts.push(`brand:${query.brandId}`);
    if (query.saddleName) keyParts.push(`saddleName:${query.saddleName}`);
    if (query.orderStatus) keyParts.push(`status:${query.orderStatus}`);
    if (query.status) keyParts.push(`statusAlt:${query.status}`);
    // Factory filters
    if (query.factoryId) keyParts.push(`factoryId:${query.factoryId}`);
    if (query.factoryName) keyParts.push(`factoryName:${query.factoryName}`);
    if (query.factory) keyParts.push(`factory:${query.factory}`);
    // Seat size filters
    if (query.seatSizes) keyParts.push(`seatSizes:${query.seatSizes}`);
    if (query.seatSize) keyParts.push(`seatSize:${query.seatSize}`);
    // Customer country filter
    if (query.customerCountry)
      keyParts.push(`customerCountry:${query.customerCountry}`);
    // Repair filter
    if (
      query.repair !== undefined &&
      query.repair !== null &&
      query.repair !== ""
    )
      keyParts.push(`repair:${query.repair}`);
    // Knee roll filter
    if (query.kneeRoll) keyParts.push(`kneeRoll:${query.kneeRoll}`);
    // Supplier name filter
    if (query.supplierName) keyParts.push(`supplierName:${query.supplierName}`);
    // Fitter country filter
    if (query.fitterCountry)
      keyParts.push(`fitterCountry:${query.fitterCountry}`);
    // Sale type filter
    if (query.saleType) keyParts.push(`saleType:${query.saleType}`);
    if (query.leatherType) keyParts.push(`leatherType:${query.leatherType}`);
    if (query.fitterReference)
      keyParts.push(`fitterReference:${query.fitterReference}`);

    return keyParts.join(":");
  }

  async getOrderDetail(orderId: number): Promise<any> {
    this.logger.log(`Fetching order detail for ID: ${orderId}`);

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('rls.user_id', '0', true)`);

      // Fetch comprehensive order data with all joins
      const orderResult = await queryRunner.query(
        `
        SELECT
          o.id,
          o.id as "orderId",
          to_timestamp(o.order_time) as "orderTime",
          o.rushed as urgent,
          o.special_notes as "specialNotes",
          o.serial_number as "serialNumber",
          o.custom_order as "customOrder",
          o.repair,
          o.demo,
          o.sponsored,
          o.fitter_stock as "fitterStock",
          o.order_step as "orderStep",
          o.currency,
          o.fitter_reference as "fitterReference",
          o.order_data as "orderData",
          o.repair_source_order_id as "repairSourceOrderId",

          -- Order address fields
          o.name as "orderName",
          o.horse_name as "horseName",
          o.address as "orderAddress",
          o.city as "orderCity",
          o.state as "orderState",
          o.zipcode as "orderZipcode",
          o.country as "orderCountry",
          o.phone_no as "orderPhone",
          o.cell_no as "orderCell",
          o.email as "orderEmail",

          -- Shipping fields
          o.ship_name as "shipName",
          o.ship_address as "shipAddress",
          o.ship_city as "shipCity",
          o.ship_state as "shipState",
          o.ship_zipcode as "shipZipcode",
          o.ship_country as "shipCountry",

          -- Pricing fields (stored as cents, divide by 100 for display)
          ROUND(o.price_saddle / 100.0, 2) as "priceSaddle",
          ROUND(o.price_tradein / 100.0, 2) as "priceTradein",
          ROUND(o.price_deposit / 100.0, 2) as "priceDeposit",
          ROUND(o.price_discount / 100.0, 2) as "priceDiscount",
          ROUND(o.price_fittingeval / 100.0, 2) as "priceFittingeval",
          ROUND(o.price_callfee / 100.0, 2) as "priceCallfee",
          ROUND(o.price_girth / 100.0, 2) as "priceGirth",
          ROUND(o.price_shipping / 100.0, 2) as "priceShipping",
          ROUND(o.price_tax / 100.0, 2) as "priceTax",
          ROUND(o.price_additional / 100.0, 2) as "priceAdditional",
          ROUND((COALESCE(o.price_saddle,0) - COALESCE(o.price_tradein,0) - COALESCE(o.price_deposit,0) - COALESCE(o.price_discount,0) +
           COALESCE(o.price_fittingeval,0) + COALESCE(o.price_callfee,0) + COALESCE(o.price_girth,0) +
           COALESCE(o.price_shipping,0) + COALESCE(o.price_tax,0) + COALESCE(o.price_additional,0)) / 100.0, 2) as "totalPrice",

          -- Status
          st.name as "orderStatus",
          o.order_status as "statusId",

          -- Customer fields
          c.id as "customerId",
          c.name as "customerName",
          c.email as "customerEmail",
          c.address as "customerAddress",
          c.city as "customerCity",
          c.state as "customerState",
          c.zipcode as "customerZipcode",
          c.country as "customerCountry",
          c.phone_no as "customerPhone",
          c.cell_no as "customerCell",

          -- Fitter fields
          f.id as "fitterId",
          fc.full_name as "fitterName",
          fc.user_name as "fitterUsername",
          f.emailaddress as "fitterEmail",
          f.address as "fitterAddress",
          f.city as "fitterCity",
          f.state as "fitterState",
          f.zipcode as "fitterZipcode",
          f.country as "fitterCountry",
          f.phone_no as "fitterPhone",
          f.cell_no as "fitterCell",
          f.currency as "fitterCurrency",

          -- Factory fields
          fa.id as "factoryId",
          fac.full_name as "factoryName",
          fac.user_name as "factoryUsername",

          -- Saddle fields
          s.id as "saddleId",
          s.brand as "brandName",
          s.model_name as "modelName",
          s.type as "saddleType",

          -- Leather
          lt.id as "leatherId",
          lt.name as "leatherName",

          -- Repair cross-references: IDs of orders that are repairs of this order
          (SELECT array_agg(r.id) FROM orders r WHERE r.repair_source_order_id = o.id AND r.deleted_at IS NULL) as "repairOrderIds"

        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN fitters f ON o.fitter_id = f.id
        LEFT JOIN credentials fc ON f.user_id = fc.user_id
        LEFT JOIN factories fa ON o.factory_id = fa.id
        LEFT JOIN credentials fac ON fa.user_id = fac.user_id
        LEFT JOIN saddles s ON o.saddle_id = s.id
        LEFT JOIN leather_types lt ON o.leather_id = lt.id
        LEFT JOIN statuses st ON o.order_status = st.id
        WHERE o.id = $1
        `,
        [orderId],
      );

      if (!orderResult || orderResult.length === 0) {
        return null;
      }

      const order = orderResult[0];

      // Map currency integer to currency code
      const currencyMap: Record<number, string> = {
        0: "USD",
        1: "USD",
        2: "EUR",
        3: "GBP",
        4: "AUD",
        5: "CAD",
        6: "CHF",
        7: "DE",
      };
      order.currency = currencyMap[order.currency] || String(order.currency);
      order.fitterCurrency =
        currencyMap[order.fitterCurrency] || String(order.fitterCurrency || "");

      // Fetch saddle specifications from orders_info + options + options_items/leather_types
      // Leather-related option IDs use leather_types for display value
      const leatherOptionIds = [5, 6, 10, 11, 12, 13, 14, 21, 22];
      let saddleSpecs: any[] = [];
      try {
        saddleSpecs = await queryRunner.query(
          `
          SELECT
            oi.option_id as "optionId",
            o.name as "optionName",
            oi.option_item_id as "optionItemId",
            oitm.name as "itemName",
            lt.name as "leatherName",
            oi.custom,
            o.sequence,
            CASE
              WHEN oi.custom IS NOT NULL AND oi.custom != '' THEN oi.custom
              WHEN oi.option_id = ANY($2::int[]) THEN COALESCE(lt.name, oitm.name)
              ELSE oitm.name
            END as "displayValue"
          FROM orders_info oi
          LEFT JOIN options o ON oi.option_id = o.id
          LEFT JOIN options_items oitm ON oi.option_item_id = oitm.id
          LEFT JOIN leather_types lt ON oi.option_item_id = lt.id
            AND oi.option_id = ANY($2::int[])
          WHERE oi.order_id = $1
          ORDER BY o.sequence
          `,
          [orderId, leatherOptionIds],
        );
      } catch (err) {
        this.logger.warn(
          `Failed to fetch saddle specs for order ${orderId}: ${err.message}`,
        );
      }

      // Fetch order history from the legacy log table
      let logEntries: any[] = [];
      try {
        logEntries = await queryRunner.query(
          `
          SELECT
            l.id,
            l.text as content,
            to_timestamp(l.time) as "createdAt",
            cr.full_name as "userName",
            l.user_type as "userType",
            l.only_for as "onlyFor"
          FROM log l
          LEFT JOIN credentials cr ON l.user_id = cr.user_id
          WHERE l.order_id = $1
          ORDER BY l.time DESC
          `,
          [orderId],
        );
      } catch (err) {
        this.logger.warn(
          `Failed to fetch log entries for order ${orderId}: ${err.message}`,
        );
      }

      // Also try the comment table (newer NestJS comments)
      let commentsResult: any[] = [];
      try {
        commentsResult = await queryRunner.query(
          `
          SELECT
            cm.id,
            cm.content,
            cm.type,
            cm.is_internal as "isInternal",
            cm.created_at as "createdAt",
            cm.updated_at as "updatedAt",
            cr.full_name as "userName"
          FROM comment cm
          LEFT JOIN credentials cr ON cm.user_id = cr.user_id
          WHERE cm.order_id = $1
          AND cm.deleted_at IS NULL
          ORDER BY cm.created_at DESC
          `,
          [orderId],
        );
      } catch (err) {
        this.logger.warn(
          `Failed to fetch comments for order ${orderId}: ${err.message}`,
        );
      }

      return {
        ...order,
        saddleSpecs: saddleSpecs || [],
        comments: commentsResult || [],
        logEntries: logEntries || [],
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch order detail for ID ${orderId}`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getEditFormOptions(
    saddleId?: number,
  ): Promise<Record<string, unknown[]>> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('rls.user_id', '0', true)`);

      const fitters = await queryRunner.query(`
        SELECT f.id, c.user_name as "username", c.full_name as "fullName"
        FROM fitters f
        LEFT JOIN credentials c ON f.user_id = c.user_id AND c.user_type = 1
        WHERE f.deleted = 0
        ORDER BY c.full_name
      `);

      const saddles = await queryRunner.query(`
        SELECT s.id, s.brand, s.model_name as "modelName",
          CONCAT(s.brand, ' ', s.model_name) as "displayName"
        FROM saddles s
        WHERE s.active = 1 AND s.deleted = 0
        ORDER BY s.brand, s.model_name
      `);

      const leatherTypes = await queryRunner.query(`
        SELECT id, name, 0 as "price1" FROM leather_types
        WHERE deleted = 0
        ORDER BY name
      `);

      let options: unknown[];
      let optionItems: unknown[];

      if (saddleId) {
        options = await queryRunner.query(
          `
          SELECT DISTINCT o.id as "optionId", o.name as "optionName", o.sequence, o."group", o.type, o.price1
          FROM options o
          INNER JOIN saddle_options_items soi ON soi.option_id = o.id
          WHERE soi.saddle_id = $1 AND soi.deleted = 0
          ORDER BY o.sequence
        `,
          [saddleId],
        );

        // Return ALL items for options relevant to this saddle (full lists for seat size, etc.)
        optionItems = await queryRunner.query(
          `
          SELECT oi.id, oi.name, oi.option_id as "optionId", oi.price1
          FROM options_items oi
          WHERE oi.option_id IN (
            SELECT DISTINCT soi.option_id
            FROM saddle_options_items soi
            WHERE soi.saddle_id = $1 AND soi.deleted = 0
          )
          ORDER BY oi.option_id, oi.name
        `,
          [saddleId],
        );
      } else {
        options = await queryRunner.query(`
          SELECT o.id as "optionId", o.name as "optionName", o.sequence, o."group", o.type, o.price1
          FROM options o
          ORDER BY o.sequence
        `);

        optionItems = await queryRunner.query(`
          SELECT oi.id, oi.name, oi.option_id as "optionId", oi.price1
          FROM options_items oi
          ORDER BY oi.option_id, oi.name
        `);
      }

      const statuses = await queryRunner.query(`
        SELECT id, name FROM statuses ORDER BY id
      `);

      // PRESETS - filtered by saddle if saddleId provided
      let presets: unknown[] = [];
      let presetItems: unknown[] = [];

      if (saddleId) {
        // Get the saddle's presets column (comma-separated preset IDs)
        const saddleRow = await queryRunner.query(
          `SELECT presets FROM saddles WHERE id = $1`,
          [saddleId],
        );
        const presetsStr = saddleRow.length > 0 ? saddleRow[0].presets : "";
        const presetIds = presetsStr
          ? presetsStr
              .split(",")
              .map((s: string) => parseInt(s.trim(), 10))
              .filter((n: number) => !isNaN(n) && n > 0)
          : [];

        if (presetIds.length > 0) {
          presets = await queryRunner.query(
            `SELECT id, name, sequence FROM presets
             WHERE id = ANY($1) AND deleted = 0
             ORDER BY sequence, name`,
            [presetIds],
          );

          presetItems = await queryRunner.query(
            `SELECT preset_id as "presetId", options_id as "optionId", item_id as "itemId"
             FROM presets_items
             WHERE preset_id = ANY($1)`,
            [presetIds],
          );
        } else {
          // Saddle has no preset mapping — fall back to ALL active presets
          presets = await queryRunner.query(`
            SELECT id, name, sequence FROM presets
            WHERE deleted = 0
            ORDER BY sequence, name
          `);

          presetItems = await queryRunner.query(`
            SELECT preset_id as "presetId", options_id as "optionId", item_id as "itemId"
            FROM presets_items
          `);
        }
      } else {
        presets = await queryRunner.query(`
          SELECT id, name, sequence FROM presets
          WHERE deleted = 0
          ORDER BY sequence, name
        `);

        presetItems = await queryRunner.query(`
          SELECT preset_id as "presetId", options_id as "optionId", item_id as "itemId"
          FROM presets_items
        `);
      }

      return {
        fitters,
        saddles,
        leatherTypes,
        options,
        optionItems,
        statuses,
        presets,
        presetItems,
      };
    } catch (error) {
      this.logger.error("Failed to fetch edit form options", error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateOrderStatus(orderId: number, statusName: string): Promise<any> {
    this.logger.log(`Updating order ${orderId} status to: ${statusName}`);

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('rls.user_id', '0', true)`);

      // Look up the status ID from the statuses table
      const statusResult = await queryRunner.query(
        `SELECT id FROM statuses WHERE name = $1`,
        [statusName],
      );

      if (!statusResult || statusResult.length === 0) {
        throw new Error(`Unknown status: ${statusName}`);
      }

      const statusId = statusResult[0].id;

      // Get the old status before updating
      const oldStatusResult = await queryRunner.query(
        `SELECT order_status, fitter_id FROM orders WHERE id = $1`,
        [orderId],
      );

      if (!oldStatusResult || oldStatusResult.length === 0) {
        throw new Error(`Order ${orderId} not found`);
      }

      const oldStatusId = oldStatusResult[0].order_status;
      const fitterId = oldStatusResult[0].fitter_id;

      // Update the order's status
      await queryRunner.query(
        `UPDATE orders SET order_status = $1 WHERE id = $2`,
        [statusId, orderId],
      );

      // Log the status change
      try {
        await queryRunner.query(
          `INSERT INTO log (user_id, user_type, only_for, order_id, text, time, order_status_updated_from, order_status_updated_to)
           VALUES ($1, 2, 0, $2, $3, EXTRACT(EPOCH FROM NOW())::integer, $4, $5)`,
          [
            fitterId || 0,
            orderId,
            `Changed the order status to '${statusName}'`,
            oldStatusId,
            statusId,
          ],
        );
      } catch (logErr) {
        this.logger.warn(`Failed to log status change: ${logErr.message}`);
      }

      this.logger.log(
        `Successfully updated order ${orderId} to status ${statusName} (id: ${statusId})`,
      );

      await this.invalidateCache();

      return {
        success: true,
        orderId,
        status: statusName,
        statusId,
      };
    } catch (error) {
      this.logger.error(`Failed to update order status for ${orderId}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async bulkUpdateOrderStatus(
    orderIds: number[],
    statusName: string,
  ): Promise<{
    success: boolean;
    updated: number;
    failed: number;
    results: Array<{ orderId: number; success: boolean; error?: string }>;
  }> {
    this.logger.log(
      `Bulk updating ${orderIds.length} orders to status: ${statusName}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    const results: Array<{
      orderId: number;
      success: boolean;
      error?: string;
    }> = [];

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      await queryRunner.query(`SELECT set_config('rls.user_id', '0', true)`);

      // Look up the status ID from the statuses table
      const statusResult = await queryRunner.query(
        `SELECT id FROM statuses WHERE name = $1`,
        [statusName],
      );

      if (!statusResult || statusResult.length === 0) {
        throw new Error(`Unknown status: ${statusName}`);
      }

      const statusId = statusResult[0].id;

      for (const orderId of orderIds) {
        try {
          // Get the old status before updating
          const oldStatusResult = await queryRunner.query(
            `SELECT order_status, fitter_id FROM orders WHERE id = $1`,
            [orderId],
          );

          if (!oldStatusResult || oldStatusResult.length === 0) {
            results.push({
              orderId,
              success: false,
              error: `Order ${orderId} not found`,
            });
            continue;
          }

          const oldStatusId = oldStatusResult[0].order_status;
          const fitterId = oldStatusResult[0].fitter_id;

          // Update the order's status
          await queryRunner.query(
            `UPDATE orders SET order_status = $1 WHERE id = $2`,
            [statusId, orderId],
          );

          // Log the status change
          try {
            await queryRunner.query(
              `INSERT INTO log (user_id, user_type, only_for, order_id, text, time, order_status_updated_from, order_status_updated_to)
               VALUES ($1, 2, 0, $2, $3, EXTRACT(EPOCH FROM NOW())::integer, $4, $5)`,
              [
                fitterId || 0,
                orderId,
                `Changed the order status to '${statusName}' (bulk update)`,
                oldStatusId,
                statusId,
              ],
            );
          } catch (logErr) {
            this.logger.warn(
              `Failed to log status change for order ${orderId}: ${logErr.message}`,
            );
          }

          results.push({ orderId, success: true });
        } catch (err) {
          results.push({
            orderId,
            success: false,
            error: err.message,
          });
        }
      }

      await queryRunner.commitTransaction();

      await this.invalidateCache();

      const updated = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      this.logger.log(
        `Bulk update complete: ${updated} updated, ${failed} failed`,
      );

      return { success: failed === 0, updated, failed, results };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error("Failed to bulk update order statuses", error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateOrder(
    orderId: number,
    dto: UpdateOrderDto,
    userId?: number,
    userRoleId?: number,
  ): Promise<{ success: boolean; orderId: number }> {
    this.logger.log(`Updating order ${orderId}`);

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      await queryRunner.query(`SELECT set_config('rls.user_id', '0', true)`);

      // Verify order exists and get old status for audit
      const existing = await queryRunner.query(
        `SELECT order_status, fitter_id FROM orders WHERE id = $1`,
        [orderId],
      );
      if (!existing || existing.length === 0) {
        throw new Error(`Order ${orderId} not found`);
      }
      const oldStatusId = existing[0].order_status;
      const existingFitterId = existing[0].fitter_id;

      // Fitter role-based status restriction
      if (
        userRoleId === FITTER_ROLE_ID &&
        FITTER_RESTRICTED_STATUS_IDS.includes(oldStatusId)
      ) {
        const statusNameResult = await queryRunner.query(
          `SELECT name FROM statuses WHERE id = $1`,
          [oldStatusId],
        );
        const statusName = statusNameResult?.[0]?.name || `ID ${oldStatusId}`;
        throw new ForbiddenException(
          `Fitters cannot edit orders with status: ${statusName}`,
        );
      }

      // Resolve status name to integer ID if provided
      let statusId: number | undefined;
      if (dto.orderStatus) {
        const statusResult = await queryRunner.query(
          `SELECT id FROM statuses WHERE name = $1`,
          [dto.orderStatus],
        );
        if (!statusResult || statusResult.length === 0) {
          throw new Error(`Unknown status: ${dto.orderStatus}`);
        }
        statusId = statusResult[0].id;
      }

      // Convert dollar prices to cents
      const toCents = (val: number | undefined): number | undefined =>
        val !== undefined ? Math.round(val * 100) : undefined;

      // Build SET clause dynamically
      const setClauses: string[] = [];
      const setParams: unknown[] = [];
      let paramIdx = 1;

      const addField = (column: string, value: unknown) => {
        if (value !== undefined) {
          setClauses.push(`${column} = $${paramIdx}`);
          setParams.push(value);
          paramIdx++;
        }
      };

      addField("fitter_id", dto.fitterId);
      addField("saddle_id", dto.saddleId);
      addField("leather_id", dto.leatherId);
      addField(
        "fitter_stock",
        dto.fitterStock !== undefined ? (dto.fitterStock ? 1 : 0) : undefined,
      );
      addField("demo", dto.demo !== undefined ? (dto.demo ? 1 : 0) : undefined);
      addField(
        "repair",
        dto.repair !== undefined ? (dto.repair ? 1 : 0) : undefined,
      );
      addField(
        "rushed",
        dto.rushed !== undefined ? (dto.rushed ? 1 : 0) : undefined,
      );
      addField(
        "sponsored",
        dto.sponsored !== undefined ? (dto.sponsored ? 1 : 0) : undefined,
      );
      addField(
        "custom_order",
        dto.customOrder !== undefined ? (dto.customOrder ? 1 : 0) : undefined,
      );
      addField("special_notes", dto.specialNotes);
      addField("horse_name", dto.horseName);

      // Customer fields on orders table
      addField("name", dto.customerName);
      addField("email", dto.customerEmail);
      addField("address", dto.customerAddress);
      addField("city", dto.customerCity);
      addField("state", dto.customerState);
      addField("zipcode", dto.customerZipcode);
      addField("country", dto.customerCountry);
      addField("phone_no", dto.customerPhone);
      addField("cell_no", dto.customerCell);
      addField("customer_id", dto.customerId);

      // Shipping fields
      addField("ship_name", dto.shipName);
      addField("ship_address", dto.shipAddress);
      addField("ship_city", dto.shipCity);
      addField("ship_state", dto.shipState);
      addField("ship_zipcode", dto.shipZipcode);
      addField("ship_country", dto.shipCountry);

      // Order reference
      addField("fitter_reference", dto.orderReference);

      // Status
      addField("order_status", statusId);

      // Pricing (cents)
      addField("price_saddle", toCents(dto.priceSaddle));
      addField("price_tradein", toCents(dto.priceTradein));
      addField("price_deposit", toCents(dto.priceDeposit));
      addField("price_discount", toCents(dto.priceDiscount));
      addField("price_fittingeval", toCents(dto.priceFittingeval));
      addField("price_callfee", toCents(dto.priceCallfee));
      addField("price_girth", toCents(dto.priceGirth));
      addField("price_shipping", toCents(dto.priceShipping));
      addField("price_tax", toCents(dto.priceTax));
      addField("price_additional", toCents(dto.priceAdditional));

      // Repair source order linking
      addField("repair_source_order_id", dto.repairSourceOrderId);

      // Seat sizes
      if (dto.seatSizes !== undefined) {
        addField(
          "seat_sizes",
          dto.seatSizes && dto.seatSizes.length > 0
            ? JSON.stringify(dto.seatSizes)
            : null,
        );
      }

      // Always update changed timestamp
      setClauses.push(`changed = EXTRACT(EPOCH FROM NOW())::integer`);

      if (setClauses.length > 0) {
        const updateSql = `UPDATE orders SET ${setClauses.join(", ")} WHERE id = $${paramIdx}`;
        setParams.push(orderId);
        await queryRunner.query(updateSql, setParams);
      }

      // Replace saddle options (orders_info) if provided
      if (dto.saddleOptions && dto.saddleOptions.length > 0) {
        await queryRunner.query(`DELETE FROM orders_info WHERE order_id = $1`, [
          orderId,
        ]);
        for (const opt of dto.saddleOptions) {
          await queryRunner.query(
            `INSERT INTO orders_info (order_id, option_id, option_item_id, clone_number, color, leathertype, custom)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              orderId,
              opt.optionId,
              opt.optionItemId,
              0,
              "",
              "",
              opt.custom || "",
            ],
          );
        }

        // Sync seat_sizes JSONB column from seat size option (option_id = 1)
        const seatSizeOpt = dto.saddleOptions.find((o) => o.optionId === 1);
        if (seatSizeOpt) {
          const seatSizeName = await queryRunner.query(
            `SELECT name FROM options_items WHERE id = $1`,
            [seatSizeOpt.optionItemId],
          );
          if (seatSizeName.length > 0) {
            await queryRunner.query(
              `UPDATE orders SET seat_sizes = $1 WHERE id = $2`,
              [JSON.stringify([seatSizeName[0].name]), orderId],
            );
          }
        }
      }

      // Insert audit log entry
      try {
        const logText =
          statusId && statusId !== oldStatusId
            ? `Order updated. Status changed to '${dto.orderStatus}'.`
            : `Order updated.`;
        await queryRunner.query(
          `INSERT INTO log (user_id, user_type, only_for, order_id, text, time, order_status_updated_from, order_status_updated_to)
           VALUES ($1, 2, 0, $2, $3, EXTRACT(EPOCH FROM NOW())::integer, $4, $5)`,
          [
            userId || dto.fitterId || existingFitterId || 0,
            orderId,
            logText,
            oldStatusId,
            statusId || oldStatusId,
          ],
        );
      } catch (logErr) {
        this.logger.warn(
          `Failed to log order update for ${orderId}: ${logErr.message}`,
        );
      }

      await queryRunner.commitTransaction();
      await this.invalidateCache();

      this.logger.log(`Successfully updated order ${orderId}`);
      return { success: true, orderId };
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch (rbErr) {
        this.logger.warn(`Rollback failed: ${rbErr.message}`);
      }
      this.logger.error(`Failed to update order ${orderId}`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createOrder(
    dto: UpdateOrderDto,
    userId?: number,
  ): Promise<{ success: boolean; orderId: number }> {
    this.logger.log("Creating new order");

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      await queryRunner.query(`SELECT set_config('rls.user_id', '0', true)`);

      // Resolve status name to integer ID
      let statusId = 0; // Default: Unordered
      if (dto.orderStatus) {
        const statusResult = await queryRunner.query(
          `SELECT id FROM statuses WHERE name = $1`,
          [dto.orderStatus],
        );
        if (statusResult && statusResult.length > 0) {
          statusId = statusResult[0].id;
        }
      }

      // Convert dollar prices to cents
      const toCents = (val: number | undefined): number =>
        val !== undefined ? Math.round(val * 100) : 0;

      const orderTime = Math.floor(Date.now() / 1000);

      const result = await queryRunner.query(
        `INSERT INTO orders (
          fitter_id, saddle_id, leather_id, factory_id,
          fitter_stock, customer_id, fitter_reference,
          horse_name, name, address, zipcode, city, state, country,
          phone_no, cell_no, email,
          order_status, ship_name, ship_address, ship_zipcode,
          ship_city, ship_state, ship_country,
          order_time, payment, payment_time, order_step,
          price_saddle, price_tradein, price_deposit, price_discount,
          price_fittingeval, price_callfee, price_girth,
          price_shipping, price_tax, price_additional,
          special_notes, serial_number, custom_order, changed,
          repair, demo, sponsored, rushed,
          oms_version, currency, order_data,
          repair_source_order_id, seat_sizes
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17,
          $18, $19, $20, $21,
          $22, $23, $24,
          $25, $26, $27, $28,
          $29, $30, $31, $32,
          $33, $34, $35,
          $36, $37, $38,
          $39, $40, $41, $42,
          $43, $44, $45, $46,
          $47, $48, $49,
          $50, $51
        ) RETURNING id`,
        [
          dto.fitterId || 0,
          dto.saddleId || 0,
          dto.leatherId || 0,
          0, // factory_id
          dto.fitterStock ? 1 : 0,
          dto.customerId || 0,
          dto.orderReference || "",
          dto.horseName || "",
          dto.customerName || "",
          dto.customerAddress || "",
          dto.customerZipcode || "",
          dto.customerCity || "",
          dto.customerState || "",
          dto.customerCountry || "",
          dto.customerPhone || "",
          dto.customerCell || "",
          dto.customerEmail || "",
          statusId,
          dto.shipName || "",
          dto.shipAddress || "",
          dto.shipZipcode || "",
          dto.shipCity || "",
          dto.shipState || "",
          dto.shipCountry || "",
          orderTime,
          "", // payment
          0, // payment_time
          1, // order_step
          toCents(dto.priceSaddle),
          toCents(dto.priceTradein),
          toCents(dto.priceDeposit),
          toCents(dto.priceDiscount),
          toCents(dto.priceFittingeval),
          toCents(dto.priceCallfee),
          toCents(dto.priceGirth),
          toCents(dto.priceShipping),
          toCents(dto.priceTax),
          toCents(dto.priceAdditional),
          dto.specialNotes || "",
          "", // serial_number
          dto.customOrder ? 1 : 0,
          0, // changed
          dto.repair ? 1 : 0,
          dto.demo ? 1 : 0,
          dto.sponsored ? 1 : 0,
          dto.rushed ? 1 : 0,
          2, // oms_version
          0, // currency (will use fitter's currency)
          "", // order_data
          dto.repairSourceOrderId || null,
          dto.seatSizes && dto.seatSizes.length > 0
            ? JSON.stringify(dto.seatSizes)
            : null,
        ],
      );

      const newOrderId = result[0].id;

      // Insert saddle options (orders_info) if provided
      if (dto.saddleOptions && dto.saddleOptions.length > 0) {
        for (const opt of dto.saddleOptions) {
          await queryRunner.query(
            `INSERT INTO orders_info (order_id, option_id, option_item_id, clone_number, color, leathertype, custom)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              newOrderId,
              opt.optionId,
              opt.optionItemId,
              0,
              "",
              "",
              opt.custom || "",
            ],
          );
        }

        // Populate seat_sizes JSONB column from seat size option (option_id = 1)
        const seatSizeOpt = dto.saddleOptions.find((o) => o.optionId === 1);
        if (seatSizeOpt) {
          const seatSizeName = await queryRunner.query(
            `SELECT name FROM options_items WHERE id = $1`,
            [seatSizeOpt.optionItemId],
          );
          if (seatSizeName.length > 0) {
            await queryRunner.query(
              `UPDATE orders SET seat_sizes = $1 WHERE id = $2`,
              [JSON.stringify([seatSizeName[0].name]), newOrderId],
            );
          }
        }
      }

      // Insert audit log entry
      try {
        await queryRunner.query(
          `INSERT INTO log (user_id, user_type, only_for, order_id, text, time, order_status_updated_from, order_status_updated_to)
           VALUES ($1, 2, 0, $2, $3, EXTRACT(EPOCH FROM NOW())::integer, 0, $4)`,
          [userId || dto.fitterId || 0, newOrderId, "Order created.", statusId],
        );
      } catch (logErr) {
        this.logger.warn(
          `Failed to log order creation for ${newOrderId}: ${logErr.message}`,
        );
      }

      await queryRunner.commitTransaction();
      await this.invalidateCache();

      this.logger.log(`Successfully created order ${newOrderId}`);
      return { success: true, orderId: newOrderId };
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch (rbErr) {
        this.logger.warn(`Rollback failed: ${rbErr.message}`);
      }
      this.logger.error("Failed to create order", error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createDraftFromOrder(
    sourceOrderId: number,
    userId?: number,
  ): Promise<{ success: boolean; orderId: number }> {
    this.logger.log(`Creating draft order from source order ${sourceOrderId}`);

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      await queryRunner.query(`SELECT set_config('rls.user_id', '0', true)`);

      // Copy the source order into a new row with Unordered status (0)
      const result = await queryRunner.query(
        `INSERT INTO orders (
          fitter_id, saddle_id, leather_id, factory_id,
          fitter_stock, customer_id, fitter_reference,
          horse_name, name, address, zipcode, city, state, country,
          phone_no, cell_no, email,
          order_status, ship_name, ship_address, ship_zipcode,
          ship_city, ship_state, ship_country,
          order_time, payment, payment_time, order_step,
          price_saddle, price_tradein, price_deposit, price_discount,
          price_fittingeval, price_callfee, price_girth,
          price_shipping, price_tax, price_additional,
          special_notes, serial_number, custom_order, changed,
          repair, demo, sponsored, rushed,
          oms_version, currency, order_data, seat_sizes
        )
        SELECT
          fitter_id, saddle_id, leather_id, factory_id,
          fitter_stock, customer_id, '',
          horse_name, name, address, zipcode, city, state, country,
          phone_no, cell_no, email,
          0, ship_name, ship_address, ship_zipcode,
          ship_city, ship_state, ship_country,
          EXTRACT(EPOCH FROM NOW())::integer, '', 0, 1,
          price_saddle, 0, 0, 0,
          0, 0, 0,
          0, 0, 0,
          special_notes, '', custom_order, 0,
          repair, demo, sponsored, rushed,
          2, currency, '', seat_sizes
        FROM orders WHERE id = $1
        RETURNING id`,
        [sourceOrderId],
      );

      if (!result || result.length === 0) {
        throw new Error(`Source order ${sourceOrderId} not found`);
      }

      const newOrderId = result[0].id;

      // Copy saddle options from the source order
      await queryRunner.query(
        `INSERT INTO orders_info (order_id, option_id, option_item_id, clone_number, color, leathertype, custom)
         SELECT $1, option_id, option_item_id, clone_number, color, leathertype, custom
         FROM orders_info WHERE order_id = $2`,
        [newOrderId, sourceOrderId],
      );

      // Insert audit log entry
      try {
        await queryRunner.query(
          `INSERT INTO log (user_id, user_type, only_for, order_id, text, time, order_status_updated_from, order_status_updated_to)
           VALUES ($1, 2, 0, $2, $3, EXTRACT(EPOCH FROM NOW())::integer, 0, 0)`,
          [
            userId || 0,
            newOrderId,
            `Draft created from order #${sourceOrderId}.`,
          ],
        );
      } catch (logErr) {
        this.logger.warn(
          `Failed to log draft creation for ${newOrderId}: ${logErr.message}`,
        );
      }

      await queryRunner.commitTransaction();
      await this.invalidateCache();

      this.logger.log(
        `Successfully created draft order ${newOrderId} from source ${sourceOrderId}`,
      );
      return { success: true, orderId: newOrderId };
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch (rbErr) {
        this.logger.warn(`Rollback failed: ${rbErr.message}`);
      }
      this.logger.error(
        `Failed to create draft from order ${sourceOrderId}`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getBatchSaddleSpecs(
    orderIds: number[],
  ): Promise<Record<number, SaddleSpecResult[]>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const leatherOptionIds = [5, 6, 10, 11, 12, 13, 14, 21, 22];
      const rows: SaddleSpecRow[] = await queryRunner.query(
        `
        SELECT
          oi.order_id as "orderId",
          oi.option_id as "optionId",
          o.name as "optionName",
          CASE
            WHEN oi.custom IS NOT NULL AND oi.custom != '' THEN oi.custom
            WHEN oi.option_id = ANY($2::int[]) THEN COALESCE(lt.name, oitm.name)
            ELSE oitm.name
          END as "displayValue"
        FROM orders_info oi
        LEFT JOIN options o ON oi.option_id = o.id
        LEFT JOIN options_items oitm ON oi.option_item_id = oitm.id
        LEFT JOIN leather_types lt ON oi.option_item_id = lt.id
          AND oi.option_id = ANY($2::int[])
        WHERE oi.order_id = ANY($1::int[])
        ORDER BY oi.order_id, o.sequence
        `,
        [orderIds, leatherOptionIds],
      );

      const result: Record<number, SaddleSpecResult[]> = {};
      for (const row of rows) {
        const oid = row.orderId;
        if (!result[oid]) result[oid] = [];
        result[oid].push({
          optionId: row.optionId,
          optionName: row.optionName,
          displayValue: row.displayValue,
        });
      }

      return result;
    } catch (error) {
      this.logger.error("Failed to fetch batch saddle specs", error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async invalidateCache(): Promise<void> {
    try {
      await this.cacheManager.clear();
      this.logger.debug("Cleared all enriched orders cache");
    } catch (error) {
      this.logger.warn("Failed to invalidate cache", error);
    }
  }
}
