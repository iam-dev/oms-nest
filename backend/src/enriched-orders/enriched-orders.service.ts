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

      if (isCacheEnabled) {
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

      if (isCacheEnabled) {
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
        o.repair
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN fitters f ON o.fitter_id = f.id
      LEFT JOIN credentials fc ON f.user_id = fc.user_id
      LEFT JOIN saddles s ON o.saddle_id = s.id
      LEFT JOIN factories fa ON o.factory_id = fa.id
      LEFT JOIN credentials fac ON fa.user_id = fac.user_id
      LEFT JOIN statuses st ON o.order_status = st.id
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
      LEFT JOIN statuses st ON o.order_status = st.id`;

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
    const searchTermValue = query.searchTerm || query.search;
    if (searchTermValue) {
      conditions.push(`(
        o.name ILIKE $${paramIndex} OR
        o.special_notes ILIKE $${paramIndex} OR
        o.horse_name ILIKE $${paramIndex} OR
        c.name ILIKE $${paramIndex} OR
        fc.full_name ILIKE $${paramIndex} OR
        fac.full_name ILIKE $${paramIndex} OR
        s.brand ILIKE $${paramIndex} OR
        s.model_name ILIKE $${paramIndex}
      )`);
      params.push(`%${searchTermValue}%`);
      paramIndex++;
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

    // Filter by fitter ID
    if (query.fitterId) {
      conditions.push(`o.fitter_id = $${paramIndex}`);
      params.push(query.fitterId);
      paramIndex++;
    }

    // Filter by fitter name (searches in credentials.full_name via fitters join)
    const fitterNameFilter = query.fitterName || query.fitter;
    if (fitterNameFilter) {
      conditions.push(`fc.full_name ILIKE $${paramIndex}`);
      params.push(`%${fitterNameFilter}%`);
      paramIndex++;
    }

    // Filter by customer ID
    if (query.customerId) {
      conditions.push(`o.customer_id = $${paramIndex}`);
      params.push(query.customerId);
      paramIndex++;
    }

    // Filter by customer name (searches in customers.name)
    const customerNameFilter = query.customerName || query.customer;
    if (customerNameFilter) {
      conditions.push(`c.name ILIKE $${paramIndex}`);
      params.push(`%${customerNameFilter}%`);
      paramIndex++;
    }

    // Filter by brand/saddle ID
    if (query.brandId) {
      conditions.push(`o.saddle_id = $${paramIndex}`);
      params.push(query.brandId);
      paramIndex++;
    }

    // Filter by saddle name (brand - model format)
    if (query.saddleName) {
      const parts = query.saddleName.split(" - ");
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
        params.push(`%${query.saddleName}%`);
        paramIndex++;
      }
    }

    // Filter by order status (supports both integer ID and string name)
    const statusFilter = query.orderStatus || query.status;
    if (statusFilter) {
      // Check if it's a numeric ID or a string name
      const statusAsNumber = parseInt(String(statusFilter), 10);
      if (
        !isNaN(statusAsNumber) &&
        String(statusAsNumber) === String(statusFilter)
      ) {
        // Numeric status ID - filter directly on order_status column
        conditions.push(`o.order_status = $${paramIndex}`);
        params.push(statusAsNumber);
        paramIndex++;
      } else {
        // String status name - filter on statuses.name (case-insensitive)
        conditions.push(`LOWER(st.name) = LOWER($${paramIndex})`);
        params.push(statusFilter);
        paramIndex++;
      }
    }

    // Filter by factory ID
    if (query.factoryId) {
      conditions.push(`o.factory_id = $${paramIndex}`);
      params.push(query.factoryId);
      paramIndex++;
    }

    // Filter by factory name (searches in credentials.full_name via factories join)
    const factoryNameFilter = query.factoryName || query.factory;
    if (factoryNameFilter) {
      conditions.push(`fac.full_name ILIKE $${paramIndex}`);
      params.push(`%${factoryNameFilter}%`);
      paramIndex++;
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
    if (query.customerCountry) {
      conditions.push(`c.country ILIKE $${paramIndex}`);
      params.push(`%${query.customerCountry}%`);
      paramIndex++;
    }

    // Filter by seat size (searches multiple sources like the frontend display)
    const seatSizeFilter = query.seatSizes || query.seatSize;
    if (seatSizeFilter) {
      // Normalize: accept both dot (17.5) and comma (17,5) notation
      const commaSize = String(seatSizeFilter).replace(".", ",");
      const dotSize = String(seatSizeFilter).replace(",", ".");

      // Build a comprehensive search condition that checks:
      // 1. seat_sizes JSONB column (primary source, if populated)
      // 2. orders_info table with options_items (authoritative source for seat sizes)
      // 3. special_notes field (fallback - searches for patterns like "seat size 18")
      // 4. order_data JSONB for seatSize fields
      const seatSizeConditions = [
        // Check seat_sizes JSONB array (both notations)
        `o.seat_sizes @> $${paramIndex}::jsonb`,
        `o.seat_sizes @> $${paramIndex + 1}::jsonb`,
        // Check orders_info table directly (option_id = 1 is "Seat Size")
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
        // Check special_notes for seat size patterns (case-insensitive)
        `o.special_notes ~* $${paramIndex + 4}`,
      ];

      conditions.push(`(${seatSizeConditions.join(" OR ")})`);
      params.push(JSON.stringify([commaSize])); // For JSONB @> with comma
      params.push(JSON.stringify([dotSize])); // For JSONB @> with dot
      params.push(commaSize); // For orders_info comparison (comma notation)
      params.push(dotSize); // For orders_info comparison (dot notation)
      // Regex pattern to match seat size in special_notes (e.g., "seat size 18", "18 seat", "18"")
      params.push(
        `(seat\\s*size[:\\s]*${dotSize.replace(".", "\\.")}|${dotSize.replace(".", "\\.")}\\s*(seat|inch|"))`,
      );
      paramIndex += 5;
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
          lt.name as "leatherName"

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
              WHEN oi.option_id = ANY($2::int[]) THEN COALESCE(lt.name, oitm.name)
              WHEN oi.custom != '' THEN oi.custom
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

  async getEditFormOptions(): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.query(`SELECT set_config('rls.user_id', '0', true)`);

      // Fetch available fitters
      const fitters = await queryRunner.query(`
        SELECT f.id, c.user_name as "username", c.full_name as "fullName"
        FROM fitters f
        LEFT JOIN credentials c ON f.user_id = c.user_id AND c.user_type = 1
        WHERE f.deleted = 0
        ORDER BY c.full_name
      `);

      // Fetch available saddle models (brand + model)
      const saddles = await queryRunner.query(`
        SELECT s.id, s.brand, s.model_name as "modelName",
          CONCAT(s.brand, ' ', s.model_name) as "displayName"
        FROM saddles s
        WHERE s.active = 1 AND s.deleted = 0
        ORDER BY s.brand, s.model_name
      `);

      // Fetch available leather types
      const leatherTypes = await queryRunner.query(`
        SELECT id, name FROM leather_types
        WHERE deleted = 0
        ORDER BY name
      `);

      // Fetch all options with their items
      const options = await queryRunner.query(`
        SELECT o.id as "optionId", o.name as "optionName", o.sequence, o."group"
        FROM options o
        ORDER BY o.sequence
      `);

      const optionItems = await queryRunner.query(`
        SELECT oi.id, oi.name, oi.option_id as "optionId"
        FROM options_items oi
        ORDER BY oi.option_id, oi.name
      `);

      // Fetch all statuses
      const statuses = await queryRunner.query(`
        SELECT id, name FROM statuses ORDER BY id
      `);

      return {
        fitters,
        saddles,
        leatherTypes,
        options,
        optionItems,
        statuses,
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
            `INSERT INTO orders_info (order_id, option_id, option_item_id, custom)
             VALUES ($1, $2, $3, $4)`,
            [orderId, opt.optionId, opt.optionItemId, opt.custom || ""],
          );
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

  async invalidateCache(): Promise<void> {
    try {
      await this.cacheManager.clear();
      this.logger.debug("Cleared all enriched orders cache");
    } catch (error) {
      this.logger.warn("Failed to invalidate cache", error);
    }
  }
}
