import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import {
  EnrichedOrdersService,
  EnrichedOrdersQueryDto,
  UpdateOrderDto,
} from "./enriched-orders.service";

@ApiTags("Enriched Orders")
@Controller({
  path: "enriched_orders",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class EnrichedOrdersController {
  private readonly logger = new Logger(EnrichedOrdersController.name);

  constructor(private readonly enrichedOrdersService: EnrichedOrdersService) {}

  @Get()
  async getEnrichedOrders(@Query() query: EnrichedOrdersQueryDto) {
    try {
      this.logger.log(
        `Fetching enriched orders with query: ${JSON.stringify(query)}`,
      );

      // Validate and sanitize query parameters
      const sanitizedQuery = this.sanitizeQuery(query);

      const result =
        await this.enrichedOrdersService.getEnrichedOrders(sanitizedQuery);

      this.logger.log(
        `Successfully returned ${result.data.length} enriched orders`,
      );

      return {
        data: result.data,
        total: result.pagination.totalItems,
        pages: result.pagination.totalPages,
        page: result.pagination.currentPage,
        limit: result.pagination.itemsPerPage,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrevious,
        metadata: result.metadata,
      };
    } catch (error) {
      this.logger.error("Failed to fetch enriched orders", error);
      throw new HttpException(
        {
          message: "Failed to fetch enriched orders",
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("edit-options")
  async getEditFormOptions(@Query("saddleId") saddleIdStr?: string) {
    try {
      const saddleId = saddleIdStr ? parseInt(saddleIdStr, 10) : undefined;
      this.logger.log(
        `Fetching edit form options${saddleId ? ` for saddleId=${saddleId}` : ""}`,
      );
      const result = await this.enrichedOrdersService.getEditFormOptions(
        saddleId && !isNaN(saddleId) ? saddleId : undefined,
      );
      return result;
    } catch (error) {
      this.logger.error("Failed to fetch edit form options", error);
      throw new HttpException(
        {
          message: "Failed to fetch edit form options",
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("detail/:id")
  async getOrderDetail(@Param("id", ParseIntPipe) id: number) {
    try {
      this.logger.log(`Fetching order detail for ID: ${id}`);
      const result = await this.enrichedOrdersService.getOrderDetail(id);

      if (!result) {
        throw new NotFoundException(`Order with ID ${id} not found`);
      }

      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to fetch order detail for ID ${id}`, error);
      throw new HttpException(
        {
          message: "Failed to fetch order detail",
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch("bulk-update-status")
  async bulkUpdateOrderStatus(
    @Body() body: { orderIds: number[]; status: string },
  ) {
    try {
      if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
        throw new HttpException(
          { message: "orderIds must be a non-empty array" },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (body.orderIds.length > 100) {
        throw new HttpException(
          { message: "Maximum 100 orders per bulk update" },
          HttpStatus.BAD_REQUEST,
        );
      }
      this.logger.log(
        `Bulk updating ${body.orderIds.length} orders to status: ${body.status}`,
      );
      const result = await this.enrichedOrdersService.bulkUpdateOrderStatus(
        body.orderIds,
        body.status,
      );
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error("Failed to bulk update order statuses", error);
      throw new HttpException(
        {
          message: "Failed to bulk update order statuses",
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch("update-status/:id")
  async updateOrderStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { status: string },
  ) {
    try {
      this.logger.log(`Updating order status for ID ${id} to: ${body.status}`);
      const result = await this.enrichedOrdersService.updateOrderStatus(
        id,
        body.status,
      );
      return result;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to update order status for ID ${id}`, error);
      throw new HttpException(
        {
          message: "Failed to update order status",
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("create")
  async createOrder(
    @Body() body: UpdateOrderDto,
    @Req() req: { user?: { legacyId?: number } },
  ) {
    try {
      this.logger.log("Creating new order");
      const userId = req.user?.legacyId;
      const result = await this.enrichedOrdersService.createOrder(body, userId);
      return result;
    } catch (error) {
      this.logger.error("Failed to create order", error);
      throw new HttpException(
        {
          message: "Failed to create order",
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post("draft-from/:id")
  async createDraftFromOrder(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: { user?: { legacyId?: number } },
  ) {
    try {
      this.logger.log(`Creating draft from order ${id}`);
      const userId = req.user?.legacyId;
      const result = await this.enrichedOrdersService.createDraftFromOrder(
        id,
        userId,
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to create draft from order ${id}`, error);
      throw new HttpException(
        {
          message: "Failed to create draft order",
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch("update/:id")
  async updateOrder(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateOrderDto,
    @Req() req: { user?: { legacyId?: number; role?: { id: number } } },
  ) {
    try {
      this.logger.log(`Updating order ${id}`);
      const userId = req.user?.legacyId;
      const userRoleId = req.user?.role?.id;
      const result = await this.enrichedOrdersService.updateOrder(
        id,
        body,
        userId,
        userRoleId,
      );
      return result;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error(`Failed to update order ${id}`, error);
      throw new HttpException(
        {
          message: "Failed to update order",
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("health")
  async getHealth() {
    await Promise.resolve();
    return {
      status: "healthy",
      service: "enriched-orders",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    };
  }

  private sanitizeQuery(query: EnrichedOrdersQueryDto): EnrichedOrdersQueryDto {
    return {
      page: this.parsePositiveInt(query.page, 1),
      limit: Math.min(this.parsePositiveInt(query.limit, 50) || 50, 100), // Max 100 per page
      partial: query.partial === "true" || query.partial === true,
      noCache: query.noCache === "true" || query.noCache === true,
      searchTerm: query.searchTerm
        ? String(query.searchTerm).trim()
        : undefined,
      search: query.search ? String(query.search).trim() : undefined,
      orderBy: this.sanitizeOrderBy(query.orderBy),
      orderDirection: query.orderDirection === "ASC" ? "ASC" : "DESC",
      // Order ID filters
      id: this.parsePositiveInt(query.id),
      orderId: this.parsePositiveInt(query.orderId),
      orderIds: query.orderIds ? String(query.orderIds).trim() : undefined,
      // Urgency filters (accepts multiple formats)
      urgency: query.urgency ? String(query.urgency).trim() : undefined,
      urgent: query.urgent,
      // Fitter filters
      fitterId: this.parsePositiveInt(query.fitterId),
      fitterName: query.fitterName
        ? String(query.fitterName).trim()
        : undefined,
      fitter: query.fitter ? String(query.fitter).trim() : undefined,
      // Customer filters
      customerId: this.parsePositiveInt(query.customerId),
      customerName: query.customerName
        ? String(query.customerName).trim()
        : undefined,
      customer: query.customer ? String(query.customer).trim() : undefined,
      // Brand/saddle filter
      brandId: this.parsePositiveInt(query.brandId),
      saddleName: query.saddleName
        ? String(query.saddleName).trim()
        : undefined,
      // Status filters
      orderStatus: query.orderStatus
        ? String(query.orderStatus).trim()
        : undefined,
      status: query.status ? String(query.status).trim() : undefined,
      // Factory filters
      factoryId: this.parsePositiveInt(query.factoryId),
      factoryName: query.factoryName
        ? String(query.factoryName).trim()
        : undefined,
      factory: query.factory ? String(query.factory).trim() : undefined,
      // Seat size filters (searches in special_notes field)
      seatSizes: query.seatSizes ? String(query.seatSizes).trim() : undefined,
      seatSize: query.seatSize ? String(query.seatSize).trim() : undefined,
      // Customer country filter
      customerCountry: query.customerCountry
        ? String(query.customerCountry).trim()
        : undefined,
      // Repair filter
      repair:
        query.repair !== undefined ? String(query.repair).trim() : undefined,
      // Knee roll filter
      kneeRoll: query.kneeRoll ? String(query.kneeRoll).trim() : undefined,
      // Supplier name filter
      supplierName: query.supplierName
        ? String(query.supplierName).trim()
        : undefined,
      // Fitter country filter
      fitterCountry: query.fitterCountry
        ? String(query.fitterCountry).trim()
        : undefined,
      // Sale type filter
      saleType: query.saleType ? String(query.saleType).trim() : undefined,
    };
  }

  private parsePositiveInt(
    value: any,
    defaultValue?: number,
  ): number | undefined {
    if (value === undefined || value === null) return defaultValue;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
  }

  private sanitizeOrderBy(orderBy?: string): string | undefined {
    if (!orderBy) return undefined;

    const allowedColumns = [
      "created_at",
      "urgency",
      "customer_name",
      "fitter_name",
      "brand_name",
      "model_name",
      "special_notes",
      "status",
    ];

    return allowedColumns.includes(orderBy) ? orderBy : undefined;
  }
}
